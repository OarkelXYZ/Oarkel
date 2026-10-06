"use client";

import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";
import { useChain } from "@/components/chain/useChain";

const fmt = (n: number | null, digits = 0) =>
  n === null ? "…" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Live Robinhood Chain readings: block, its age, gas and Chainlink ETH/USD, as one mono status line. */
export function ChainStrip({ className = "", note = true, compact = false }: { tone?: "paper" | "night"; className?: string; note?: boolean; compact?: boolean }) {
  const chain = useChain();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const down = chain && !chain.ok;
  const age = chain?.blockTime ? Math.max(0, Math.round((now - chain.blockTime) / 1000)) : null;
  const items: [string, string][] = [
    ["block", chain?.block ? `#${fmt(chain.block)}` : "…"],
    ...(compact ? [] : ([["last", age === null ? "…" : `${age}s ago`]] as [string, string][])),
    ["gas", chain?.gasGwei === null || chain?.gasGwei === undefined ? "…" : `${chain.gasGwei.toPrecision(3)} gwei`],
    ["ETH/USD", chain?.ethUsd ? `$${fmt(chain.ethUsd, 2)}` : "…"],
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-white/60 ${className}`} data-testid="chain-strip">
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-white/80">
        <span className={`pulse-dot size-2 rounded-full ${down ? "bg-down" : "bg-up"}`} />
        {down ? `${CHAIN.name} unreachable, retrying` : `${CHAIN.name} live`}
      </span>
      {items.map(([k, v]) => (
        <span key={k} className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-white/40">{k}</span>
          <span className="num text-white/80">{v}</span>
        </span>
      ))}
      {note ? <span className="text-[11px] text-white/35">Chainlink feed + public RPC, every 12 s</span> : null}
    </div>
  );
}
