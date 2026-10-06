"use client";

import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";
import { useChain } from "@/components/chain/useChain";

const fmt = (n: number | null, digits = 0) =>
  n === null ? "…" : n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Live Robinhood Chain readings: block, its age, gas and Chainlink ETH/USD. */
export function ChainStrip({ tone = "paper", className = "" }: { tone?: "paper" | "night"; className?: string }) {
  const chain = useChain();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const night = tone === "night";
  const muted = night ? "text-mist-3" : "text-fg-3";
  const strong = night ? "text-mist" : "text-fg";
  const down = chain && !chain.ok;
  const age = chain?.blockTime ? Math.max(0, Math.round((now - chain.blockTime) / 1000)) : null;
  const items: [string, string][] = [
    ["Block", chain?.block ? `#${fmt(chain.block)}` : "…"],
    ["Last block", age === null ? "…" : `${age}s ago`],
    ["Gas", chain?.gasGwei === null || chain?.gasGwei === undefined ? "…" : `${chain.gasGwei.toPrecision(3)} gwei`],
    ["ETH / USD", chain?.ethUsd ? `$${fmt(chain.ethUsd, 2)}` : "…"],
  ];
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] ${className}`} data-testid="chain-strip">
      <span className={`inline-flex items-center gap-2 whitespace-nowrap ${strong}`}>
        <span className={`pulse-dot size-2 rounded-full ${down ? "bg-down" : "bg-up"}`} />
        {down ? `${CHAIN.name} unreachable, retrying` : `${CHAIN.name} live`}
      </span>
      {items.map(([k, v]) => (
        <span key={k} className="inline-flex items-baseline gap-2 whitespace-nowrap">
          <span className={`label ${muted}`}>{k}</span>
          <span className={`num ${strong}`}>{v}</span>
        </span>
      ))}
      <span className={`text-[11.5px] ${muted}`}>Chainlink feed and public RPC, read every 12 s</span>
    </div>
  );
}
