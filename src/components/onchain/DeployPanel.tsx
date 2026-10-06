"use client";

import { useEffect, useState } from "react";
import { BRAND, CHAIN, explorerAddress, isAddress } from "@/config/brand";
import { CONTRACTS, LIBRARIES, POOL_DEFAULTS } from "@/config/contracts";
import { useWallet } from "@/components/wallet/WalletProvider";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { simulate, waitReceipt } from "@/lib/pool/client";
import { rpc } from "@/lib/rpc";
import artifacts from "@/lib/onchain/artifacts.json";

/*
 * Owner tool (noindex, not linked): deploys the Oarkel contracts from the
 * connected wallet, in order, links the libraries into the bytecode, and
 * prints the lines to paste into src/config/contracts.ts. No key ever touches
 * the site. Removed once the contracts are deployed and verified.
 */

type Name = "PoseidonT3" | "PoseidonT4" | "ZKTranscriptLib" | "RelationsLib" | "HonkVerifier" | "OarkelPool";
type Art = { creation: string; creationLinks: { lib: string; start: number; length: number }[] };
const ART = (artifacts as unknown as { contracts: Record<Name, Art> }).contracts;

const STEPS: { name: Name; config: string; gas: string; what: string; needsCa?: boolean }[] = [
  { name: "PoseidonT3", config: "POSEIDON_T3", gas: "3.7M", what: "Poseidon hash, 2 inputs (Merkle tree). Library, no state." },
  { name: "PoseidonT4", config: "POSEIDON_T4", gas: "2.8M", what: "Poseidon hash, 3 inputs (note commitments). Library, no state." },
  { name: "ZKTranscriptLib", config: "ZK_TRANSCRIPT_LIB", gas: "1.4M", what: "Proof transcript library of the verifier. No state." },
  { name: "RelationsLib", config: "RELATIONS_LIB", gas: "1.8M", what: "Relation checks library of the verifier. No state." },
  { name: "HonkVerifier", config: "VERIFIER", gas: "3.9M", what: "Checks transact proofs. Its verification key is fixed in the code." },
  { name: "OarkelPool", config: "POOL", gas: "3.1M", what: "The private pool. Needs the $OARKEL address.", needsCa: true },
];

const STORE = "oarkel-deploy-v1";
const configured: Record<Name, string> = {
  PoseidonT3: LIBRARIES.PoseidonT3,
  PoseidonT4: LIBRARIES.PoseidonT4,
  ZKTranscriptLib: LIBRARIES.ZKTranscriptLib,
  RelationsLib: LIBRARIES.RelationsLib,
  HonkVerifier: CONTRACTS.verifier,
  OarkelPool: CONTRACTS.pool,
};

function link(art: Art, addresses: Record<string, string>) {
  let hex = art.creation.slice(2);
  for (const l of art.creationLinks) {
    const a = addresses[l.lib];
    if (!isAddress(a ?? "")) throw new Error(`Deploy ${l.lib} first.`);
    hex = hex.slice(0, l.start * 2) + a.slice(2).toLowerCase() + hex.slice((l.start + l.length) * 2);
  }
  return `0x${hex}`;
}

const word = (n: bigint | number) => BigInt(n).toString(16).padStart(64, "0");
const addrWord = (a: string) => a.slice(2).toLowerCase().padStart(64, "0");

export function DeployPanel() {
  const { address, onRobinhoodChain, switchNetwork, sendTransaction } = useWallet();
  const { open } = useWalletModal();
  const [done, setDone] = useState<Partial<Record<Name, { address: string; block: number; hash: string }>>>({});
  // Earlier steps from this browser (addresses only), read after hydration.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORE);
        if (raw) setDone(JSON.parse(raw));
      } catch {
        // storage unavailable
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const [busy, setBusy] = useState<Name | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feeSink, setFeeSink] = useState("");
  const [decimals, setDecimals] = useState<number | null>(null);

  useEffect(() => {
    if (!isAddress(BRAND.ca)) return;
    rpc<string>("eth_call", [{ to: BRAND.ca, data: "0x313ce567" }, "latest"])
      .then((hex) => setDecimals(Number(BigInt(hex))))
      .catch(() => setDecimals(null));
  }, []);

  const addressOf = (n: Name) => done[n]?.address || configured[n];
  const sink = feeSink || address || "";
  const flatToken = decimals === null ? null : POOL_DEFAULTS.unshroudFeeTokens * 10n ** BigInt(decimals);

  const deploy = async (n: Name) => {
    if (!address) return;
    setError(null);
    setBusy(n);
    try {
      const libs = { PoseidonT3: addressOf("PoseidonT3"), PoseidonT4: addressOf("PoseidonT4"), ZKTranscriptLib: addressOf("ZKTranscriptLib"), RelationsLib: addressOf("RelationsLib") };
      let data = link(ART[n], libs);
      if (n === "OarkelPool") {
        if (!isAddress(BRAND.ca)) throw new Error("Set the real $OARKEL address in src/config/brand.ts first.");
        if (!isAddress(addressOf("HonkVerifier"))) throw new Error("Deploy HonkVerifier first.");
        if (!isAddress(sink)) throw new Error("Enter the fee address.");
        if (flatToken === null) throw new Error(`Could not read ${BRAND.symbol} decimals.`);
        data +=
          addrWord(addressOf("HonkVerifier")) +
          addrWord(BRAND.ca) +
          addrWord(sink) +
          word(POOL_DEFAULTS.shroudFeeBps) +
          word(POOL_DEFAULTS.transferFeeBps) +
          word(POOL_DEFAULTS.unshroudFeeEthWei) +
          word(flatToken);
      }
      await simulate({ from: address, data });
      const hash = await sendTransaction({ data });
      const receipt = await waitReceipt(hash);
      const created = (receipt as unknown as { contractAddress?: string }).contractAddress;
      if (!created) throw new Error("The receipt has no contract address.");
      const next = { ...done, [n]: { address: created, block: Number(BigInt(receipt.blockNumber)), hash } };
      setDone(next);
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        // not saved: the snippet below still shows it
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deployment failed.");
    } finally {
      setBusy(null);
    }
  };

  const lines = STEPS.filter((s) => done[s.name]).map((s) => `const ${s.config} = "${done[s.name]!.address}";`);
  if (done.OarkelPool) lines.push(`const POOL_DEPLOY_BLOCK = ${done.OarkelPool.block};`, `const FEE_SINK = "${sink}";`);

  return (
    <div>
      <p className="label text-fg-3">Owner tool · not linked from the site</p>
      <h1 className="mt-3 font-mono text-[32px] leading-tight font-medium tracking-[-0.02em] text-fg">Deploy the Oarkel contracts</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-2">
        Six transactions from your connected wallet on {CHAIN.name}, in this order. None has an owner or an admin function; once deployed,
        nothing in them can be changed. The first five do not depend on {BRAND.symbol} and can go out now; the pool needs the {BRAND.symbol} address.
        After each step, paste the line it prints into <span className="font-mono">src/config/contracts.ts</span>, then run{" "}
        <span className="font-mono">npm run verify-deployment -- &lt;address&gt; --tx &lt;hash&gt;</span>.
      </p>

      <ol className="mt-6 space-y-3">
        {STEPS.map((s, i) => {
          const live = addressOf(s.name);
          const ready = !s.needsCa || isAddress(BRAND.ca);
          return (
            <li key={s.name} className="tile p-5" data-testid={`step-${s.name}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-[15px] text-fg">
                  {i + 1} · {s.name}
                </p>
                <span className="text-[12.5px] text-fg-3">about {s.gas} gas</span>
              </div>
              <p className="mt-1 text-[13.5px] text-fg-2">{s.what}</p>
              {s.name === "OarkelPool" ? (
                <div className="mt-3 space-y-2 text-[13.5px] text-fg-2">
                  <p>
                    Constructor: verifier <span className="font-mono">{addressOf("HonkVerifier") || "(step 5)"}</span>, token{" "}
                    <span className="font-mono">{isAddress(BRAND.ca) ? BRAND.ca : "(CA not set yet)"}</span>, shroud fee {POOL_DEFAULTS.shroudFeeBps / 100}%, transfer
                    fee {POOL_DEFAULTS.transferFeeBps / 100}%, unshroud fee 0.0005 ETH / {POOL_DEFAULTS.unshroudFeeTokens.toString()} {BRAND.ticker}.
                  </p>
                  <label className="block">
                    <span>Fee address (receives the ETH fees; fixed forever). Defaults to this wallet.</span>
                    <input value={feeSink} onChange={(e) => setFeeSink(e.target.value.trim())} placeholder={address ?? "0x…"} className="field mt-1 font-mono text-[13px]" />
                  </label>
                </div>
              ) : null}
              {isAddress(live ?? "") ? (
                <p className="mt-3 font-mono text-[13px] break-all text-up">
                  Deployed:{" "}
                  <a href={explorerAddress(live)} target="_blank" rel="noreferrer" className="underline">
                    {live}
                  </a>
                </p>
              ) : !address ? (
                <button type="button" onClick={open} className="btn-ink mt-3 h-10 rounded-full px-5 font-mono text-[13px]">
                  Connect wallet
                </button>
              ) : !onRobinhoodChain ? (
                <button type="button" onClick={switchNetwork} className="btn-ink mt-3 h-10 rounded-full px-5 font-mono text-[13px]">
                  Switch to {CHAIN.name}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(busy) || !ready}
                  onClick={() => deploy(s.name)}
                  className="btn-ink mt-3 h-10 rounded-full px-5 font-mono text-[13px]"
                  data-testid={`deploy-${s.name}`}
                >
                  {busy === s.name ? "Confirm in wallet, then wait…" : ready ? `Deploy ${s.name}` : "After the CA"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {error ? <p className="mt-4 text-[14px] text-down">{error}</p> : null}
      {lines.length ? (
        <div className="mt-6 tile p-5" data-testid="deploy-snippet">
          <p className="text-[14px] text-fg">Paste into src/config/contracts.ts:</p>
          <pre className="mt-2 overflow-x-auto rounded bg-card-2 p-3 font-mono text-[12px] text-fg">{lines.join("\n")}</pre>
          <p className="mt-2 text-[12.5px] text-fg-3">Deployment transactions: {STEPS.filter((s) => done[s.name]).map((s) => `${s.name} ${done[s.name]!.hash}`).join(" · ")}</p>
        </div>
      ) : null}
    </div>
  );
}
