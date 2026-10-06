"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/Mark";
import { PracticeTag } from "@/components/ui";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { usePractice } from "@/components/app/PracticeProvider";
import { CHAIN } from "@/config/brand";

const TABS = [
  { href: "/app", label: "Overview" },
  { href: "/app/shroud", label: "Shroud" },
  { href: "/app/unshroud", label: "Unshroud" },
  { href: "/app/send", label: "Send" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <main id="main" className="wrap py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="display text-[30px] leading-none md:text-[36px]">Private pool</h1>
          <PracticeTag />
        </div>
        <p className="num text-[12.5px] text-fg-3">
          {CHAIN.name} · chain id {CHAIN.id}
        </p>
      </div>
      <nav aria-label="App" className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14.5px] whitespace-nowrap transition-colors ${
                active ? "border-surge font-semibold text-fg" : "border-transparent text-fg-2 hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8">
        <Gate>{children}</Gate>
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
        <Mark size={44} className="text-surge" />
        <p className="display mt-5 text-[30px] leading-tight">Your balance, kept off the record.</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">
          Connect a wallet to open a practice account. You will try every step with practice balances; nothing is sent on chain.
        </p>
        <button type="button" onClick={open} className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold">
          Connect wallet
        </button>
        <Link href="/docs/get-started" className="link mt-4 text-[14px] text-fg-2">
          How the practice app works
        </Link>
      </Card>
    );
  }
  if (chainId !== null && !onRobinhoodChain) {
    return (
      <Card>
        <p className="display text-[28px] leading-tight">Switch to {CHAIN.name}</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">Your wallet is on chain {chainId}. The app reads balances from {CHAIN.name}.</p>
        <button
          type="button"
          onClick={switchNetwork}
          disabled={switching}
          className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold"
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
        <p className="display text-[28px] leading-tight">Practice is not configured on this site yet</p>
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
        <p className="display text-[30px] leading-tight">Open a practice account</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">
          One free signature opens it with 1 practice ETH and 50,000 practice OARKEL in your public practice balance. They have no value
          and exist only on this site.
        </p>
        <button
          type="button"
          onClick={() => act("join")}
          disabled={Boolean(busy)}
          className="btn-surge mt-6 inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold"
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

function Card({ children }: { children: React.ReactNode }) {
  return <div className="sheet ruled mx-auto flex max-w-xl flex-col items-center px-6 py-12 text-center">{children}</div>;
}
