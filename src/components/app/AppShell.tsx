"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SlatMark } from "@/components/Mark";
import { PracticeTag } from "@/components/ui";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { usePractice } from "@/components/app/PracticeProvider";
import { CHAIN } from "@/config/brand";
import { APP_NAV } from "@/components/site";
import { poolLive } from "@/config/contracts";
import { PoolGate } from "@/components/app/pool/PoolGate";

const TABS = APP_NAV;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <main id="main" className="mx-auto w-full max-w-[1000px] px-4 pt-[104px] pb-20 md:pt-[132px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-mono text-[15px] font-medium tracking-[-0.01em] text-fg">Private pool</h1>
          {poolLive() ? <LiveTag /> : <PracticeTag />}
        </div>
        <p className="font-mono text-[11.5px] text-fg-3">
          {CHAIN.name} · chain id {CHAIN.id}
        </p>
      </div>
      <nav aria-label="App sections" className="no-scrollbar -mx-4 mt-5 flex gap-1 overflow-x-auto px-4 lg:hidden">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-[12px] whitespace-nowrap transition-colors ${
                active ? "bg-white/10 text-fg" : "text-fg-2 hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8">
        {poolLive() ? <PoolGate>{children}</PoolGate> : <Gate>{children}</Gate>}
      </div>
    </main>
  );
}

/** Wallet, network, storage and account checks before any practice screen. */
function Gate({ children }: { children: React.ReactNode }) {
  const { address, chainId, onRobinhoodChain, switchNetwork, switching } = useWallet();
  const { open } = useWalletModal();
  const { loaded, configured, view, act, busy, error } = usePractice();

  if (!address) {
    return (
      <Card>
        <SlatMark id="gate" size={40} className="text-fg" />
        <p className="mt-6 text-[18px] text-fg">your balance, kept off the record.</p>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-fg-2">
          Connect a wallet to open a practice account. You will try every step with practice balances; nothing is sent on chain.
        </p>
        <button type="button" onClick={open} className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]">
          connect wallet
        </button>
        <Link href="/docs/get-started" className="mt-4 text-[14px] text-fg-2 transition-colors hover:text-fg">
          how the practice app works
        </Link>
      </Card>
    );
  }
  if (chainId !== null && !onRobinhoodChain) {
    return (
      <Card>
        <p className="font-mono text-[20px] leading-tight font-medium tracking-[-0.02em]">Switch to {CHAIN.name}</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">Your wallet is on chain {chainId}. The app reads balances from {CHAIN.name}.</p>
        <button
          type="button"
          onClick={switchNetwork}
          disabled={switching}
          className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]"
        >
          {switching ? "Confirm in wallet…" : `Switch to ${CHAIN.name}`}
        </button>
      </Card>
    );
  }
  if (!loaded) {
    return (
      <Card>
        <p className="text-[15px] text-fg-3">Loading your practice account…</p>
      </Card>
    );
  }
  if (configured === false) {
    return (
      <Card>
        <p className="font-mono text-[20px] leading-tight font-medium tracking-[-0.02em]">Practice is not configured on this site yet</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">
          The practice pool needs a storage service that has not been set up on this deployment. Wallet connection and live chain data
          still work everywhere else on the site.
        </p>
      </Card>
    );
  }
  if (!view?.account) {
    return (
      <Card>
        <p className="font-mono text-[20px] leading-tight font-medium tracking-[-0.02em]">Open a practice account</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">
          One free signature opens it with 1 practice ETH and 50,000 practice OARKEL in your public practice balance. They have no value
          and exist only on this site.
        </p>
        <button
          type="button"
          onClick={() => act("join")}
          disabled={Boolean(busy)}
          className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]"
          data-testid="join"
        >
          {busy ?? "Open practice account"}
        </button>
        {error ? <p className="mt-4 text-[14px] text-down">{error}</p> : null}
      </Card>
    );
  }
  return <>{children}</>;
}

function LiveTag() {
  return <span className="label inline-flex items-center gap-1.5 rounded-full bg-up/10 px-2 py-0.5 text-[10.5px] text-up">Live on chain</span>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex max-w-[448px] flex-col items-center rounded-[14px] border border-line-2 bg-paper px-6 py-10 text-center">{children}</div>;
}
