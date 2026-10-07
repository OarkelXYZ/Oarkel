"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowSquareOut, ArrowsClockwise, Check, Copy } from "@phosphor-icons/react";
import { AssetPick, Explainer, Panel, Row, Summary, formFrame } from "@/components/app/Screens";
import { assetId, bpsFee, formatUnitsShort, usePool, type Asset } from "@/components/app/pool/PoolProvider";
import { Redact } from "@/components/ui";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, CHAIN, explorerAddress, shortAddress } from "@/config/brand";
import { CONTRACTS, explorerTx } from "@/config/contracts";
import { sharesForAtMost, valueOfShares } from "@/lib/pool/client";
import { parseUnits } from "@/lib/pons";
import { transferFeeFor } from "@/lib/zk/plan";

const NAME: Record<Asset, string> = { eth: "ETH", oarkel: BRAND.ticker };

function useUnits() {
  const { params } = usePool();
  const dec = (a: Asset) => (a === "eth" ? 18 : (params?.decimals ?? 18));
  const show = (a: Asset, v: bigint, digits = 6) => `${formatUnitsShort(v, dec(a), digits)} ${NAME[a]}`;
  return { dec, show };
}

function TxLink({ hash }: { hash?: string }) {
  if (!hash) return null;
  return (
    <a href={explorerTx(hash)} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 underline underline-offset-2" data-testid="tx-link">
      view transaction <ArrowSquareOut size={12} />
    </a>
  );
}

function Status() {
  const { busy, error, notice } = usePool();
  if (busy) return <p className="mt-4 text-[14px] text-fg-2" role="status" data-testid="busy">{busy}</p>;
  if (error) return <p className="mt-4 rounded-[8px] bg-down/10 px-3 py-2 text-[14px] text-down" role="alert">{error}</p>;
  if (notice)
    return (
      <p className="mt-4 rounded-[8px] bg-up/10 px-3 py-2 text-[14px] text-up" role="status" data-testid="notice">
        {notice.text}
        <TxLink hash={notice.tx} />
      </p>
    );
  return null;
}

function AmountField({ asset, text, setText, max }: { asset: Asset; text: string; setText: (s: string) => void; max: bigint }) {
  const { dec } = useUnits();
  return (
    <label className="block">
      <span className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="text-fg-2">Amount</span>
        <button type="button" onClick={() => setText(formatUnitsShort(max, dec(asset), 18))} className="num text-[13px] text-fg-3 hover:text-fg">
          Available {formatUnitsShort(max, dec(asset), 6)} {NAME[asset]} · max
        </button>
      </span>
      <input
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value.replace(",", "."))}
        placeholder="0.0"
        className="field num mt-2 text-[22px]"
        data-testid="amount"
      />
    </label>
  );
}

function GasNote() {
  return (
    <p className="mt-4 text-[13px] leading-relaxed text-fg-3">
      Your connected wallet submits this transaction and pays the gas in ETH, so it shows as the sender. The proof hides which notes are spent.
    </p>
  );
}

/* ------------------------------------------------------------- Overview */

export function RealOverview() {
  const pool = usePool();
  const { balance } = useWallet();
  const { show } = useUnits();
  const [reveal, setReveal] = useState(true);
  const { state, notes } = pool;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 grid-cols-1 gap-5">
        <Panel
          title="Private balance"
          aside={
            <button type="button" onClick={() => setReveal((r) => !r)} className="text-[13px] text-fg-2 underline-offset-2 hover:underline">
              {reveal ? "Hide numbers" : "Show numbers"}
            </button>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {(["eth", "oarkel"] as Asset[]).map((a) => (
              <div key={a} className="flute min-w-0 rounded-[4px] border border-line-2 bg-card px-4 py-4 text-fg">
                <p className="label text-fg-2">Shrouded {NAME[a]}</p>
                <p className="num mt-2 truncate text-[26px]" data-testid={`private-${a}`}>
                  {!pool.synced ? "…" : reveal ? formatUnitsShort(pool.privateBalance(a), a === "eth" ? 18 : (pool.params?.decimals ?? 18), 4) : <Redact w={8} />}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-fg-3">
            Worked out on this device from notes only your keys can open. On chain they are commitments that nobody else can read.
          </p>
        </Panel>

        <Panel title={`Notes (${notes.length})`} aside={pool.syncing ? <span className="text-[12.5px] text-fg-3">syncing…</span> : null}>
          {notes.length === 0 ? (
            <p className="text-[14.5px] text-fg-2">
              {pool.synced ? (
                <>
                  No notes yet. <Link href="/app/shroud" className="link font-semibold text-fg">Shroud ETH or {BRAND.ticker}</Link> to create your first
                  one.
                </>
              ) : (
                "Reading the pool…"
              )}
            </p>
          ) : (
            <ul className="divide-y divide-line" data-testid="notes">
              {[...notes]
                .sort((a, b) => b.index - a.index)
                .map((n) => {
                  const a: Asset = n.asset === 0 ? "eth" : "oarkel";
                  return (
                    <li key={n.index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5 text-[14px]">
                      <span className="min-w-0">
                        <span className="num block truncate text-fg">Note #{n.index}</span>
                        <span className="text-[12.5px] text-fg-3">
                          {n.origin === "shroud" ? "Shrouded" : "Received or change"} · block {n.block.toLocaleString("en-US")}
                          <TxLink hash={n.tx} />
                        </span>
                      </span>
                      <span className="num text-right text-fg">{reveal ? show(a, pool.noteWorth(n), 6) : <Redact w={6} />}</span>
                    </li>
                  );
                })}
            </ul>
          )}
          {(["eth", "oarkel"] as Asset[]).some((a) => notes.filter((n) => n.asset === assetId(a)).length > 2) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {(["eth", "oarkel"] as Asset[])
                .filter((a) => notes.filter((n) => n.asset === assetId(a)).length > 2)
                .map((a) => (
                  <button key={a} type="button" disabled={Boolean(pool.busy)} onClick={() => pool.merge(a)} className="btn-ghost inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px]">
                    Merge two {NAME[a]} notes
                  </button>
                ))}
            </div>
          ) : null}
          <Status />
        </Panel>
      </div>

      <div className="grid min-w-0 grid-cols-1 content-start gap-5">
        <Panel title="Public balance">
          <Row k={`ETH on ${CHAIN.name}`} v={balance === null ? "…" : `${balance}`} />
          <Row k={BRAND.ticker} v={pool.publicToken === null ? "…" : show("oarkel", pool.publicToken, 4)} />
        </Panel>
        <Panel title="Fee vault" aside={<span className="text-[12.5px] text-fg-3">live, on chain</span>}>
          <Row k="Share price (1.0 at launch)" v={state ? show("oarkel", valueOfShares(state, 1_000_000n * 10n ** BigInt(pool.params?.decimals ?? 18)), 8) : "…"} strong />
          <Row k="Vault backing" v={state ? show("oarkel", state.backing, 2) : "…"} />
          <Row k="ETH fees waiting" v={state ? show("eth", state.ethFees, 6) : "…"} />
          <Row k="Notes in the pool" v={state ? state.leaves.toLocaleString("en-US") : "…"} />
          <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">
            Shrouded {BRAND.ticker} notes hold vault shares: every {BRAND.ticker} fee and donation raises what a share is worth. ETH fees go to
            the fee address fixed in the contract.
          </p>
        </Panel>
        <Panel title="Contract">
          <Row
            k="OarkelPool"
            v={
              <a href={explorerAddress(CONTRACTS.pool)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {shortAddress(CONTRACTS.pool)}
              </a>
            }
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">The contract has no owner and no admin function. Its fees were fixed when it was deployed.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Shroud */

export function RealShroud() {
  const pool = usePool();
  const { balance } = useWallet();
  const { dec, show } = useUnits();
  const [asset, setAsset] = useState<Asset>("eth");
  const [text, setText] = useState("");
  const amount = text ? parseUnits(text, dec(asset)) : null;
  const ethWei = balance ? (parseUnits(balance, 18) ?? 0n) : 0n;
  const available = asset === "eth" ? ethWei : (pool.publicToken ?? 0n);
  const bps = pool.params?.shroudFeeBps ?? 25n;
  const fee = amount ? bpsFee(amount, bps) : 0n;
  const problem = !text ? null : !amount ? "Enter a number." : amount > available ? "More than your public balance." : fee >= amount ? "Too small." : null;
  const net = amount ? amount - fee : 0n;
  return formFrame(
    "Shroud",
    `Move ${NAME[asset]} from this wallet into a private note.`,
    <>
      <AssetPick value={asset} onChange={setAsset} />
      <div className="mt-5">
        <AmountField asset={asset} text={text} setText={setText} max={available} />
      </div>
      <Summary
        rows={[
          [`Shroud fee (${Number(bps) / 100}%)`, amount ? show(asset, fee) : "–"],
          ["New private note", amount ? (asset === "eth" ? show(asset, net) : `${show(asset, net)} in vault shares`) : "–"],
          ["Visible on chain", "this address and the amount"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || Boolean(problem) || Boolean(pool.busy) || !pool.synced}
        onClick={async () => {
          if (amount && (await pool.shroud(asset, amount))) setText("");
        }}
        className="btn-ink mt-5 h-12 w-full rounded-full font-mono text-[14px]"
        data-testid="submit"
      >
        {pool.busy ?? `Shroud ${NAME[asset]}`}
      </button>
      <Status />
    </>,
    <Explainer
      title="What shrouding does"
      points={[
        "The deposit is public: anyone can see this address put value into the pool.",
        `From here the value is a note. ${BRAND.ticker} notes hold vault shares, so they grow as fees arrive.`,
        asset === "oarkel" ? `The first ${BRAND.ticker} shroud asks for an approval, then the shroud itself: two transactions.` : "One transaction from your wallet.",
      ]}
    />,
  );
}

/* ------------------------------------------------------------- Unshroud */

export function RealUnshroud() {
  const pool = usePool();
  const { address } = useWallet();
  const { dec, show } = useUnits();
  const [asset, setAsset] = useState<Asset>("eth");
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  if (!address) return null;
  const amount = text ? parseUnits(text, dec(asset)) : null;
  const flat = asset === "eth" ? (pool.params?.unshroudFeeEth ?? 0n) : (pool.params?.unshroudFeeToken ?? 0n);
  const available = pool.privateBalance(asset);
  const maxOut = available > flat ? available - flat : 0n;
  const dest = (to.trim() || address).toLowerCase();
  const validTo = /^0x[0-9a-f]{40}$/.test(dest);
  const problem = !text ? null : !amount ? "Enter a number." : amount > maxOut ? "More than your private balance after fees." : !validTo ? "Enter a full 0x address." : null;
  return formFrame(
    "Unshroud",
    "Withdraw from your private notes to any address. Leave the address empty to withdraw to this wallet.",
    <>
      <AssetPick value={asset} onChange={setAsset} />
      <div className="mt-5">
        <AmountField asset={asset} text={text} setText={setText} max={maxOut} />
      </div>
      <label className="mt-4 block">
        <span className="text-[14px] text-fg-2">Recipient address</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={address} className="field num mt-2 text-[14px]" data-testid="to" />
      </label>
      <GasNote />
      <Summary
        rows={[
          ["Unshroud fee (flat)", show(asset, flat)],
          ["Recipient gets at least", amount ? show(asset, amount) : "–"],
          ["Visible on chain", "recipient and amount, not the note"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || Boolean(problem) || Boolean(pool.busy) || !pool.synced}
        onClick={async () => {
          if (amount && (await pool.unshroud(asset, amount, dest))) setText("");
        }}
        className="btn-ink mt-5 h-12 w-full rounded-full font-mono text-[14px]"
        data-testid="submit"
      >
        {pool.busy ?? `Unshroud ${NAME[asset]}`}
      </button>
      <Status />
    </>,
    <Explainer
      title="Before you exit"
      points={[
        "The proof is made on this device; it takes a few seconds and nothing about your notes leaves the browser.",
        "Withdrawing to the same address that deposited links the two ends. A fresh address does not.",
        "Round amounts blend in with other exits; exact ones stand out.",
      ]}
    />,
  );
}

/* ------------------------------------------------------------- Send */

export function RealSend() {
  const pool = usePool();
  const { dec, show } = useUnits();
  const [asset, setAsset] = useState<Asset>("oarkel");
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const amount = text ? parseUnits(text, dec(asset)) : null;
  const bps = pool.params?.transferFeeBps ?? 10n;
  const fee = amount ? (asset === "eth" ? transferFeeFor(amount, bps) : pool.state ? transferFeeFor(sharesForAtMost(pool.state, amount), bps) : 0n) : 0n;
  const feeShown = asset === "eth" ? fee : pool.state ? valueOfShares(pool.state, fee) : 0n;
  const available = pool.privateBalance(asset);
  const dest = to.trim();
  const problem = !text
    ? null
    : !amount
      ? "Enter a number."
      : amount + feeShown > available
        ? "More than your private balance after fees."
        : dest && !/^oarkel:[0-9a-fA-F]{128}$/.test(dest)
          ? "Enter a private address (oarkel:…)."
          : dest && dest === pool.privateAddress
            ? "That is your own private address."
            : null;
  return formFrame(
    "Send privately",
    "Pay another private address from your notes. They receive a new note; nothing on chain links it to you.",
    <>
      <AssetPick value={asset} onChange={setAsset} />
      <div className="mt-5">
        <AmountField asset={asset} text={text} setText={setText} max={(available * 10_000n) / (10_000n + bps)} />
      </div>
      <label className="mt-4 block">
        <span className="text-[14px] text-fg-2">Recipient private address (from their Settings page)</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="oarkel:…" className="field num mt-2 text-[14px]" data-testid="to" />
      </label>
      <GasNote />
      <Summary
        rows={[
          [`Transfer fee (${Number(bps) / 100}%)`, amount ? show(asset, feeShown) : "–"],
          ["Recipient gets a note of", amount ? show(asset, amount) : "–"],
          ["Visible on chain", "that a transfer happened"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || !dest || Boolean(problem) || Boolean(pool.busy) || !pool.synced}
        onClick={async () => {
          if (amount && (await pool.send(asset, amount, dest))) setText("");
        }}
        className="btn-ink mt-5 h-12 w-full rounded-full font-mono text-[14px]"
        data-testid="submit"
      >
        {pool.busy ?? "Send privately"}
      </button>
      <Status />
    </>,
    <Explainer
      title="How a private payment looks"
      points={[
        "Your notes are spent and two new ones appear: one for the recipient, one for your change.",
        "Outside the pool, observers see spent nullifiers and new commitments, nothing else.",
        `The fee is ${Number(bps) / 100}% of what goes to another key; moving value between your own notes is free.`,
      ]}
    />,
  );
}

/* ------------------------------------------------------------- Activity + settings */

export function RealActivity() {
  const pool = usePool();
  const { show } = useUnits();
  const created = [...pool.notes, ...pool.spent].sort((a, b) => b.index - a.index);
  return (
    <div className="grid grid-cols-1 gap-5">
      <Panel title="This session" aside={<span className="text-[12.5px] text-fg-3">kept in memory only</span>}>
        {pool.activity.length === 0 ? (
          <p className="text-[14.5px] text-fg-2">Nothing yet in this session.</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="activity">
            {pool.activity.map((a, i) => (
              <li key={i} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
                <span className="label pt-0.5 text-fg-3">{a.kind}</span>
                <span className="min-w-0 text-[14.5px] break-words">
                  {a.text}
                  <TxLink hash={a.tx} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Your notes, from the chain" aside={<span className="text-[12.5px] text-fg-3">found with your viewing key</span>}>
        {created.length === 0 ? (
          <p className="text-[14.5px] text-fg-2">{pool.synced ? "No notes found for these keys." : "Reading the pool…"}</p>
        ) : (
          <ul className="divide-y divide-line">
            {created.map((n) => {
              const a: Asset = n.asset === 0 ? "eth" : "oarkel";
              const isSpent = pool.spent.includes(n);
              return (
                <li key={n.index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <span className="block text-fg">
                      Note #{n.index} · {n.origin === "shroud" ? "shrouded" : "received or change"}
                      {isSpent ? " · spent" : ""}
                    </span>
                    <span className="text-[12.5px] text-fg-3">
                      block {n.block.toLocaleString("en-US")}
                      <TxLink hash={n.tx} />
                    </span>
                  </span>
                  <span className={`num text-right ${isSpent ? "text-fg-3 line-through" : "text-fg"}`}>{show(a, pool.noteWorth(n), 6)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function RealSettings() {
  const pool = usePool();
  const { address, walletName, disconnect } = useWallet();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      // clipboard refused
    }
  };
  if (!address) return null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Your private address">
        <p className="text-[14px] leading-relaxed text-fg-2">Share this to receive private payments. It reveals nothing about your wallet or your balance.</p>
        <p className="num mt-3 rounded-[8px] bg-card-2 p-3 text-[12.5px] break-all text-fg" data-testid="private-address">
          {pool.privateAddress}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => pool.privateAddress && copy(pool.privateAddress, "private")} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-mono text-[12px]">
            {copied === "private" ? <Check size={14} /> : <Copy size={14} />} {copied === "private" ? "Copied" : "Copy private address"}
          </button>
          <button type="button" onClick={pool.lock} className="btn-ghost inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px]">
            Lock notes
          </button>
        </div>
      </Panel>
      <Panel title="Wallet">
        <Row k="Wallet" v={walletName ?? "Wallet"} />
        <Row k="Address" v={<span className="break-all">{shortAddress(address, 10, 8)}</span>} />
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px]">
            View on explorer
          </a>
          <button type="button" onClick={pool.refresh} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-mono text-[12px]">
            <ArrowsClockwise size={14} /> Refresh
          </button>
          <button type="button" onClick={disconnect} className="inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px] text-down hover:bg-down/10">
            Disconnect
          </button>
        </div>
      </Panel>
      <Panel title="Gas">
        <p className="text-[14px] leading-relaxed text-fg-2">
          Every shroud, private send, merge and unshroud is sent from this wallet, which pays the gas in ETH. There is no relayer and no extra fee.
        </p>
        <p className="mt-2 text-[12.5px] text-fg-3">
          This wallet shows on chain as the sender of each of those transactions. The proof still hides which notes are spent, and an
          unshroud can pay out to any address you choose.
        </p>
      </Panel>
      <Panel title="Keys">
        <div className="space-y-3 text-[14.5px] leading-relaxed text-fg-2">
          <p>
            Your note keys come from one signature of a sign-in message for {BRAND.domain}, plus your passphrase if you set one. They are held in
            this tab&apos;s memory only and are gone when you reload or lock.
          </p>
          <p>
            Signing the same message with the same wallet (and the same passphrase) on any device restores them. Never sign it on another site.{" "}
            <Link href="/docs/keys" className="link text-fg">How keys work</Link>.
          </p>
        </div>
      </Panel>
      <Panel title="Pool rates (fixed in the contract)">
        <Rates />
      </Panel>
    </div>
  );
}

function Rates() {
  const { params } = usePool();
  const { show } = useUnits();
  if (!params) return <p className="text-[14px] text-fg-3">Loading…</p>;
  return (
    <>
      <Row k="Shroud fee" v={`${Number(params.shroudFeeBps) / 100}%`} />
      <Row k="Private transfer fee" v={`${Number(params.transferFeeBps) / 100}%`} />
      <Row k="Unshroud fee (flat)" v={`${show("eth", params.unshroudFeeEth)} · ${show("oarkel", params.unshroudFeeToken, 2)}`} />
    </>
  );
}
