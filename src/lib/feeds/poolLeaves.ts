import "server-only";
import { CONTRACTS, poolLive } from "@/config/contracts";
import { rpc } from "@/lib/feeds/rpc";
import { TOPIC, leavesFromLogs, type LeafRecord, type RawLog } from "@/lib/zk/calls";

/*
 * Server-side index of the pool's leaves: every NewCommitment (commitment,
 * leaf index, encrypted note) plus the note value of shroud leaves. All of it
 * is public chain data; serving it whole means the server never learns which
 * notes a visitor can decrypt. Browsers check the rebuilt root against the
 * contract, so a wrong or incomplete list is detected, not trusted.
 */

const REFRESH_MS = 4000;
const MAX_CHUNKS_PER_REFRESH = 40;
const MAX_SPAN = 50_000;
const MIN_SPAN = 500;

type Index = { leaves: LeafRecord[]; scannedTo: number; refreshedAt: number; span: number };
let index: Index | null = null;
let inflight: Promise<void> | null = null;

const hex = (n: number) => `0x${n.toString(16)}`;

async function refresh() {
  const start = CONTRACTS.poolDeployBlock - 1;
  if (!index) index = { leaves: [], scannedTo: start, refreshedAt: 0, span: MAX_SPAN };
  const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  for (let n = 0; n < MAX_CHUNKS_PER_REFRESH && index.scannedTo < head; n++) {
    const from = index.scannedTo + 1;
    const to = Math.min(head, from + index.span - 1);
    let logs: RawLog[];
    try {
      logs = await rpc<RawLog[]>("eth_getLogs", [{ address: CONTRACTS.pool, fromBlock: hex(from), toBlock: hex(to), topics: [[TOPIC.NewCommitment, TOPIC.Shrouded]] }]);
    } catch (error) {
      // Providers cap the range or the result size: halve and retry.
      if (index.span > MIN_SPAN) {
        index.span = Math.max(MIN_SPAN, Math.floor(index.span / 2));
        continue;
      }
      throw error;
    }
    const fresh = leavesFromLogs(logs);
    for (const leaf of fresh) {
      if (leaf.i !== index.leaves.length) {
        // Out of order or a gap: start over rather than serve a broken list.
        index = null;
        return;
      }
      index.leaves.push(leaf);
    }
    index.scannedTo = to;
  }
  index.refreshedAt = Date.now();
}

export async function poolLeaves(from: number, limit: number) {
  if (!poolLive()) return null;
  if (!index || Date.now() - index.refreshedAt > REFRESH_MS) {
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    await inflight.catch(() => {});
  }
  if (!index) return { leaves: [], total: 0, scannedTo: 0 };
  return { leaves: index.leaves.slice(from, from + limit), total: index.leaves.length, scannedTo: index.scannedTo };
}
