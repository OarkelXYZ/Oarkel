"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";

/*
 * The visitor's practice account and the one way to change it: ask the
 * server for a one-time message, sign it in the wallet (personal_sign, free,
 * no transaction), send the signature back. Nothing else can move practice
 * balances.
 */

export type Asset = "eth" | "oarkel";
export type NoteView = { id: string; asset: Asset; origin: "shroud" | "received" | "change"; createdAt: number; value: number; shares: string | null };
export type PracticeView = {
  configured: boolean;
  account: { address: string; createdAt: number; eth: number; oarkel: number } | null;
  notes: NoteView[];
  private: Record<Asset, number>;
  vault: { backing: number; shares: string; pricePerShare: number; fees: number; donations: number };
  stats: { accounts: number; shrouds: number; transfers: number; unshrouds: number };
  activity: { t: number; kind: string; text: string }[];
  canTopUp: boolean;
  rules: {
    shroudBps: number;
    transferBps: number;
    unshroudFlat: Record<Asset, number>;
    relayerFee: Record<Asset, number>;
    min: Record<Asset, number>;
    oarkelPerEth: number;
  };
};

type Practice = {
  loaded: boolean;
  configured: boolean | null;
  view: PracticeView | null;
  busy: string | null;
  error: string | null;
  notice: string | null;
  act: (action: string, params?: Record<string, unknown>) => Promise<boolean>;
  refresh: () => void;
  clear: () => void;
};

const Ctx = createContext<Practice | null>(null);

export function PracticeProvider({ children }: { children: React.ReactNode }) {
  const { address, signMessage } = useWallet();
  const [view, setView] = useState<PracticeView | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () => {
      fetch(`/api/practice/account?address=${address}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((body) => {
          if (cancelled) return;
          setConfigured(body.configured !== false);
          setView(body.configured === false ? null : (body as PracticeView));
          setLoadedFor(address);
        })
        .catch(() => {});
    };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [address, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const act = useCallback(
    async (action: string, params: Record<string, unknown> = {}) => {
      if (!address) {
        setError("Connect a wallet first.");
        return false;
      }
      setError(null);
      setNotice(null);
      setBusy("Preparing…");
      try {
        const intent = await fetch("/api/practice/intent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address, action, params }),
        });
        const prepared = (await intent.json()) as { nonce?: string; message?: string; error?: string };
        if (!intent.ok || !prepared.nonce || !prepared.message) {
          throw new Error(prepared.error === "not_configured" ? "Practice is not configured on this site yet." : prepared.error || "Could not prepare that.");
        }
        setBusy("Sign in your wallet…");
        const signature = await signMessage(prepared.message);
        setBusy("Recording…");
        const res = await fetch("/api/practice/act", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nonce: prepared.nonce, signature }),
        });
        const body = (await res.json()) as { ok?: boolean; summary?: string; error?: string };
        if (!res.ok || !body.ok) throw new Error(body.error || "That did not go through.");
        setNotice(body.summary ?? "Done");
        return true;
      } catch (cause) {
        const code = (cause as { code?: number })?.code;
        setError(code === 4001 ? "The signature was declined in the wallet." : cause instanceof Error ? cause.message : "That did not go through.");
        return false;
      } finally {
        setBusy(null);
        setTick((n) => n + 1);
      }
    },
    [address, signMessage],
  );

  const clear = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const current = address && loadedFor === address ? view : null;
  const value: Practice = {
    loaded: Boolean(address && loadedFor === address),
    configured: address ? configured : null,
    view: current,
    busy,
    error,
    notice,
    act,
    refresh,
    clear,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePractice() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePractice must be used inside PracticeProvider");
  return ctx;
}
