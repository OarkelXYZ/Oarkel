"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, RELAYER_URL, swapLive } from "@/config/contracts";
import { useWallet } from "@/components/wallet/WalletProvider";
import {
  bpsFee,
  discover,
  fetchLeaves,
  isKnownRoot,
  prove,
  readParams,
  readState,
  relay,
  relayerInfo,
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
  type RelayerInfo,
} from "@/lib/pool/client";
import { RELAYER_PAUSE_MS, RelayFailure, classifyRelayFailure } from "@/lib/pool/relayFailure";
import { ASSET_ETH, ASSET_TOKEN, decodeAddress, deriveKeys, encodeAddress, encryptNote, keyDomain, keyMessage, ownerHash, randomField, type NoteKeys } from "@/lib/zk/core";
import { encodeApprove, encodeBuyIntoNote, encodeShroud, encodeSwap, encodeSwapTerms, encodeTransact, encodeUnshroud, type LeafRecord, type PoolState } from "@/lib/zk/calls";
import { loadMarket, quote, withSlippage, type Market } from "@/lib/pons";
import { ZERO_ADDRESS, buildSpend, pickNotes, transferFeeFor, type OwnedNote } from "@/lib/zk/plan";

/*
 * The real pool, in the browser. Note keys come from one wallet signature
 * (SIWE message bound to this site) plus an optional passphrase and live only
 * in this component's memory: they are never stored, logged or sent anywhere.
 * Reloading the page forgets them; signing again restores the same keys.
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
  relayer: RelayerInfo | null;
  relayerUrl: string;
  setRelayerUrl: (url: string) => void;
  shroud: (asset: Asset, amount: bigint) => Promise<boolean>;
  send: (asset: Asset, amount: bigint, to: string, viaRelayer: boolean) => Promise<boolean>;
  unshroud: (asset: Asset, amount: bigint, to: string, viaRelayer: boolean) => Promise<boolean>;
  merge: (asset: Asset) => Promise<boolean>;
  /** Quote for swapping `amount` of `from` (taken from notes) into a note of the other asset. Null: swaps are off. */
  previewSwap: (from: Asset, amount: bigint, viaRelayer: boolean) => Promise<SwapQuote | null>;
  swap: (from: Asset, amount: bigint, slippageBps: number, viaRelayer: boolean) => Promise<boolean>;
  /** Buys $OARKEL with ETH from the connected wallet and shrouds it into a new note (the purchase is public). */
  buyIntoNote: (ethAmount: bigint, slippageBps: number) => Promise<boolean>;
  swapEnabled: boolean;
  refresh: () => void;
  clear: () => void;
  noteWorth: (n: MyNote) => bigint;
  privateBalance: (a: Asset) => bigint;
};

export type SwapQuote = {
  venue: Market["venue"];
  /** Units leaving the pool for the trade, after the flat unshroud fee. */
  traded: bigint;
  /** ETH paid to the relayer for landing the swap (zero when your wallet sends it). */
  carrierFee: bigint;
  /** Expected amount shrouded into the new note, before the pool's shroud fee. */
  out: bigint;
};

const Ctx = createContext<Pool | null>(null);

const fmt = (v: bigint, decimals: number, digits = 6) => {
  const s = v.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals);
  const frac = s.slice(s.length - decimals).slice(0, digits).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
};

/**
 * Notes for a relayed spend. A retry reuses exactly the notes of the first proof: the two proofs then share
 * nullifiers, so a relayer that kept the first one can land at most one of them. Picking afresh could spend
 * other notes and let both go through.
 */
function retryInputs(first: OwnedNote[] | null, mine: OwnedNote[], need: bigint): OwnedNote[] {
  if (first) {
    if (first.reduce((sum, n) => sum + n.value, 0n) < need) throw new Error("The new relayer fee no longer fits in the notes of the first proof. Press the button again to start over.");
    return first;
  }
  const picked = pickNotes(mine, need);
  if (!picked) throw new Error(mine.length > 2 ? "This needs more than two notes. Merge your notes first (button below), then try again." : "Not enough in your private balance for that plus fees.");
  return picked;
}

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
  const [relayerUrl, setRelayerUrl] = useState(RELAYER_URL);
  // Relayers that were unreachable or paused, skipped until `until`; the next one in the list is used meanwhile.
  const [down, setDown] = useState<{ url: string; until: number }[]>([]);
  const downUrls = down.map((d) => d.url);
  const downKey = downUrls.join(",");
  // Bumped to re-read the relayer's quote (its fee follows the gas price).
  const [relayerRefresh, setRelayerRefresh] = useState(0);
  const [relayerSeen, setRelayerSeen] = useState<{ list: string; url: string; info: RelayerInfo | null } | null>(null);
  const relayer = relayerSeen && relayerSeen.list === relayerUrl + "|" + downKey ? relayerSeen.info : null;
  const activeRelayerUrl = relayer ? (relayerSeen?.url ?? "") : "";
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

  // A skipped relayer comes back once its pause runs out.
  useEffect(() => {
    if (down.length === 0) return;
    const next = Math.min(...down.map((d) => d.until));
    const t = setTimeout(() => setDown((d) => d.filter((x) => x.until > Date.now())), Math.max(0, next - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [down]);

  // Keep the quoted fee current while the app is open.
  useEffect(() => {
    if (!relayerUrl) return;
    const t = setInterval(() => setRelayerRefresh((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [relayerUrl]);

  useEffect(() => {
    const skip = downKey ? downKey.split(",") : [];
    const urls = relayerUrl.split(",").map((u) => u.trim()).filter((u) => u && !skip.includes(u));
    const key = relayerUrl + "|" + downKey;
    let cancelled = false;
    (async () => {
      for (const url of urls) {
        try {
          const info = await relayerInfo(url);
          if (!cancelled) setRelayerSeen({ list: key, url, info });
          return;
        } catch {
          // try the next relayer
        }
      }
      if (!cancelled) setRelayerSeen({ list: key, url: "", info: null });
    })();
    return () => {
      cancelled = true;
    };
  }, [relayerUrl, downKey, relayerRefresh]);

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
    async (opts: {
      asset: Asset;
      inputs: OwnedNote[];
      pay?: { pk: bigint; viewPub: Uint8Array; value: bigint };
      exitValue: bigint;
      recipient: string;
      viaRelayer: boolean;
      relayerFee: bigint;
      kind: "transact" | "unshroud" | "swap";
      swapTerms?: string;
    }) => {
      if (!keys || !params || !address) throw new Error("Unlock your notes first.");
      const useRelayer = opts.viaRelayer && relayer && activeRelayerUrl;
      // A swap proof names the swap contract as both recipient and pool relayer (fee of one unit), so the pool takes
      // it only through that contract. Whoever carries it there is paid by the swap terms instead.
      const isSwap = opts.kind === "swap";
      const target = isSwap ? CONTRACTS.swap : CONTRACTS.pool;
      const plan = buildSpend({
        keys,
        asset: assetId(opts.asset),
        inputs: opts.inputs,
        tree: treeOf(leavesRef.current),
        pay: opts.pay,
        exitValue: opts.exitValue,
        feeBps: params.transferFeeBps,
        recipient: opts.recipient,
        relayer: isSwap ? CONTRACTS.swap : useRelayer ? relayer.address : ZERO_ADDRESS,
        relayerFee: isSwap ? 1n : useRelayer ? opts.relayerFee : 0n,
        chainId: CHAIN.id,
        pool: CONTRACTS.pool,
        swapTerms: opts.swapTerms,
      });
      setBusy("Proving on this device…");
      const { proof } = await prove(plan.witness);
      const data =
        opts.kind === "transact" ? encodeTransact(proof, plan.args, plan.ext) : isSwap ? encodeSwap(proof, plan.args, plan.ext) : encodeUnshroud(proof, plan.args, plan.ext);
      if (useRelayer) {
        setBusy("Checking…");
        await simulate({ from: relayer.address, to: target, data });
        setBusy("Sending through the relayer…");
        let hash: string;
        try {
          hash = await relay(activeRelayerUrl, opts.kind, data);
        } catch (cause) {
          const failure = classifyRelayFailure(cause);
          // Only an unreachable or paused relayer is set aside. A refusal of this one proof (fee, stale root) is not
          // the relayer's fault, so it stays in use and the caller may prove again.
          if (failure === "unavailable") setDown((d) => [...d.filter((x) => x.url !== activeRelayerUrl), { url: activeRelayerUrl, until: Date.now() + RELAYER_PAUSE_MS }]);
          throw new RelayFailure(cause instanceof Error ? cause.message : "The relayer refused.", failure, activeRelayerUrl);
        }
        setBusy("Waiting for the block…");
        await waitReceipt(hash);
        return hash;
      }
      return submitWallet({ to: target, data });
    },
    [keys, params, address, relayer, activeRelayerUrl, submitWallet],
  );

  /**
   * Runs a relayed spend and, when the relayer turned down that one proof (its fee went up with the gas price, or the
   * tree moved on), asks for a fresh quote and proves once more. A new fee more than a quarter above the one shown is
   * never paid without the user seeing it: the quote is refreshed on screen and the user presses the button again.
   */
  const withRelayRetry = useCallback(
    async (asset: Asset, viaRelayer: boolean, fee: bigint, attempt: (fee: bigint) => Promise<string>, feeOf?: (info: RelayerInfo) => bigint | null) => {
      try {
        return await attempt(fee);
      } catch (e) {
        if (!viaRelayer || !(e instanceof RelayFailure)) throw e;
        if (e.failure === "unavailable") {
          const others = relayerUrl.split(",").map((u) => u.trim()).filter((u) => u && u !== e.url).length;
          const meanwhile = others > 0 ? "the next relayer in your list (Settings) is used meanwhile" : "the app tries it again after that";
          throw new Error(
            `${e.message} This relayer is skipped for two minutes and ${meanwhile}. To send now, untick “Use a relayer” and submit from your own wallet, which then shows as the sender.`,
          );
        }
        if (e.failure === "final") throw new Error(e.message);
        const info = await relayerInfo(e.url).catch(() => null);
        setRelayerRefresh((n) => n + 1);
        const fresh = !info
          ? null
          : feeOf
            ? feeOf(info)
            : asset === "eth"
              ? BigInt(info.feeEthWei)
              : info.acceptsTokenFees && info.feeTokenUnits
                ? BigInt(info.feeTokenUnits)
                : null;
        if (fresh === null) throw new Error(`${e.message} The relayer did not give a new quote. Try again in a moment.`);
        if (fresh * 4n > fee * 5n) {
          const unit = feeOf ? "eth" : asset;
          throw new Error(`${e.message} Its fee is now ${fmt(fresh, decimals(unit))} ${label(unit)}, up from ${fmt(fee, decimals(unit))}. Check the new fee and press the button again.`);
        }
        setBusy("The relayer asked for a fresh proof. Proving again…");
        return attempt(fresh);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [relayerUrl, params],
  );

  const relayerFeeFor = useCallback(
    (asset: Asset, viaRelayer: boolean) => {
      if (!viaRelayer || !relayer) return 0n;
      if (asset === "eth") return BigInt(relayer.feeEthWei);
      return relayer.acceptsTokenFees && relayer.feeTokenUnits ? BigInt(relayer.feeTokenUnits) : 0n;
    },
    [relayer],
  );

  const unshroud = useCallback(
    (asset: Asset, amount: bigint, to: string, wantRelayer: boolean) =>
      run(async () => {
        // A relayer that does not take token fees cannot carry a token spend: the wallet submits it.
        const viaRelayer = wantRelayer && Boolean(relayer) && (asset === "eth" || Boolean(relayer?.acceptsTokenFees));
        if (!params || !state) throw new Error("Still loading the pool.");
        const flat = asset === "eth" ? params.unshroudFeeEth : params.unshroudFeeToken;
        const mine = notes.filter((n) => n.asset === assetId(asset));
        let inputs: OwnedNote[] | null = null;
        const hash = await withRelayRetry(asset, viaRelayer, relayerFeeFor(asset, viaRelayer), (fee) => {
          const gross = amount + flat + fee;
          const exitValue = asset === "eth" ? gross : sharesForAtLeast(state, gross);
          inputs = retryInputs(inputs, mine, exitValue);
          return spendNotes({ asset, inputs, exitValue, recipient: to, viaRelayer, relayerFee: fee, kind: "unshroud" });
        });
        log("unshroud", `Unshrouded ${fmt(amount, decimals(asset))} ${label(asset)} to ${to.slice(0, 8)}…`, hash);
        setNotice({ text: `Unshrouded ${fmt(amount, decimals(asset))} ${label(asset)}.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params, state, notes, relayer, relayerFeeFor, withRelayRetry, spendNotes, log],
  );

  const send = useCallback(
    (asset: Asset, amount: bigint, to: string, wantRelayer: boolean) =>
      run(async () => {
        // A relayer that does not take token fees cannot carry a token spend: the wallet submits it.
        const viaRelayer = wantRelayer && Boolean(relayer) && (asset === "eth" || Boolean(relayer?.acceptsTokenFees));
        if (!params || !state || !keys) throw new Error("Still loading the pool.");
        const dest = decodeAddress(to);
        if (!dest) throw new Error("That is not an Oarkel private address (it starts with oarkel:).");
        if (dest.pk === keys.pk) throw new Error("That is your own private address.");
        const payValue = asset === "eth" ? amount : sharesForAtMost(state, amount);
        if (payValue === 0n) throw new Error("That amount is too small.");
        const mine = notes.filter((n) => n.asset === assetId(asset));
        let inputs: OwnedNote[] | null = null;
        const hash = await withRelayRetry(asset, viaRelayer, relayerFeeFor(asset, viaRelayer), (fee) => {
          const exitValue = fee === 0n ? 0n : asset === "eth" ? fee : sharesForAtLeast(state, fee);
          const need = payValue + transferFeeFor(payValue, params.transferFeeBps) + exitValue;
          inputs = retryInputs(inputs, mine, need);
          return spendNotes({ asset, inputs, pay: { pk: dest.pk, viewPub: dest.viewPub, value: payValue }, exitValue, recipient: ZERO_ADDRESS, viaRelayer, relayerFee: fee, kind: "transact" });
        });
        log("send", `Sent ${fmt(amount, decimals(asset))} ${label(asset)} privately`, hash);
        setNotice({ text: `Sent ${fmt(amount, decimals(asset))} ${label(asset)} privately.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params, state, keys, notes, relayer, relayerFeeFor, withRelayRetry, spendNotes, log],
  );

  /* ---------------------------------------------------------- swaps */

  const swapFeeOf = (info: RelayerInfo | null) => (info?.swapFeeEthWei ? BigInt(info.swapFeeEthWei) : null);
  const canRelaySwap = Boolean(relayer && swapFeeOf(relayer) !== null);

  /** What leaves the pool for the trade, the carrier's fee and the expected amount into the new note. */
  const quoteSwap = useCallback(
    async (from: Asset, amount: bigint, carrierFee: bigint): Promise<SwapQuote> => {
      if (!params || !state) throw new Error("Still loading the pool.");
      const market = await loadMarket(CONTRACTS.token);
      if (market.venue !== "curve" && market.venue !== "pool") {
        throw new Error(market.venue === "graduating" ? `${BRAND.ticker} is moving to its Pons pool. Swaps reopen once the pool is live.` : "Trading is paused for this token.");
      }
      const flat = from === "eth" ? params.unshroudFeeEth : params.unshroudFeeToken;
      if (amount <= flat) throw new Error("That amount does not cover the unshroud fee.");
      const traded = amount - flat;
      if (from === "eth") {
        if (traded <= carrierFee) throw new Error("That amount does not cover the relayer fee.");
        return { venue: market.venue, traded, carrierFee, out: await quote(market, true, traded - carrierFee, CONTRACTS.swap) };
      }
      const eth = await quote(market, false, traded, CONTRACTS.swap);
      if (eth <= carrierFee) throw new Error("That amount does not cover the relayer fee.");
      return { venue: market.venue, traded, carrierFee, out: eth - carrierFee };
    },
    [params, state],
  );

  const previewSwap = useCallback(
    async (from: Asset, amount: bigint, wantRelayer: boolean) => {
      if (!swapLive()) return null;
      const fee = wantRelayer && canRelaySwap ? (swapFeeOf(relayer) as bigint) : 0n;
      return quoteSwap(from, amount, fee);
    },
    [quoteSwap, relayer, canRelaySwap],
  );

  const swap = useCallback(
    (from: Asset, amount: bigint, slippageBps: number, wantRelayer: boolean) =>
      run(async () => {
        if (!swapLive()) throw new Error("Swaps are not live yet.");
        if (!params || !state || !keys) throw new Error("Still loading the pool.");
        // Never fall back to the wallet on its own: that would show the wallet as the sender.
        if (wantRelayer && !canRelaySwap) throw new Error("No relayer that carries swaps is available. Untick “Use a relayer” to send the swap from your own wallet, which then shows as the sender.");
        const viaRelayer = wantRelayer;
        const to: Asset = from === "eth" ? "oarkel" : "eth";
        const exitValue = from === "eth" ? amount : sharesForAtLeast(state, amount);
        const mine = notes.filter((n) => n.asset === assetId(from));
        let inputs: OwnedNote[] | null = null;
        let landed: SwapQuote | null = null;
        const hash = await withRelayRetry(
          "eth",
          viaRelayer,
          viaRelayer ? (swapFeeOf(relayer) as bigint) : 0n,
          async (fee) => {
            setBusy("Getting a price…");
            const q = await quoteSwap(from, amount, fee);
            // Slippage applies to the trade; the carrier's fee is fixed.
            const minOut = from === "eth" ? withSlippage(q.out, slippageBps) : withSlippage(q.out + fee, slippageBps) - fee;
            if (minOut <= 0n) throw new Error("That amount is too small to swap.");
            const blinding = randomField();
            const terms = encodeSwapTerms({
              ownerHash: ownerHash(keys.pk, blinding),
              minOut,
              deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
              submitter: viaRelayer && relayer ? relayer.address : ZERO_ADDRESS,
              submitterFee: fee,
              // The pool computes the new note's value; the note carries what the wallet needs to find and open it.
              encryptedNote: encryptNote(keys.viewPub, assetId(to), 0n, blinding),
            });
            inputs = retryInputs(inputs, mine, exitValue);
            landed = q;
            return spendNotes({ asset: from, inputs, exitValue, recipient: CONTRACTS.swap, viaRelayer, relayerFee: 0n, kind: "swap", swapTerms: terms });
          },
          (info) => swapFeeOf(info),
        );
        const q = landed as SwapQuote | null;
        const got = q ? ` for about ${fmt(q.out, decimals(to))} ${label(to)}` : "";
        log("swap", `Swapped ${fmt(amount, decimals(from))} ${label(from)}${got} privately`, hash);
        setNotice({ text: `Swapped ${fmt(amount, decimals(from))} ${label(from)}${got}. The new note appears once the block is read.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, params, state, keys, notes, relayer, canRelaySwap, quoteSwap, withRelayRetry, spendNotes, log],
  );

  const buyIntoNote = useCallback(
    (ethAmount: bigint, slippageBps: number) =>
      run(async () => {
        if (!swapLive()) throw new Error("Swaps are not live yet.");
        if (!keys || !address) throw new Error("Unlock your notes first.");
        if (ethAmount <= 0n) throw new Error("Enter an amount.");
        setBusy("Getting a price…");
        const market = await loadMarket(CONTRACTS.token);
        if (market.venue !== "curve" && market.venue !== "pool") throw new Error("Trading is paused for this token.");
        const out = await quote(market, true, ethAmount, CONTRACTS.swap);
        const blinding = randomField();
        const data = encodeBuyIntoNote(ownerHash(keys.pk, blinding), withSlippage(out, slippageBps), encryptNote(keys.viewPub, ASSET_TOKEN, 0n, blinding));
        const hash = await submitWallet({ to: CONTRACTS.swap, data, value: ethAmount });
        log("buy", `Bought about ${fmt(out, decimals("oarkel"))} ${BRAND.ticker} into a new note`, hash);
        setNotice({ text: `Bought about ${fmt(out, decimals("oarkel"))} ${BRAND.ticker} into a new private note.`, tx: hash });
        return null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, keys, address, submitWallet, log, params],
  );

  const merge = useCallback(
    (asset: Asset) =>
      run(async () => {
        const mine = notes.filter((n) => n.asset === assetId(asset)).sort((a, b) => (a.value < b.value ? -1 : 1));
        if (mine.length < 2) throw new Error("Nothing to merge.");
        // Merge the two smallest into one note to self: no transfer fee, wallet pays gas.
        const hash = await spendNotes({ asset, inputs: mine.slice(0, 2), exitValue: 0n, recipient: ZERO_ADDRESS, viaRelayer: false, relayerFee: 0n, kind: "transact" });
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
    relayer,
    relayerUrl,
    setRelayerUrl: (url: string) => {
      setDown([]);
      setRelayerUrl(url);
    },
    shroud,
    send,
    unshroud,
    merge,
    previewSwap,
    swap,
    buyIntoNote,
    swapEnabled: swapLive(),
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
