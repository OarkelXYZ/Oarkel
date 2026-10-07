"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { useWallet } from "@/components/wallet/WalletProvider";
import {
  bpsFee,
  discover,
  fetchLeaves,
  isKnownRoot,
  prove,
  readParams,
  readState,
  sharesForAtLeast,
  sharesForAtMost,
  simulate,
  spentMany,
  tokenAllowance,
  tokenBalance,
  treeOf,
  waitReceipt,
  warmProver,
  type MyNote,
  type PoolParams,
} from "@/lib/pool/client";
import { ASSET_ETH, ASSET_TOKEN, decodeAddress, deriveKeys, encodeAddress, encryptNote, keyDomain, keyMessage, ownerHash, randomField, type NoteKeys } from "@/lib/zk/core";
import { encodeApprove, encodeShroud, encodeTransact, encodeUnshroud, type LeafRecord, type PoolState } from "@/lib/zk/calls";
import { ZERO_ADDRESS, buildSpend, pickNotes, transferFeeFor, type OwnedNote } from "@/lib/zk/plan";

/*
 * The real pool, in the browser. Note keys come from one wallet signature
 * (SIWE message bound to this site) plus an optional passphrase and live only
 * in this component's memory: they are never stored, logged or sent anywhere.
 * Reloading the page forgets them; signing again restores the same keys.
 * Every transaction is submitted by the connected wallet itself: proofs always
 * name the zero address as relayer with a zero relayer fee.
 */

export type Asset = "eth" | "oarkel";
export const assetId = (a: Asset) => (a === "eth" ? ASSET_ETH : ASSET_TOKEN);

export type ActivityItem = { t: number; kind: string; text: string; tx?: string };

type Pool = {
  keys: NoteKeys | null;
  privateAddress: string | null;
  unlocking: boolean;
  unlock: (passphrase: string) => Promise<void>;
  lock: () => void;
  syncing: boolean;
  synced: boolean;
  params: PoolParams | null;
  state: PoolState | null;
  notes: MyNote[];
  spent: MyNote[];
  publicToken: bigint | null;
  busy: string | null;
  error: string | null;
  notice: { text: string; tx?: string } | null;
  activity: ActivityItem[];
  shroud: (asset: Asset, amount: bigint) => Promise<boolean>;
  send: (asset: Asset, amount: bigint, to: string) => Promise<boolean>;
  unshroud: (asset: Asset, amount: bigint, to: string) => Promise<boolean>;
  merge: (asset: Asset) => Promise<boolean>;
  refresh: () => void;
  clear: () => void;
  noteWorth: (n: MyNote) => bigint;
  privateBalance: (a: Asset) => bigint;
};

const Ctx = createContext<Pool | null>(null);

const fmt = (v: bigint, decimals: number, digits = 6) => {
  const s = v.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
};

export function PoolProvider({ children }: { children: React.ReactNode }) {
  const { address, signMessage, sendTransaction, refreshBalance } = useWallet();
  const [keys, setKeys] = useState<NoteKeys | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [params, setParams] = useState<PoolParams | null>(null);
  const [state, setState] = useState<PoolState | null>(null);
  const [notes, setNotes] = useState<MyNote[]>([]);
  const [spent, setSpent] = useState<MyNote[]>([]);
  const [publicToken, setPublicToken] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tx?: string } | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [tick, setTick] = useState(0);

  const leavesRef = useRef<LeafRecord[]>([]);
  const mineRef = useRef<MyNote[]>([]);
  const scannedRef = useRef(0);
  const keysFor = useRef<string | null>(null);

  // Keys belong to one wallet: switching or disconnecting forgets them.
  useEffect(() => {
    if (keysFor.current && keysFor.current !== address) {
      setKeys(null);
      keysFor.current = null;
      mineRef.current = [];
      scannedRef.current = 0;
      setNotes([]);
      setSpent([]);
      setActivity([]);
      setSynced(false);
    }
  }, [address]);

  useEffect(() => {
    readParams().then(setParams).catch(() => setParams(null));
  }, []);

  const log = useCallback((kind: string, text: string, tx?: string) => {
    setActivity((a) => [{ t: Date.now(), kind, text, tx }, ...a].slice(0, 50));
  }, []);

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!address) return;
      setError(null);
      setUnlocking(true);
      try {
        const message = keyMessage({ domain: keyDomain(window.location.host, BRAND.domain), address, chainId: CHAIN.id, pool: CONTRACTS.pool });
        const signature = await signMessage(message);
        const k = deriveKeys(signature, passphrase);
        keysFor.current = address;
        mineRef.current = [];
        scannedRef.current = 0;
        setKeys(k);
        void warmProver();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The wallet did not sign.");
      } finally {
        setUnlocking(false);
      }
    },
    [address, signMessage],
  );

  const lock = useCallback(() => {
    setKeys(null);
    keysFor.current = null;
    mineRef.current = [];
    scannedRef.current = 0;
    setNotes([]);
    setSpent([]);
    setSynced(false);
  }, []);

  /* ---------------------------------------------------------- sync */

  const sync = useCallback(async () => {
    if (!keys) return;
    setSyncing(true);
    try {
      let leaves = await fetchLeaves(leavesRef.current);
      let root = treeOf(leaves).root();
      // The index trails the chain by a few seconds; a root the contract does not know means "not yet", or a bad index.
      for (let attempt = 0; attempt < 4 && !(await isKnownRoot(root)); attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        leaves = await fetchLeaves(attempt === 3 ? [] : leaves);
        root = treeOf(leaves).root();
      }
      if (!(await isKnownRoot(root))) throw new Error("The note index does not match the pool yet. Try again in a moment.");
      leavesRef.current = leaves;
      if (scannedRef.current > leaves.length) {
        scannedRef.current = 0;
        mineRef.current = [];
      }
      // Only new leaves need decrypting.
      const all = [...mineRef.current, ...discover(keys, leaves, scannedRef.current)];
      mineRef.current = all;
      scannedRef.current = leaves.length;
      const flags = await spentMany(all.map((n) => n.nullifier));
      setNotes(all.filter((_, i) => !flags[i]));
      setSpent(all.filter((_, i) => flags[i]));
      setState(await readState());
      if (address) setPublicToken(await tokenBalance(address).catch(() => null));
      setSynced(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the pool.");
    } finally {
      setSyncing(false);
    }
  }, [keys, address]);

  useEffect(() => {
    if (!keys) return;
    const first = window.setTimeout(() => void sync(), 0);
    const timer = window.setInterval(() => void sync(), 20_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [keys, sync, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  /* ---------------------------------------------------------- helpers */

  const decimals = (a: Asset) => (a === "eth" ? 18 : (params?.decimals ?? 18));
  const label = (a: Asset) => (a === "eth" ? "ETH" : BRAND.ticker);
  const noteWorth = useCallback(
    (n: MyNote) => (n.asset === ASSET_ETH ? n.value : state ? (n.value * (state.backing + 1n)) / (state.totalShares + 1_000_000n) : 0n),
    [state],
  );
  const privateBalance = useCallback((a: Asset) => notes.filter((n) => n.asset === assetId(a)).reduce((s, n) => s + noteWorth(n), 0n), [notes, noteWorth]);

  const run = useCallback(
    async (fn: () => Promise<string | null>) => {
      setError(null);
      setNotice(null);
      try {
        const msg = await fn();
        if (msg) setNotice({ text: msg });
        return true;
      } catch (cause) {
        const code = (cause as { code?: number })?.code;
        setError(code === 4001 ? "Declined in the wallet." : cause instanceof Error ? cause.message : "That did not go through.");
        return false;
      } finally {
        setBusy(null);
        refreshBalance();
        setTick((n) => n + 1);
      }
    },
    [refreshBalance],
  );

  const submitWallet = useCallback(
    async (tx: { to: string; data: string; value?: bigint }) => {
      if (!address) throw new Error("Connect a wallet first.");
      setBusy("Checking…");
      await simulate({ from: address, ...tx });
      setBusy("Confirm in your wallet…");
      const hash = await sendTransaction(tx);
      setBusy("Waiting for the block…");
      await waitReceipt(hash);
      return hash;
    },
    [address, sendTransaction],
  );

  /* ---------------------------------------------------------- shroud */

  const shroud = useCallback(
    (asset: Asset, amount: bigint) =>
      run(async () => {
        if (!keys || !address) throw new Error("Unlock your notes first.");
        const id = assetId(asset);
        const blinding = randomField();
        // The pool computes the value; the note carries only what the wallet needs to find and open it.
        const data = encodeShroud(id, amount, ownerHash(keys.pk, blinding), encryptNote(keys.viewPub, id, 0n, blinding));
        if (asset === "oarkel") {
          const allowed = await tokenAllowance(address);
          if (allowed < amount) {
            setBusy(`Approve ${label(asset)} in your wallet…`);
            const approveTx = { to: CONTRACTS.token, data: encodeApprove(CONTRACTS.pool, amount) };
            await simulate({ from: address, ...approveTx });
            const h = await sendTransaction(approveTx);
            setBusy("Waiting for the approval…");
            await waitReceipt(h);
          }
        }
        const hash = await submitWallet({ to: CONTRACTS.pool, data, value: asset === "eth" ? amount : undefined });
        log("shroud", `Shrouded ${fmt(amount, decimals(asset))} ${label(asset)}`, hash);
        setNotice({ text: `Shrouded ${fmt(amount, decimals(asset))} ${label(asset)}.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, address, run, submitWallet, sendTransaction, log, params],
  );

  /* ---------------------------------------------------------- spends */

  const spendNotes = useCallback(
    async (opts: { asset: Asset; inputs: OwnedNote[]; pay?: { pk: bigint; viewPub: Uint8Array; value: bigint }; exitValue: bigint; recipient: string; kind: "transact" | "unshroud" }) => {
      if (!keys || !params || !address) throw new Error("Unlock your notes first.");
      const plan = buildSpend({
        keys,
        asset: assetId(opts.asset),
        inputs: opts.inputs,
        tree: treeOf(leavesRef.current),
        pay: opts.pay,
        exitValue: opts.exitValue,
        feeBps: params.transferFeeBps,
        recipient: opts.recipient,
        // Self-submit: no relayer is named and none is paid, so the connected wallet sends the transaction.
        relayer: ZERO_ADDRESS,
        relayerFee: 0n,
        chainId: CHAIN.id,
        pool: CONTRACTS.pool,
      });
      setBusy("Proving on this device…");
      const { proof } = await prove(plan.witness);
      const data = opts.kind === "transact" ? encodeTransact(proof, plan.args, plan.ext) : encodeUnshroud(proof, plan.args, plan.ext);
      return submitWallet({ to: CONTRACTS.pool, data });
    },
    [keys, params, address, submitWallet],
  );

  const unshroud = useCallback(
    (asset: Asset, amount: bigint, to: string) =>
      run(async () => {
        if (!params || !state) throw new Error("Still loading the pool.");
        const flat = asset === "eth" ? params.unshroudFeeEth : params.unshroudFeeToken;
        const gross = amount + flat;
        const exitValue = asset === "eth" ? gross : sharesForAtLeast(state, gross);
        const mine = notes.filter((n) => n.asset === assetId(asset));
        const picked = pickNotes(mine, exitValue);
        if (!picked) throw new Error(mine.length > 2 ? "This needs more than two notes. Merge your notes first (button below), then try again." : "Not enough in your private balance for that plus fees.");
        const hash = await spendNotes({ asset, inputs: picked, exitValue, recipient: to, kind: "unshroud" });
        log("unshroud", `Unshrouded ${fmt(amount, decimals(asset))} ${label(asset)} to ${to.slice(0, 8)}…`, hash);
        setNotice({ text: `Unshrouded ${fmt(amount, decimals(asset))} ${label(asset)}.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params, state, notes, spendNotes, log],
  );

  const send = useCallback(
    (asset: Asset, amount: bigint, to: string) =>
      run(async () => {
        if (!params || !state || !keys) throw new Error("Still loading the pool.");
        const dest = decodeAddress(to);
        if (!dest) throw new Error("That is not an Oarkel private address (it starts with oarkel:).");
        if (dest.pk === keys.pk) throw new Error("That is your own private address.");
        const payValue = asset === "eth" ? amount : sharesForAtMost(state, amount);
        if (payValue === 0n) throw new Error("That amount is too small.");
        const need = payValue + transferFeeFor(payValue, params.transferFeeBps);
        const mine = notes.filter((n) => n.asset === assetId(asset));
        const picked = pickNotes(mine, need);
        if (!picked) throw new Error(mine.length > 2 ? "This needs more than two notes. Merge your notes first, then try again." : "Not enough in your private balance for that plus fees.");
        const hash = await spendNotes({ asset, inputs: picked, pay: { pk: dest.pk, viewPub: dest.viewPub, value: payValue }, exitValue: 0n, recipient: ZERO_ADDRESS, kind: "transact" });
        log("send", `Sent ${fmt(amount, decimals(asset))} ${label(asset)} privately`, hash);
        setNotice({ text: `Sent ${fmt(amount, decimals(asset))} ${label(asset)} privately.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params, state, keys, notes, spendNotes, log],
  );

  const merge = useCallback(
    (asset: Asset) =>
      run(async () => {
        const mine = notes.filter((n) => n.asset === assetId(asset)).sort((a, b) => (a.value < b.value ? -1 : 1));
        if (mine.length < 2) throw new Error("Nothing to merge.");
        // Merge the two smallest into one note to self: no transfer fee, wallet pays gas.
        const hash = await spendNotes({ asset, inputs: mine.slice(0, 2), exitValue: 0n, recipient: ZERO_ADDRESS, kind: "transact" });
        log("merge", `Merged two ${label(asset)} notes`, hash);
        setNotice({ text: "Two notes merged into one.", tx: hash });
        return null;
      }),
    [run, notes, spendNotes, log],
  );

  const clear = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const value: Pool = {
    keys,
    privateAddress: keys ? encodeAddress(keys.pk, keys.viewPub) : null,
    unlocking,
    unlock,
    lock,
    syncing,
    synced,
    params,
    state,
    notes,
    spent,
    publicToken,
    busy,
    error,
    notice,
    activity,
    shroud,
    send,
    unshroud,
    merge,
    refresh,
    clear,
    noteWorth,
    privateBalance,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePool() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePool must be used inside PoolProvider");
  return ctx;
}

export { bpsFee, fmt as formatUnitsShort };
