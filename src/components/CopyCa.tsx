"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { BRAND, CHAIN, TOKEN, shortAddress } from "@/config/brand";

export function useCopyCa() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Until the contract is published there is nothing worth copying.
  const live = TOKEN.isLive;
  const copy = async () => {
    if (!live) return;
    try {
      await navigator.clipboard.writeText(BRAND.ca);
    } catch {
      // Older browsers and some embedded views refuse the async clipboard.
      const area = document.createElement("textarea");
      area.value = BRAND.ca;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy, live };
}

/**
 * Navbar copy pill: "$OARKEL 0x12…abcd" plus a copy icon; on phones a short
 * "CA" chip. One tap copies the full address. Disabled ("At launch") until a
 * real CA is set in src/config/brand.ts.
 */
export function CopyCaTag({ className = "" }: { className?: string }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!live}
      title={live ? `Copy ${BRAND.ca}` : "The contract address is published at launch"}
      aria-label={live ? `${BRAND.symbol} ${shortAddress(BRAND.ca, 4, 4)}, copy contract address` : `${BRAND.symbol} At launch: contract address not published yet`}
      data-testid="ca-tag"
      className={`num inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line-2 bg-card px-3 text-[12.5px] text-fg-2 transition-colors enabled:hover:border-fg enabled:hover:text-fg disabled:cursor-default ${className}`}
    >
      <span className="font-semibold text-fg sm:hidden">CA</span>
      <span className="hidden font-semibold text-fg sm:inline">{BRAND.symbol}</span>
      <span className="hidden whitespace-nowrap sm:inline">{!live ? "At launch" : copied ? "Copied" : shortAddress(BRAND.ca, 4, 4)}</span>
      {!live ? null : copied ? <Check size={13} className="text-up" weight="bold" /> : <Copy size={13} />}
    </button>
  );
}

/** Full contract block: chain, the whole address and a copy button. */
export function CopyCaBlock({ className = "", tone = "paper" }: { className?: string; tone?: "paper" | "night" }) {
  const { copied, copy, live } = useCopyCa();
  const night = tone === "night";
  return (
    <div
      className={`rounded-[12px] border px-4 py-3.5 ${night ? "border-night-3 bg-night-2 text-mist" : "border-line bg-card text-fg"} ${className}`}
      data-testid="ca-block"
    >
      <p className={`label ${night ? "text-mist-3" : "text-fg-3"}`}>
        {BRAND.symbol} contract · {CHAIN.name}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code className={`num min-w-0 flex-1 text-[13px] leading-snug ${live ? "break-all" : "break-words"}`} data-testid="ca-full">
          {live ? BRAND.ca : "Contract address coming soon. Only trust the address published on this site and on our X account."}
        </code>
        <button
          type="button"
          onClick={copy}
          disabled={!live}
          className={`${night ? "btn-ghost" : "btn-ink"} inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold`}
          data-testid="ca-copy"
        >
          {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
          {!live ? "At launch" : copied ? "Copied" : "Copy CA"}
        </button>
      </div>
    </div>
  );
}
