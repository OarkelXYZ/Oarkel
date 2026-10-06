"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/app/AppShell";
import { SlatMark } from "@/components/Mark";
import { usePool } from "@/components/app/pool/PoolProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, CHAIN } from "@/config/brand";

/** Wallet, network and note keys before any real pool screen. */
export function PoolGate({ children }: { children: React.ReactNode }) {
  const { address, chainId, onRobinhoodChain, switchNetwork, switching } = useWallet();
  const { open } = useWalletModal();
  const { keys, unlock, unlocking, error } = usePool();
  const [passphrase, setPassphrase] = useState("");
  const [withPassphrase, setWithPassphrase] = useState(false);

  if (!address) {
    return (
      <Card>
        <SlatMark id="gate" size={40} className="text-fg" />
        <p className="mt-6 text-[18px] text-fg">your balance, kept off the record.</p>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-fg-2">Connect a wallet to shroud, send and unshroud on {CHAIN.name}.</p>
        <button type="button" onClick={open} className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]">
          connect wallet
        </button>
      </Card>
    );
  }
  if (chainId !== null && !onRobinhoodChain) {
    return (
      <Card>
        <p className="font-mono text-[20px] leading-tight font-medium tracking-[-0.02em]">Switch to {CHAIN.name}</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-fg-2">Your wallet is on chain {chainId}. The pool lives on {CHAIN.name}.</p>
        <button type="button" onClick={switchNetwork} disabled={switching} className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]">
          {switching ? "Confirm in wallet…" : `Switch to ${CHAIN.name}`}
        </button>
      </Card>
    );
  }
  if (!keys) {
    return (
      <Card>
        <p className="font-mono text-[20px] leading-tight font-medium tracking-[-0.02em]">Unlock your notes</p>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-fg-2">
          Your wallet signs a sign-in message for {BRAND.domain}. The signature becomes the keys that own and read your private notes. It is
          not a transaction, costs nothing and never leaves this tab.
        </p>
        <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-down">
          This signature controls your private funds. Sign it only on {BRAND.domain}; your wallet should show that domain.
        </p>
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-left text-[14px]">
          <input type="checkbox" checked={withPassphrase} onChange={(e) => setWithPassphrase(e.target.checked)} className="mt-1 size-4 accent-[var(--color-fg)]" />
          <span>
            <span className="font-semibold">Add a passphrase</span>
            <span className="block text-[12.5px] text-fg-3">
              Mixed into your keys, so a signature alone cannot spend. If you forget it, notes made with it cannot be recovered by anyone.
            </span>
          </span>
        </label>
        {withPassphrase ? (
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            autoComplete="off"
            className="field mt-3 w-full text-[14px]"
            aria-label="Passphrase"
            data-testid="passphrase"
          />
        ) : null}
        <button
          type="button"
          onClick={() => unlock(withPassphrase ? passphrase : "")}
          disabled={unlocking || (withPassphrase && passphrase.length < 8)}
          className="btn-ink mt-6 inline-flex h-11 items-center rounded-full px-6 font-mono text-[14px]"
          data-testid="unlock"
        >
          {unlocking ? "Sign in your wallet…" : "Sign to unlock"}
        </button>
        {withPassphrase && passphrase.length > 0 && passphrase.length < 8 ? <p className="mt-2 text-[12.5px] text-fg-3">At least 8 characters.</p> : null}
        {error ? <p className="mt-4 text-[14px] text-down">{error}</p> : null}
        <Link href="/docs/keys" className="mt-4 text-[14px] text-fg-2 transition-colors hover:text-fg">
          how keys work
        </Link>
      </Card>
    );
  }
  return <>{children}</>;
}
