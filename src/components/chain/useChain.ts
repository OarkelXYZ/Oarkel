"use client";

import { useEffect, useState } from "react";

export type ChainView = {
  ok: boolean;
  block: number | null;
  blockTime: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  ethUsdUpdatedAt: number | null;
  token: { name: string; symbol: string; decimals: number; totalSupply: string } | null;
  readAt: number;
};

let shared: ChainView | null = null;
let listeners = new Set<(v: ChainView | null) => void>();
let timer: number | undefined;

async function poll() {
  try {
    const res = await fetch("/api/chain", { cache: "no-store" });
    if (res.ok) shared = (await res.json()) as ChainView;
  } catch {
    // Keep the last reading; the strip shows its age.
  }
  listeners.forEach((fn) => fn(shared));
}

/** One poller for the whole page (every 12 s while anything listens). */
export function useChain() {
  const [view, setView] = useState<ChainView | null>(shared);
  useEffect(() => {
    listeners.add(setView);
    if (listeners.size === 1) {
      void poll();
      timer = window.setInterval(poll, 12_000);
    }
    return () => {
      listeners.delete(setView);
      if (listeners.size === 0) {
        window.clearInterval(timer);
        listeners = new Set();
      }
    };
  }, []);
  return view;
}
