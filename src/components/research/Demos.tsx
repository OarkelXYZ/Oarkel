"use client";

import { useMemo, useState } from "react";

/*
 * Six small models for the research notes. Every number in them is produced
 * by the model itself from the visitor's inputs. None of it is pool data:
 * there is no deployed pool to read from yet.
 */

/** Deterministic generator so server and browser render the same picture. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const Frame = ({ children, caption }: { children: React.ReactNode; caption: string }) => (
  <figure className="guar-stage mt-6 overflow-hidden border border-line-2 bg-paper">
    <div className="p-4 md:px-[72px] md:py-12">{children}</div>
    <figcaption className="border-t border-line px-4 py-3 font-mono text-[11.5px] text-fg-3 md:px-6">{caption}</figcaption>
  </figure>
);

const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className={`inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors ${
      on ? "bg-fg text-paper" : "btn-ghost text-fg-2"
    }`}
  >
    <span className={`size-2 rounded-full ${on ? "bg-surge" : "bg-line-2"}`} />
    {label}
  </button>
);

const Stat = ({ k, v }: { k: string; v: string }) => (
  <div className="min-w-0">
    <p className="text-[12.5px] text-fg-3">{k}</p>
    <p className="num mt-0.5 text-[22px] text-fg">{v}</p>
  </div>
);

/* 1. Root timing ---------------------------------------------------- */

export function RootTimingDemo() {
  const total = 36;
  const mine = 23;
  const [newest, setNewest] = useState(false);
  const [root, setRoot] = useState(mine);
  const used = newest ? total - 1 : root;
  const candidates = used + 1;
  return (
    <Frame caption="Model: 36 notes in insertion order. Naming a root reveals the note already existed by then.">
      <div className="flex flex-wrap items-center gap-3">
        <Toggle on={newest} onChange={setNewest} label="Always prove against the newest root" />
      </div>
      <label className={`mt-5 block ${newest ? "opacity-40" : ""}`}>
        <span className="block text-[14px] text-fg-2">Root the wallet proves against: after note #{used + 1}</span>
        <input
          type="range"
          min={mine}
          max={total - 1}
          value={root}
          disabled={newest}
          onChange={(e) => setRoot(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--color-fg)]"
        />
      </label>
      <div className="mt-5 grid grid-cols-12 gap-1 sm:grid-cols-[repeat(18,minmax(0,1fr))]" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`aspect-square rounded-[2px] ${i === mine ? "bg-surge" : i <= used ? "bg-fg" : "bg-card-3"}`}
            title={i === mine ? "your note" : undefined}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Stat k="Notes that could be yours" v={String(candidates)} />
        <Stat k="Your note" v={`#${mine + 1} (red)`} />
      </div>
    </Frame>
  );
}

/* 2. Round exits ---------------------------------------------------- */

function gridFloor(x: number) {
  if (x < 1) return 0;
  const k = Math.floor(Math.log10(x));
  const m = Math.floor(x / 10 ** k);
  return m * 10 ** k;
}

export function RoundExitsDemo() {
  const [balance, setBalance] = useState(12_347.81);
  const [text, setText] = useState("12347.81");
  const exit = gridFloor(balance);
  const left = Math.max(0, balance - exit);
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <Frame caption="Model: exits restricted to one significant digit (m × 10^k). The remainder stays in a note.">
      <label className="block">
        <span className="block text-[14px] text-fg-2">Note balance</span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(n) && n >= 0) setBalance(n);
          }}
          className="field num mt-2 max-w-xs"
        />
      </label>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat k="Exact exit (fingerprint)" v={fmt(balance)} />
        <Stat k="Grid exit (shared)" v={fmt(exit)} />
        <Stat k="Stays shrouded" v={fmt(left)} />
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-fg-2">
        An exit of {fmt(balance)} is close to unique on the chain. An exit of {fmt(exit)} looks like every other exit of {fmt(exit)}.
      </p>
    </Frame>
  );
}

/* 3. Batched exits -------------------------------------------------- */

export function BatchedExitsDemo() {
  const [batched, setBatched] = useState(true);
  const subs = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 9 }, () => 4 + r() * 86).sort((a, b) => a - b);
  }, []);
  const payouts = batched ? [94] : subs;
  return (
    <Frame caption="Model: nine exit requests arrive during one epoch. With batching, all are paid at the epoch boundary.">
      <Toggle on={batched} onChange={setBatched} label="Pay exits at the epoch boundary" />
      <div className="mt-6 space-y-4">
        <div>
          <p className="text-[12.5px] text-fg-3">Requests (proof submitted)</p>
          <div className="relative mt-2 h-6 rounded-[3px] bg-card-2">
            {subs.map((x, i) => (
              <span key={i} className="absolute top-1 h-4 w-1 rounded-full bg-fg" style={{ left: `${x}%` }} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[12.5px] text-fg-3">Payouts (visible on chain)</p>
          <div className="relative mt-2 h-6 rounded-[3px] bg-card-2">
            {payouts.map((x, i) => (
              <span key={i} className="absolute top-1 h-4 w-1 rounded-full bg-surge" style={{ left: `${x}%` }} />
            ))}
            <span className="absolute top-0 bottom-0 w-px bg-line-2" style={{ left: "95%" }} />
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Stat k="Distinct request times" v="9" />
        <Stat k="Distinct payout times" v={String(new Set(payouts).size)} />
      </div>
    </Frame>
  );
}

/* 4. Note refresh --------------------------------------------------- */

export function NoteRefreshDemo() {
  const base = useMemo(() => {
    const r = rng(11);
    return Array.from({ length: 48 }, () => Math.floor(r() * 120));
  }, []);
  const [refreshed, setRefreshed] = useState(false);
  const ages = refreshed ? base.map((a, i) => (a > 70 && i % 2 === 0 ? Math.floor(a / 9) : a)) : base;
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const a of ages) buckets[Math.min(5, Math.floor(a / 20))]++;
  const max = Math.max(...buckets);
  return (
    <Frame caption="Model: 48 notes by age in days. A refresh spends an old note into a new one of the same value.">
      <button type="button" onClick={() => setRefreshed((v) => !v)} className="btn-ink inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold">
        {refreshed ? "Undo refresh" : "Refresh some old notes"}
      </button>
      <div className="mt-6 flex h-32 items-end gap-2" aria-hidden="true">
        {buckets.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="num text-[11px] text-fg-3">{n}</span>
            <span className="w-full rounded-t-[2px] bg-fg transition-all" style={{ height: `${(n / max) * 96}px` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {["0-19", "20-39", "40-59", "60-79", "80-99", "100+"].map((l) => (
          <span key={l} className="num flex-1 text-center text-[11px] text-fg-3">
            {l}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-fg-2">
        {refreshed
          ? "Refreshed notes restart at a young age and look like any recent deposit, so an old, dormant note no longer stands out."
          : "Old notes form a thin, distinctive tail. A note that has sat untouched for months is easier to single out when it finally moves."}
      </p>
    </Frame>
  );
}

/* 5. Counting the crowd --------------------------------------------- */

export function CrowdDemo() {
  const pool = 12_000;
  const [grid, setGrid] = useState(true);
  const [batch, setBatch] = useState(true);
  const [newestRoot, setNewestRoot] = useState(true);
  const [freshExit, setFreshExit] = useState(true);
  // Each leak that is not closed divides the plausible senders by a modelled factor.
  let set = pool;
  if (!grid) set /= 40;
  if (!batch) set /= 12;
  if (!newestRoot) set /= 6;
  if (!freshExit) set /= 25;
  set = Math.max(1, Math.round(set));
  const bits = Math.log2(set);
  return (
    <Frame caption="Model: 12,000 notes. Each open leak divides the plausible senders by an assumed factor (40, 12, 6, 25).">
      <div className="flex flex-wrap gap-2">
        <Toggle on={grid} onChange={setGrid} label="Round exit amounts" />
        <Toggle on={batch} onChange={setBatch} label="Batched exits" />
        <Toggle on={newestRoot} onChange={setNewestRoot} label="Newest root" />
        <Toggle on={freshExit} onChange={setFreshExit} label="Exit to a fresh address" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat k="Notes in the pool" v={pool.toLocaleString("en-US")} />
        <Stat k="Plausible senders" v={set.toLocaleString("en-US")} />
        <Stat k="Effective anonymity" v={`${bits.toFixed(1)} bits`} />
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-card-3">
        <span className="block h-full bg-surge transition-all" style={{ width: `${(bits / Math.log2(pool)) * 100}%` }} />
      </div>
    </Frame>
  );
}

/* 6. Hidden lookups ------------------------------------------------- */

export function HiddenLookupsDemo() {
  const [oblivious, setOblivious] = useState(true);
  const [reads, setReads] = useState<number[]>([]);
  const [seed, setSeed] = useState(3);
  const target = 5;
  const read = () => {
    const r = rng(seed);
    setSeed((s) => s + 17);
    setReads((prev) => [...prev, oblivious ? Math.floor(r() * 8) : target].slice(-12));
  };
  const touched = new Set(reads);
  return (
    <Frame caption="Model: 8 storage slots. The wanted record always sits in slot 6; an observer sees which slot is touched.">
      <div className="flex flex-wrap gap-2">
        <Toggle
          on={oblivious}
          onChange={(v) => {
            setOblivious(v);
            setReads([]);
          }}
          label="Oblivious access"
        />
        <button type="button" onClick={read} className="btn-ink inline-flex h-9 items-center rounded-full px-4 text-[13.5px] font-semibold">
          Read the record
        </button>
      </div>
      <div className="mt-6 grid grid-cols-8 gap-1.5" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={`h-10 w-full rounded-[3px] ${touched.has(i) ? "bg-surge" : "bg-card-3"}`} />
            <span className="num text-[11px] text-fg-3">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Stat k="Reads so far" v={String(reads.length)} />
        <Stat k="Distinct slots touched" v={String(touched.size)} />
      </div>
    </Frame>
  );
}
