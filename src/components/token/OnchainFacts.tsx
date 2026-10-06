"use client";

import { useChain } from "@/components/chain/useChain";
import { TOKEN } from "@/config/brand";

/** Name, symbol, decimals and supply read from the token contract once the address is real. */
export function OnchainFacts() {
  const chain = useChain();
  if (!TOKEN.isLive) {
    return <p className="text-[14px] text-fg-3">Read from the contract once the address is published.</p>;
  }
  const t = chain?.token;
  if (!t) return <p className="num text-[14px] text-fg-3">Reading the contract…</p>;
  const supply = Number(BigInt(t.totalSupply) / 10n ** BigInt(Math.max(0, t.decimals - 2))) / 100;
  return (
    <dl className="grid grid-cols-2 gap-3 text-[14px]">
      <div>
        <dt className="text-fg-3">On-chain name</dt>
        <dd className="num text-fg">{t.name || "–"}</dd>
      </div>
      <div>
        <dt className="text-fg-3">Symbol</dt>
        <dd className="num text-fg">{t.symbol || "–"}</dd>
      </div>
      <div>
        <dt className="text-fg-3">Decimals</dt>
        <dd className="num text-fg">{t.decimals}</dd>
      </div>
      <div>
        <dt className="text-fg-3">Total supply</dt>
        <dd className="num text-fg">{supply.toLocaleString("en-US", { maximumFractionDigits: 2 })}</dd>
      </div>
    </dl>
  );
}
