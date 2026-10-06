"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowsClockwise, Check, Copy } from "@phosphor-icons/react";
import { usePractice, type Asset, type PracticeView } from "@/components/app/PracticeProvider";
import { useChain } from "@/components/chain/useChain";
import { Redact } from "@/components/ui";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, CHAIN, explorerAddress, shortAddress } from "@/config/brand";

const MICRO = 1_000_000;
const NAME: Record<Asset, string> = { eth: "ETH", oarkel: BRAND.ticker };

const fmt = (micro: number, digits = 4) => (micro / MICRO).toLocaleString("en-US", { maximumFractionDigits: digits });

/** "1.25" → 1250000 micro units; null when it is not a plain positive number with up to 6 decimals. */
function toMicro(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  const n = Number(w) * MICRO + Number(f.padEnd(6, "0"));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const ago = (t: number) => {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 172800) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function Status() {
  const { busy, error, notice } = usePractice();
  if (busy) return <p className="mt-4 text-[14px] text-fg-2" role="status">{busy}</p>;
  if (error) return <p className="mt-4 rounded-[8px] bg-down/10 px-3 py-2 text-[14px] text-down" role="alert">{error}</p>;
  if (notice) return <p className="mt-4 rounded-[8px] bg-up/10 px-3 py-2 text-[14px] text-up" role="status" data-testid="notice">{notice}</p>;
  return null;
}

function AssetPick({ value, onChange }: { value: Asset; onChange: (a: Asset) => void }) {
  return (
    <div role="radiogroup" aria-label="Asset" className="inline-grid grid-cols-2 rounded-full bg-card-2 p-1">
      {(["eth", "oarkel"] as Asset[]).map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={value === a}
          onClick={() => onChange(a)}
          className={`rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors ${value === a ? "bg-fg text-paper" : "text-fg-2 hover:text-fg"}`}
        >
          {NAME[a]}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="tile min-w-0 p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ k, v, strong = false }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[14.5px] last:border-b-0">
      <span className="text-fg-3">{k}</span>
      <span className={`num text-right ${strong ? "font-semibold text-fg" : "text-fg"}`}>{v}</span>
    </div>
  );
}

/* ------------------------------------------------------------- Overview */

export function Overview() {
  const { view, act, busy } = usePractice();
  const { balance } = useWallet();
  const chain = useChain();
  const [reveal, setReveal] = useState(true);
  if (!view?.account) return null;
  const v = view;
  const acct = view.account;
  const perShare = v.vault.pricePerShare / MICRO;
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
              <div key={a} className="min-w-0 rounded-[10px] bg-fg px-4 py-4 text-paper">
                <p className="label text-paper/60">Shrouded {NAME[a]}</p>
                <p className="num mt-2 truncate text-[26px]" data-testid={`private-${a}`}>
                  {reveal ? fmt(v.private[a]) : <Redact w={8} className="bg-paper" />}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-fg-3">
            Only you see these numbers. In the planned pool, the chain would store your notes as commitments and nobody else could read
            them.
          </p>
        </Panel>

        <Panel title={`Notes (${v.notes.length})`}>
          {v.notes.length === 0 ? (
            <p className="text-[14.5px] text-fg-2">
              No notes yet. <Link href="/app/shroud" className="link font-semibold text-fg">Shroud some practice ETH or {BRAND.ticker}</Link> to
              create your first one.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {[...v.notes]
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((n) => (
                  <li key={n.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 py-2.5 text-[14px]">
                    <span className="min-w-0">
                      <span className="num block truncate text-fg">{shortAddress(n.id, 10, 6)}</span>
                      <span className="text-[12.5px] text-fg-3">
                        {n.origin === "shroud" ? "Shrouded" : n.origin === "received" ? "Received privately" : "Change"} · {ago(n.createdAt)}
                      </span>
                    </span>
                    <span className="num text-right text-fg">
                      {reveal ? fmt(n.value) : <Redact w={6} />} {NAME[n.asset]}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid min-w-0 grid-cols-1 content-start gap-5">
        <Panel title="Public balance">
          <Row k="Practice ETH" v={fmt(acct.eth)} />
          <Row k={`Practice ${BRAND.ticker}`} v={fmt(acct.oarkel, 2)} />
          <Row k={`Real ETH on ${CHAIN.name}`} v={balance === null ? "…" : `${balance}`} />
          {v.canTopUp ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => act("topup")}
              className="btn-ghost mt-4 inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold"
            >
              Top up practice balance
            </button>
          ) : null}
          <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">The real ETH balance is read live from the chain. It is never used here.</p>
        </Panel>

        <Panel title="Practice fee vault" aside={<span className="text-[12.5px] text-fg-3">all visitors</span>}>
          <Row k={`Value per ${BRAND.ticker} share`} v={perShare.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })} strong />
          <Row k="Vault backing" v={`${fmt(v.vault.backing, 2)} ${BRAND.ticker}`} />
          <Row k="Fees received" v={`${fmt(v.vault.fees, 2)} ${BRAND.ticker}`} />
          <Row k="Practice accounts" v={v.stats.accounts.toLocaleString("en-US")} />
          <Row k="Shrouds · sends · unshrouds" v={`${v.stats.shrouds} · ${v.stats.transfers} · ${v.stats.unshrouds}`} />
          <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">
            Moves only when someone pays a practice fee. ETH fees are counted at a fixed practice rate of {v.rules.oarkelPerEth.toLocaleString("en-US")}{" "}
            {BRAND.ticker} per ETH, which is not a price.
          </p>
        </Panel>

        <Panel title={`${CHAIN.name}, live`}>
          <Row k="Block" v={chain?.block ? `#${chain.block.toLocaleString("en-US")}` : "…"} />
          <Row k="Gas" v={chain?.gasGwei ? `${chain.gasGwei.toPrecision(3)} gwei` : "…"} />
          <Row k="ETH / USD (Chainlink)" v={chain?.ethUsd ? `$${chain.ethUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "…"} />
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Forms */

function AmountField({ asset, text, setText, max }: { asset: Asset; text: string; setText: (s: string) => void; max: number }) {
  return (
    <label className="block">
      <span className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="text-fg-2">Amount</span>
        <button type="button" onClick={() => setText(String(Math.floor(max) / MICRO))} className="num text-[13px] text-fg-3 hover:text-fg">
          Available {fmt(max)} {NAME[asset]} · max
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

function Summary({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-5 rounded-[10px] bg-card-2 px-4 py-2">
      {rows.map(([k, v]) => (
        <Row key={k} k={k} v={v} />
      ))}
    </div>
  );
}

function formFrame(title: string, lede: string, form: React.ReactNode, side: React.ReactNode) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Panel title={title}>
        <p className="-mt-1 mb-5 text-[14.5px] leading-relaxed text-fg-2">{lede}</p>
        {form}
      </Panel>
      <div className="min-w-0">{side}</div>
    </div>
  );
}

function Explainer({ title, points }: { title: string; points: string[] }) {
  return (
    <section className="sheet ruled p-5 md:p-6">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-fg-2">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <span className="mt-[9px] h-[3px] w-3 shrink-0 bg-surge" />
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ShroudForm() {
  const { view, act, busy } = usePractice();
  const [asset, setAsset] = useState<Asset>("eth");
  const [text, setText] = useState("");
  if (!view?.account) return null;
  const available = asset === "eth" ? view.account.eth : view.account.oarkel;
  const amount = toMicro(text);
  const fee = amount ? Math.ceil((amount * view.rules.shroudBps) / 10_000) : 0;
  const problem = !text ? null : amount === null ? "Enter a number." : amount > available ? "More than your public practice balance." : amount < view.rules.min[asset] ? `Minimum ${fmt(view.rules.min[asset])} ${NAME[asset]}.` : null;
  return formFrame(
    "Shroud",
    `Move practice ${NAME[asset]} from your public balance into a private note.`,
    <>
      <AssetPick value={asset} onChange={setAsset} />
      <div className="mt-5">
        <AmountField asset={asset} text={text} setText={setText} max={available} />
      </div>
      <Summary
        rows={[
          [`Shroud fee (${view.rules.shroudBps / 100}%, example)`, amount ? `${fmt(fee, 6)} ${NAME[asset]}` : "–"],
          ["New private note", amount ? `${fmt(Math.max(0, amount - fee), 6)} ${NAME[asset]}` : "–"],
          ["Visible on chain (planned pool)", "your address and the amount"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || Boolean(problem) || Boolean(busy)}
        onClick={async () => {
          if (amount && (await act("shroud", { asset, amount }))) setText("");
        }}
        className="btn-surge mt-5 h-12 w-full rounded-full text-[15px] font-semibold"
        data-testid="submit"
      >
        {busy ?? `Shroud ${NAME[asset]}`}
      </button>
      <Status />
    </>,
    <Explainer
      title="What shrouding does"
      points={[
        "The deposit is public: anyone can see this address put value into the pool.",
        `From here the value is a note. ${BRAND.ticker} notes hold vault shares, so they grow as fees arrive.`,
        "In practice mode you sign a message instead of sending a transaction. No gas, no real funds.",
      ]}
    />,
  );
}

export function UnshroudForm() {
  const { view, act, busy } = usePractice();
  const { address } = useWallet();
  const [asset, setAsset] = useState<Asset>("eth");
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  const [relayer, setRelayer] = useState(true);
  if (!view?.account || !address) return null;
  const amount = toMicro(text);
  const fee = view.rules.unshroudFlat[asset];
  const relay = relayer ? view.rules.relayerFee[asset] : 0;
  const available = view.private[asset];
  const maxOut = Math.max(0, available - fee - relay);
  const dest = (to.trim() || address).toLowerCase();
  const validTo = /^0x[0-9a-f]{40}$/.test(dest);
  const problem = !text
    ? null
    : amount === null
      ? "Enter a number."
      : amount > maxOut
        ? "More than your private balance after fees."
        : !validTo
          ? "Enter a full 0x address."
          : amount < view.rules.min[asset]
            ? `Minimum ${fmt(view.rules.min[asset])} ${NAME[asset]}.`
            : null;
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
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14.5px]">
        <input type="checkbox" checked={relayer} onChange={(e) => setRelayer(e.target.checked)} className="mt-1 size-4 accent-[#b83c1c]" />
        <span>
          <span className="font-semibold">Use a relayer</span>
          <span className="block text-[13px] text-fg-3">The relayer pays the gas and takes its fee from the note, so the recipient needs no ETH.</span>
        </span>
      </label>
      <Summary
        rows={[
          ["Unshroud fee (flat, example)", `${fmt(fee, 6)} ${NAME[asset]}`],
          ["Relayer fee (example)", relayer ? `${fmt(relay, 6)} ${NAME[asset]}` : "none"],
          ["Recipient gets", amount ? `${fmt(amount, 6)} ${NAME[asset]}` : "–"],
          ["Visible on chain (planned pool)", "recipient and amount, not the note"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || Boolean(problem) || Boolean(busy)}
        onClick={async () => {
          if (amount && (await act("unshroud", { asset, amount, to: dest, relayer }))) setText("");
        }}
        className="btn-surge mt-5 h-12 w-full rounded-full text-[15px] font-semibold"
        data-testid="submit"
      >
        {busy ?? `Unshroud ${NAME[asset]}`}
      </button>
      <Status />
    </>,
    <Explainer
      title="Before you exit"
      points={[
        "Withdrawing to the same address that deposited links the two ends. A fresh address does not.",
        "Round amounts blend in with other exits; exact ones stand out.",
        "The flat fee says nothing about the size or age of the note being spent.",
      ]}
    />,
  );
}

export function SendForm() {
  const { view, act, busy } = usePractice();
  const [asset, setAsset] = useState<Asset>("oarkel");
  const [text, setText] = useState("");
  const [to, setTo] = useState("");
  if (!view?.account) return null;
  const amount = toMicro(text);
  const fee = amount ? Math.ceil((amount * view.rules.transferBps) / 10_000) : 0;
  const available = view.private[asset];
  const dest = to.trim().toLowerCase();
  const problem = !text
    ? null
    : amount === null
      ? "Enter a number."
      : amount + fee > available
        ? "More than your private balance after the fee."
        : dest && !/^0x[0-9a-f]{40}$/.test(dest)
          ? "Enter a full 0x address."
          : dest === view.account.address
            ? "That is your own account."
            : null;
  return formFrame(
    "Send privately",
    "Pay another practice account from your notes. They receive a new note; nothing links it to you.",
    <>
      <AssetPick value={asset} onChange={setAsset} />
      <div className="mt-5">
        <AmountField asset={asset} text={text} setText={setText} max={Math.max(0, Math.floor(available / (1 + view.rules.transferBps / 10_000)))} />
      </div>
      <label className="mt-4 block">
        <span className="text-[14px] text-fg-2">Recipient wallet (must have a practice account)</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x…" className="field num mt-2 text-[14px]" data-testid="to" />
      </label>
      <Summary
        rows={[
          [`Transfer fee (${view.rules.transferBps / 100}%, example)`, amount ? `${fmt(fee, 6)} ${NAME[asset]}` : "–"],
          ["Recipient gets a note of", amount ? `${fmt(amount, 6)} ${NAME[asset]}` : "–"],
          ["Visible on chain (planned pool)", "that a transfer happened"],
        ]}
      />
      {problem ? <p className="mt-3 text-[13.5px] text-down">{problem}</p> : null}
      <button
        type="button"
        disabled={!amount || !dest || Boolean(problem) || Boolean(busy)}
        onClick={async () => {
          if (amount && (await act("send", { asset, amount, to: dest }))) setText("");
        }}
        className="btn-surge mt-5 h-12 w-full rounded-full text-[15px] font-semibold"
        data-testid="submit"
      >
        {busy ?? "Send privately"}
      </button>
      <Status />
    </>,
    <Explainer
      title="How a private payment looks"
      points={[
        "Your notes are spent and two new ones appear: one for the recipient, one for your change.",
        "Outside the pool, observers see spent nullifiers and new commitments, nothing else.",
        "To try it, open a practice account with a second wallet and send to it.",
      ]}
    />,
  );
}

/* ------------------------------------------------------------- Activity + settings */

export function ActivityList() {
  const { view } = usePractice();
  if (!view) return null;
  return (
    <Panel title="Your practice activity" aside={<span className="text-[12.5px] text-fg-3">latest 30, newest first</span>}>
      {view.activity.length === 0 ? (
        <p className="text-[14.5px] text-fg-2">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line" data-testid="activity">
          {view.activity.map((a, i) => (
            <li key={i} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4">
              <span className="label pt-0.5 text-fg-3">{a.kind}</span>
              <span className="min-w-0 text-[14.5px] break-words">
                {a.text}
                <span className="ml-2 text-[12.5px] text-fg-3">{ago(a.t)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function SettingsView() {
  const { address, walletName, disconnect } = useWallet();
  const { view, refresh } = usePractice();
  const [copied, setCopied] = useState(false);
  if (!address || !view) return null;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel title="Wallet">
        <Row k="Wallet" v={walletName ?? "Wallet"} />
        <Row k="Address" v={<span className="break-all">{shortAddress(address, 10, 8)}</span>} />
        <Row k="Practice account since" v={view.account ? new Date(view.account.createdAt).toISOString().slice(0, 10) : "–"} />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(address);
                setCopied(true);
                setTimeout(() => setCopied(false), 1400);
              } catch {
                // clipboard refused
              }
            }}
            className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy address"}
          </button>
          <a href={explorerAddress(address)} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold">
            View on explorer
          </a>
          <button type="button" onClick={refresh} className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold">
            <ArrowsClockwise size={14} /> Refresh
          </button>
          <button type="button" onClick={disconnect} className="inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold text-down hover:bg-down/10">
            Disconnect
          </button>
        </div>
      </Panel>
      <Panel title="Keys and storage">
        <div className="space-y-3 text-[14.5px] leading-relaxed text-fg-2">
          <p>
            In the planned pool, your note keys come from one wallet signature, so the same wallet restores them anywhere.{" "}
            <Link href="/docs/keys" className="link text-fg">How keys work</Link>.
          </p>
          <p>
            In practice mode there are no keys. Practice balances live on this site&apos;s server under your wallet address, and every change needs a
            fresh signature from that wallet.
          </p>
        </div>
      </Panel>
      <Panel title="Example rates used here">
        <PracticeRates view={view} />
      </Panel>
    </div>
  );
}

function PracticeRates({ view }: { view: PracticeView }) {
  const r = view.rules;
  return (
    <>
      <Row k="Shroud fee" v={`${r.shroudBps / 100}%`} />
      <Row k="Private transfer fee" v={`${r.transferBps / 100}%`} />
      <Row k="Unshroud fee (flat)" v={`${fmt(r.unshroudFlat.eth, 6)} ETH · ${fmt(r.unshroudFlat.oarkel)} ${BRAND.ticker}`} />
      <Row k="Relayer fee" v={`${fmt(r.relayerFee.eth, 6)} ETH · ${fmt(r.relayerFee.oarkel)} ${BRAND.ticker}`} />
      <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">Examples only. The real contracts&apos; rates are not set yet.</p>
    </>
  );
}
