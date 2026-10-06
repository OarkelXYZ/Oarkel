import "server-only";
import { BRAND, ONCHAIN, isAddress } from "@/config/brand";
import { rpcBatch, signed, uint, words } from "@/lib/feeds/rpc";

/*
 * Live state of Robinhood Chain for the status strips: latest block, gas
 * price, Chainlink ETH/USD and, once the contract address is real, the
 * token's on-chain name, symbol, decimals and total supply. Everything is
 * read with eth_call / eth_* through the server relay, cached for 8 seconds.
 */

export type ChainSnapshot = {
  ok: boolean;
  block: number | null;
  blockTime: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  ethUsdUpdatedAt: number | null;
  token: { name: string; symbol: string; decimals: number; totalSupply: string } | null;
  readAt: number;
};

function decodeString(hex: string | null) {
  if (!hex || hex.length < 130) return "";
  const w = words(hex);
  const len = Number(uint(w[1]));
  const body = w.slice(2).join("").slice(0, len * 2);
  return Buffer.from(body, "hex").toString("utf8").replace(/[^\x20-\x7e]/g, "");
}

let cache: { at: number; value: ChainSnapshot } | null = null;
let inflight: Promise<ChainSnapshot> | null = null;

async function read(): Promise<ChainSnapshot> {
  const calls: { method: string; params: unknown[] }[] = [
    { method: "eth_getBlockByNumber", params: ["latest", false] },
    { method: "eth_gasPrice", params: [] },
    { method: "eth_call", params: [{ to: ONCHAIN.ethUsdFeed, data: "0xfeaf968c" }, "latest"] },
  ];
  const ca = BRAND.ca;
  const live = isAddress(ca);
  if (live) {
    for (const data of ["0x06fdde03", "0x95d89b41", "0x313ce567", "0x18160ddd"]) {
      calls.push({ method: "eth_call", params: [{ to: ca, data }, "latest"] });
    }
  }
  const out = await rpcBatch<unknown>(calls);
  const block = out[0] as { number?: string; timestamp?: string } | null;
  const gas = out[1] as string | null;
  const feed = out[2] as string | null;
  let ethUsd: number | null = null;
  let ethUsdUpdatedAt: number | null = null;
  if (feed && feed.length >= 2 + 64 * 5) {
    const w = words(feed);
    ethUsd = Number(signed(w[1])) / 1e8;
    ethUsdUpdatedAt = Number(uint(w[3])) * 1000;
  }
  let token: ChainSnapshot["token"] = null;
  if (live) {
    const [name, symbol, decimals, supply] = out.slice(3, 7) as (string | null)[];
    if (decimals && supply) {
      token = {
        name: decodeString(name),
        symbol: decodeString(symbol),
        decimals: Number(BigInt(decimals)),
        totalSupply: BigInt(supply).toString(),
      };
    }
  }
  return {
    ok: Boolean(block?.number),
    block: block?.number ? Number(BigInt(block.number)) : null,
    blockTime: block?.timestamp ? Number(BigInt(block.timestamp)) * 1000 : null,
    gasGwei: gas ? Number(BigInt(gas)) / 1e9 : null,
    ethUsd,
    ethUsdUpdatedAt,
    token,
    readAt: Date.now(),
  };
}

export async function chainSnapshot(): Promise<ChainSnapshot> {
  if (cache && Date.now() - cache.at < 8000) return cache.value;
  inflight ??= read()
    .then((value) => {
      // A failed read is not cached, so the next request tries again.
      if (value.ok) cache = { at: Date.now(), value };
      return value;
    })
    .catch(
      (): ChainSnapshot =>
        cache?.value ?? { ok: false, block: null, blockTime: null, gasGwei: null, ethUsd: null, ethUsdUpdatedAt: null, token: null, readAt: Date.now() },
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
