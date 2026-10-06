"use client";

import { CHAIN } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { rpc } from "@/lib/rpc";
import { MerkleTree, decryptNote, noteCommitment, nullifierOf, type NoteKeys } from "@/lib/zk/core";
import {
  POOL_ERRORS,
  SIG,
  decodeBoolArray,
  decodeState,
  encodeAllowance,
  encodeBalanceOf,
  encodeIsKnownRoot,
  encodeSpentMany,
  words,
  type LeafRecord,
  type PoolState,
} from "@/lib/zk/calls";
import type { OwnedNote } from "@/lib/zk/plan";

/*
 * Browser side of the real pool: reads through the site's RPC relay, the
 * leaf index from /api/pool/leaves (checked against the contract's root
 * history), local note discovery with the viewing key, a dry run before every
 * transaction, and the prover worker. Keys never leave this module's callers
 * in memory: nothing here stores or sends them.
 */

export const call = (data: string, to: string = CONTRACTS.pool) => rpc<string>("eth_call", [{ to, data }, "latest"]);

/* ------------------------------------------------------------ dry run + receipts */

async function rawCall(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  return (await res.json()) as { result?: string; error?: { message?: string; data?: unknown } };
}

function revertData(error: { message?: string; data?: unknown } | undefined) {
  const d = error?.data;
  if (typeof d === "string" && d.startsWith("0x")) return d;
  if (d && typeof d === "object" && typeof (d as { data?: unknown }).data === "string") return (d as { data: string }).data;
  return null;
}

export function explainRevert(data: string | null, fallback: string) {
  if (!data) return fallback;
  return POOL_ERRORS[data.slice(0, 10).toLowerCase()] ?? fallback;
}

/** eth_call as `from`; throws a readable reason when the transaction would revert. */
export async function simulate(tx: { from: string; to?: string; data: string; value?: bigint }) {
  const params = [{ from: tx.from, ...(tx.to ? { to: tx.to } : {}), data: tx.data, ...(tx.value ? { value: `0x${tx.value.toString(16)}` } : {}) }, "latest"];
  // The site relay takes calls to a contract up to 12 KB; deployments go to the RPC directly.
  const urls = tx.to && tx.data.length <= 24_576 ? ["/api/rpc", CHAIN.rpc, CHAIN.fallbackRpc] : [CHAIN.rpc, CHAIN.fallbackRpc];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const body = await rawCall(url, { jsonrpc: "2.0", id: 1, method: "eth_call", params });
      if (!body.error) return body.result ?? "0x";
      const data = revertData(body.error);
      if (/insufficient funds/i.test(body.error.message ?? "")) throw new Error("Not enough ETH for this amount plus gas.");
      throw new Error(explainRevert(data, body.error.message ?? "The transaction would fail."));
    } catch (error) {
      if (error instanceof Error && !/^RPC \d+|fetch|Method not allowed|data must be hex/i.test(error.message)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not reach the chain.");
}

export async function waitReceipt(hash: string, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpc<{ status: string; blockNumber: string } | null>("eth_getTransactionReceipt", [hash]).catch(() => null);
    if (receipt) {
      if (receipt.status !== "0x1") throw new Error("The transaction reverted on chain.");
      return receipt;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Still waiting for the block. Check the explorer for the result.");
}

/* ------------------------------------------------------------ reads */

export type PoolParams = { shroudFeeBps: bigint; transferFeeBps: bigint; unshroudFeeEth: bigint; unshroudFeeToken: bigint; decimals: number };

export async function readParams(): Promise<PoolParams> {
  const [a, b, c, d, dec] = await Promise.all([
    call(SIG.shroudFeeBps),
    call(SIG.transferFeeBps),
    call(SIG.unshroudFeeEth),
    call(SIG.unshroudFeeToken),
    call(SIG.decimals, CONTRACTS.token),
  ]);
  return { shroudFeeBps: words(a)[0], transferFeeBps: words(b)[0], unshroudFeeEth: words(c)[0], unshroudFeeToken: words(d)[0], decimals: Number(words(dec)[0]) };
}

export const readState = async (): Promise<PoolState> => decodeState(await call(SIG.state));
export const tokenBalance = async (owner: string) => words(await call(encodeBalanceOf(owner), CONTRACTS.token))[0];
export const tokenAllowance = async (owner: string) => words(await call(encodeAllowance(owner, CONTRACTS.pool), CONTRACTS.token))[0];
export const isKnownRoot = async (root: bigint) => words(await call(encodeIsKnownRoot(root)))[0] === 1n;

export async function spentMany(nullifiers: bigint[]) {
  const out: boolean[] = [];
  for (let i = 0; i < nullifiers.length; i += 200) out.push(...decodeBoolArray(await call(encodeSpentMany(nullifiers.slice(i, i + 200)))));
  return out;
}

/* ------------------------------------------------------------ vault math (mirrors OarkelPool) */

export const VIRTUAL_SHARES = 1_000_000n;
/** Token value of shares, rounded down (OarkelPool.valueOfShares). */
export const valueOfShares = (s: PoolState, shares: bigint) => (shares * (s.backing + 1n)) / (s.totalShares + VIRTUAL_SHARES);
/** Shares worth at least `amount` tokens (rounded up): what an exit must burn. */
export const sharesForAtLeast = (s: PoolState, amount: bigint) => {
  const num = amount * (s.totalShares + VIRTUAL_SHARES);
  const den = s.backing + 1n;
  return (num + den - 1n) / den;
};
/** Shares worth at most `amount` tokens (rounded down): what a payment of `amount` hands over. */
export const sharesForAtMost = (s: PoolState, amount: bigint) => (amount * (s.totalShares + VIRTUAL_SHARES)) / (s.backing + 1n);
export const bpsFee = (amount: bigint, bps: bigint) => (amount * bps + 9_999n) / 10_000n;

/* ------------------------------------------------------------ leaves + notes */

export type MyNote = OwnedNote & { tx: string; block: number; origin: "shroud" | "received" };

/** Fetches every leaf from the site's index. */
export async function fetchLeaves(known: LeafRecord[]): Promise<LeafRecord[]> {
  const out = known.slice();
  for (let guard = 0; guard < 10_000; guard++) {
    const res = await fetch(`/api/pool/leaves?from=${out.length}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status === 429 ? "Too many requests. Wait a moment." : "Could not load the pool's notes.");
    const body = (await res.json()) as { configured?: boolean; leaves?: LeafRecord[]; total?: number };
    if (!body.configured) throw new Error("The pool is not configured on this site.");
    const page = body.leaves ?? [];
    for (const leaf of page) {
      if (leaf.i !== out.length) throw new Error("The note index came back out of order.");
      out.push(leaf);
    }
    if (page.length === 0 || out.length >= (body.total ?? 0)) break;
  }
  return out;
}

/**
 * Finds this wallet's notes among `leaves[from..]`: decrypt with the viewing
 * key, then recompute the commitment, so a note that does not open to the
 * leaf it claims is ignored.
 */
export function discover(keys: NoteKeys, leaves: LeafRecord[], from = 0): MyNote[] {
  const mine: MyNote[] = [];
  for (let n = from; n < leaves.length; n++) {
    const leaf = leaves[n];
    const opened = decryptNote(keys, leaf.e);
    if (!opened) continue;
    const isShroud = leaf.v !== undefined;
    const value = isShroud && opened.value === 0n ? BigInt(leaf.v as string) : opened.value;
    if (value === 0n) continue;
    const commitment = noteCommitment(opened.asset, value, keys.pk, opened.blinding);
    if (commitment !== BigInt(leaf.c)) continue;
    mine.push({
      asset: opened.asset,
      value,
      blinding: opened.blinding,
      index: leaf.i,
      commitment,
      nullifier: nullifierOf(commitment, leaf.i, keys.sk),
      tx: leaf.tx,
      block: leaf.b,
      origin: isShroud ? "shroud" : "received",
    });
  }
  return mine;
}

export const treeOf = (leaves: LeafRecord[]) => new MerkleTree(leaves.map((l) => BigInt(l.c)));

/* ------------------------------------------------------------ prover */

let worker: Worker | null = null;
let seq = 0;
const waiting = new Map<number, { ok: (v: { proof: string; ms: number }) => void; fail: (e: Error) => void }>();

function prover() {
  if (worker) return worker;
  worker = new Worker("/zk/prover.js", { type: "module" });
  worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; proof?: string; ms?: number; error?: string }>) => {
    const w = waiting.get(event.data.id);
    if (!w) return;
    waiting.delete(event.data.id);
    if (event.data.ok) w.ok({ proof: event.data.proof ?? "", ms: event.data.ms ?? 0 });
    else w.fail(new Error(event.data.error || "Proving failed."));
  };
  worker.onerror = () => {
    for (const w of waiting.values()) w.fail(new Error("The prover stopped. Reload the page and try again."));
    waiting.clear();
    worker = null;
  };
  return worker;
}

function ask(msg: Record<string, unknown>) {
  const id = ++seq;
  return new Promise<{ proof: string; ms: number }>((ok, fail) => {
    waiting.set(id, { ok, fail });
    prover().postMessage({ id, ...msg });
  });
}

/** Loads the prover in the background (circuit, WASM, SRS points). */
export const warmProver = () => ask({ kind: "warm" }).catch(() => undefined);
export const prove = (witness: Record<string, unknown>) => ask({ kind: "prove", witness });

/* ------------------------------------------------------------ relayer */

export type RelayerInfo = { address: string; chainId: number; pool: string; feeEthWei: string; acceptsTokenFees?: boolean; feeTokenUnits?: string };

export async function relayerInfo(url: string): Promise<RelayerInfo> {
  const res = await fetch(`${url.replace(/\/$/, "")}/info`, { cache: "no-store" });
  if (!res.ok) throw new Error("The relayer did not answer.");
  const info = (await res.json()) as RelayerInfo;
  if (info.chainId !== CHAIN.id || info.pool.toLowerCase() !== CONTRACTS.pool.toLowerCase()) throw new Error("That relayer serves a different pool.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(info.address)) throw new Error("The relayer sent a bad address.");
  return info;
}

export async function relay(url: string, kind: "transact" | "unshroud", data: string): Promise<string> {
  const res = await fetch(`${url.replace(/\/$/, "")}/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, data }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { hash?: string; error?: string };
  if (!res.ok || !body.hash) throw new Error(body.error || "The relayer refused the transaction.");
  return body.hash;
}
