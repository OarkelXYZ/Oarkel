"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Cursor } from "@phosphor-icons/react";
import { useCopyCa } from "@/components/CopyCa";
import { BRAND, shortAddress } from "@/config/brand";

/* ------------------------------------------------------------------ */
/* How it works: three columns, the active one cycles                  */
/* ------------------------------------------------------------------ */

export type Step = { n: string; title: string; text: string };

export function HowSteps({ steps }: { steps: Step[] }) {
  const [on, setOn] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setOn((v) => (v + 1) % steps.length), 3200);
    return () => window.clearInterval(t);
  }, [paused, steps.length]);
  const art = [<ShroudArt key="a" />, <HoldArt key="b" />, <ExitArt key="c" />];
  return (
    <div className="relative mt-12 md:mt-16" onMouseLeave={() => setPaused(false)}>
      <div className="hiw-connector hidden md:block" aria-hidden="true" />
      <span className="absolute top-0 bottom-0 left-3 w-px bg-line md:hidden" aria-hidden="true" />
      <ol className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-0">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className={`hiw-col pl-10 md:px-8 ${on === i ? "is-on" : ""}`}
            onMouseEnter={() => {
              setPaused(true);
              setOn(i);
            }}
          >
            <p className="hiw-num" aria-hidden="true">
              {s.n}
            </p>
            <div className="mt-10 grid h-[88px] place-items-center md:mt-12" aria-hidden="true">
              {art[i]}
            </div>
            <div className="hiw-text mt-8 md:mt-10">
              <h3 className="font-mono text-[16px] leading-6 font-medium tracking-[-0.02em] text-fg">
                <span className="sr-only">Step {s.n}: </span>
                {s.title}
              </h3>
              <p className="mt-2 max-w-[32ch] text-[15px] leading-relaxed text-fg-2">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Redaction bars slide over a dotted block: the balance goes under cover. */
function ShroudArt() {
  return (
    <div className="relative h-[46px] w-[128px]">
      <div className="hiw-dither absolute inset-0" />
      <div className="absolute inset-0 flex flex-col justify-center gap-[3px] overflow-hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="slat-move block h-[6px] bg-fg"
            style={{ width: `${96 - i * 9}%`, marginLeft: `-${96 - i * 9}%`, ["--to" as string]: "100%", animationDelay: `${i * 0.12}s` } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

/** Columns of dots that light up in turn: the vault share rising as fees land. */
function HoldArt() {
  const cols = [3, 4, 4, 5, 6, 6];
  return (
    <div className="flex items-end gap-[6px]">
      {cols.map((h, c) => (
        <div key={c} className="flex flex-col-reverse gap-[6px]">
          {Array.from({ length: 6 }).map((_, r) => (
            <span
              key={r}
              className={`block size-[5px] rounded-full ${r < h ? "breathe bg-fg" : "bg-fg/15"}`}
              style={r < h ? { animationDelay: `${(c * 6 + r) * 0.07}s` } : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The private block resolves into a fresh public address, with a nullifier underneath. */
function ExitArt() {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-4">
        <div className="hiw-dither breathe h-[44px] w-[56px]" />
        <span className="font-mono text-[12px] text-fg-2">0x5e21…b7d0</span>
      </div>
      <span className="font-mono text-[10.5px] text-fg-4">nullifier 0x91c…4a</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What shrouding changes: a traceable wallet graph with a toggle      */
/* ------------------------------------------------------------------ */

const PEERS: { x: number; y: number; addr: string; bal: string; amt: string; tag?: string; dash?: boolean }[] = [
  { x: 170, y: 120, addr: "0x3b7e…a41c", bal: "2,310.40", amt: "−880.00" },
  { x: 95, y: 245, addr: "0x0c52…7d19", bal: "16.75", amt: "+21.30", dash: true },
  { x: 150, y: 360, addr: "0x6f04…e2b8", bal: "27,450.00", amt: "−3,100.00" },
  { x: 310, y: 455, addr: "0xd918…05fa", bal: "418.60", amt: "+96.00", dash: true },
  { x: 535, y: 470, addr: "0x47aa…c3e1", bal: "8,904.15", amt: "−1,240.00" },
  { x: 745, y: 410, addr: "0x9d3c…11e7", bal: "", amt: "+3,000.00", tag: "SALARY" },
  { x: 880, y: 320, addr: "0x2e61…98bd", bal: "1,066.02", amt: "+415.00", dash: true },
  { x: 895, y: 190, addr: "0x7c0f…5a26", bal: "", amt: "−9,500.00", tag: "EXCHANGE" },
  { x: 780, y: 95, addr: "0xb1d4…3f70", bal: "14,220.00", amt: "+5,075.00", dash: true },
  { x: 575, y: 45, addr: "0x58e9…d0c4", bal: "", amt: "−12,600.00", tag: "OTC DESK" },
  { x: 350, y: 55, addr: "0xa6f2…4b81", bal: "7,780.55", amt: "+1,420.00", dash: true },
];

export function TraceGraph() {
  const [shrouded, setShrouded] = useState(false);
  const cx = 500;
  const cy = 255;
  return (
    <div className={`trace ${shrouded ? "is-private" : ""}`}>
      <div className="relative mx-auto mt-8 w-full max-w-[1000px] md:mt-4">
        <svg viewBox="0 0 1000 520" className="h-auto w-full" role="img" aria-label="A wallet linked to eleven other addresses by visible payments">
          <defs>
            <radialGradient id="tg-fade" cx="50%" cy="50%" r="55%">
              <stop offset="60%" stopColor="#fff" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <mask id="tg-mask">
              <rect width="1000" height="520" fill="url(#tg-fade)" />
            </mask>
          </defs>
          <g mask="url(#tg-mask)">
            {PEERS.map((p, i) => {
              const mx = (p.x + cx) / 2;
              const my = (p.y + cy) / 2;
              return (
                <g key={i}>
                  <line x1={cx} y1={cy} x2={p.x} y2={p.y} className="trace-edge" strokeDasharray={p.dash ? "3 4" : undefined} />
                  <text x={mx} y={my - 6} textAnchor="middle" className="trace-label hideable fill-fg font-mono text-[11px]">
                    {p.amt}
                  </text>
                  <circle cx={p.x} cy={p.y} r="3.5" className="fill-fg/80" />
                  {p.tag ? (
                    <g className="trace-label">
                      <rect x={p.x - 42} y={p.y + 10} width="84" height="18" rx="9" className="fill-paper stroke-fg/40" />
                      <text x={p.x} y={p.y + 23} textAnchor="middle" className="fill-fg font-mono text-[10px] tracking-[0.06em]">
                        {p.tag}
                      </text>
                    </g>
                  ) : (
                    <text x={p.x} y={p.y + 22} textAnchor="middle" className="trace-label hideable fill-fg-2 font-mono text-[10.5px]">
                      {p.addr} · {p.bal}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={cx} cy={cy} r="9" className="fill-paper stroke-fg" strokeWidth="1.2" />
          <circle cx={cx} cy={cy} r="3.5" className="fill-fg" />
          <text x={cx} y={cy + 27} textAnchor="middle" className="fill-fg font-mono text-[11px]">
            you · 0x7f3a…c21e
          </text>
          <text x={cx} y={cy + 42} textAnchor="middle" className="trace-label hideable fill-fg-2 font-mono text-[11px]">
            holds 182,400.00 {BRAND.symbol}
          </text>
        </svg>
      </div>
      <div className="mt-6 flex flex-col items-center px-4 text-center">
        <div className="seg" role="group" aria-label="Compare a public token with a shrouded balance">
          <button type="button" aria-pressed={!shrouded} onClick={() => setShrouded(false)}>
            Public token
          </button>
          <button type="button" aria-pressed={shrouded} onClick={() => setShrouded(true)}>
            Shrouded
          </button>
        </div>
        <p className="mt-5 max-w-[60ch] text-[14px] leading-relaxed text-fg-2">
          {shrouded
            ? "Inside the pool the same wallet shows commitments that all look alike. Amounts, counterparties and the balance behind them stay with your keys."
            : "An ordinary ERC-20. Every holding and every transfer sits in a permanent public row, and one tagged address is enough to unravel the rest."}
        </p>
        <p className={`mt-3 max-w-[64ch] font-mono text-[11px] leading-relaxed text-fg-2/70 transition-opacity ${shrouded ? "opacity-100" : "opacity-0"}`}>
          Honest limit: entering and leaving the pool stay visible. What disappears is the path in between.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inline contract line for the Get section                            */
/* ------------------------------------------------------------------ */

export function CopyCaInline() {
  const { copied, copy, live } = useCopyCa();
  return (
    <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-2 font-mono text-[12px] text-fg-2" data-testid="ca-inline">
      <span>contract:</span>
      <span className="text-fg">{live ? shortAddress(BRAND.ca, 6, 4) : "published at launch"}</span>
      <button
        type="button"
        onClick={copy}
        disabled={!live}
        aria-label={live ? "Copy contract address" : "Contract address not published yet"}
        className="text-fg-2 transition-colors enabled:hover:text-fg disabled:opacity-40"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Guarantees: a pinned list on wide screens, a plain list on phones   */
/* ------------------------------------------------------------------ */

export type Guarantee = { title: string; text: string; tag?: string };

export function Guarantees({ items }: { items: Guarantee[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el || window.innerWidth < 1024) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      const pos = p * items.length;
      setActive(Math.min(items.length - 1, Math.floor(pos)));
      setProgress(pos - Math.floor(pos));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items.length]);

  return (
    <>
      {/* wide screens: pinned */}
      <div ref={ref} className="relative hidden lg:block" style={{ height: `${items.length * 70}vh` }}>
        <div className="sticky top-0 flex h-[100dvh] items-center">
          <div className="wrap-narrow grid grid-cols-[436px_minmax(0,1fr)] items-center gap-10">
            <ul className="border-t border-line">
              {items.map((g, i) => (
                <li key={g.title} className={`guar-item border-b border-line ${i === active ? "is-on" : ""}`}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 py-5 text-left" onClick={() => scrollToItem(ref.current, i, items.length)}>
                    <h3 className="font-mono text-[22px] leading-[33px] font-medium tracking-[-0.02em] text-fg">{g.title}</h3>
                    {g.tag ? <span className="tag shrink-0">{g.tag}</span> : null}
                  </button>
                  {i === active ? (
                    <div className="enter">
                      <p className="max-w-[42ch] pb-5 text-[15px] leading-relaxed text-fg-2">{g.text}</p>
                      <span className="guar-progress block" style={{ width: `${Math.max(8, progress * 100)}%` }} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="guar-stage grid h-[400px] place-items-center overflow-hidden rounded-[14px] border border-line bg-card/40">
              <Stage i={active} />
            </div>
          </div>
        </div>
      </div>
      {/* phones and tablets: every item open, with its picture */}
      <div className="wrap-narrow lg:hidden">
        <ul className="flex flex-col gap-14">
          {items.map((g, i) => (
            <li key={g.title} className="border-t border-line pt-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-mono text-[19px] leading-snug font-medium tracking-[-0.02em] text-fg">{g.title}</h3>
                {g.tag ? <span className="tag mt-1 shrink-0">{g.tag}</span> : null}
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-fg-2">{g.text}</p>
              <div className="guar-stage mt-6 grid min-h-[260px] place-items-center overflow-hidden rounded-[14px] border border-line bg-card/40 px-4 py-8">
                <Stage i={i} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function scrollToItem(el: HTMLElement | null, i: number, n: number) {
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY;
  const span = el.offsetHeight - window.innerHeight;
  window.scrollTo({ top: top + (span * (i + 0.15)) / n, behavior: "smooth" });
}

function Stage({ i }: { i: number }) {
  switch (i) {
    case 0:
      return <FreezeStage />;
    case 1:
      return <ProofStage />;
    case 2:
      return <RelayStage />;
    case 3:
      return <KeyStage />;
    case 4:
      return <PatchStage />;
    default:
      return <EarnStage />;
  }
}

const chip = "rounded-full border border-line-2 px-3 py-1 font-mono text-[11px] text-fg whitespace-nowrap";

function FreezeStage() {
  return (
    <div className="flex flex-col items-center">
      <div className="relative grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, k) => (
          <span key={k} className={`block h-[26px] w-[46px] rounded-[2px] border sm:w-[56px] ${k === 5 ? "border-fg/60" : "border-line-2"}`} />
        ))}
        <Cursor size={16} weight="fill" className="absolute right-[24%] bottom-[-6px] text-fg" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono text-[11px] text-down/80">freeze(note): reverted, no admin role</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <span className={chip}>No admin keys</span>
        <span className={chip}>Exits keep working</span>
        <span className={chip}>No upgrade path</span>
      </div>
    </div>
  );
}

function ProofStage() {
  return (
    <div className="w-full max-w-[300px] rounded-[4px] border border-line-2 bg-paper p-4 font-mono text-[11.5px]">
      <p className="text-fg">building proof in this browser</p>
      <div className="mt-3 h-[3px] w-full bg-line">
        <span className="block h-full w-[72%] bg-fg" />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-fg-2">
        <dt>note key</dt>
        <dd className="text-right">stays on device</dd>
        <dt>witness</dt>
        <dd className="text-right">stays on device</dd>
        <dt>sent out</dt>
        <dd className="text-right text-fg">proof + nullifier</dd>
      </dl>
    </div>
  );
}

function RelayStage() {
  return (
    <div className="flex flex-col items-center gap-3 font-mono text-[11.5px]">
      <span className={chip}>fresh address · 0 ETH</span>
      <span className="h-5 w-px bg-line-2" />
      <span className="rounded-[4px] border border-line-2 bg-paper px-4 py-2 text-fg">relayer pays the gas</span>
      <span className="h-5 w-px bg-line-2" />
      <span className="rounded-[4px] border border-surge/70 bg-paper px-4 py-2 text-fg">fee comes out of the note</span>
    </div>
  );
}

function KeyStage() {
  return (
    <div className="w-full max-w-[320px] font-mono text-[11.5px]">
      <p className="text-fg-2">wallet signature</p>
      <p className="mt-1 truncate rounded-[2px] border border-line px-2 py-1.5 text-fg">0x8c41f0…a93e27d51b</p>
      <p className="mt-4 text-fg-2">derived, same on every device</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <span className="rounded-[2px] border border-line px-2 py-1.5 text-fg">viewing key</span>
        <span className="rounded-[2px] border border-line px-2 py-1.5 text-fg">spending key</span>
      </div>
      <p className="mt-4 text-fg-4">nothing written down, nothing to lose</p>
    </div>
  );
}

function PatchStage() {
  return (
    <pre className="w-full max-w-[320px] overflow-hidden rounded-[4px] border border-line-2 bg-paper p-4 font-mono text-[11.5px] leading-relaxed text-fg-2">
      <span className="text-fg">pool.upgradeTo()</span>
      {"\n"}→ function not found{"\n\n"}
      <span className="text-fg">plan before deposits</span>
      {"\n"}1. public review{"\n"}2. staged deposit caps{"\n"}3. bug bounty
    </pre>
  );
}

function EarnStage() {
  const [share, setShare] = useState(100);
  const held = 50_000;
  const feesToVault = 0.02; // an example: fees equal to 2% of the vault arrive
  const earned = (held * share * feesToVault) / 100;
  return (
    <div className="flex w-full max-w-[340px] flex-col items-center">
      <p className="num text-[26px] text-fg">
        +{earned.toLocaleString("en-US", { maximumFractionDigits: 0 })} {BRAND.symbol}
      </p>
      <label className="mt-4 flex w-full items-center gap-3 font-mono text-[11px] text-fg-2">
        public
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={share}
          onChange={(e) => setShare(Number(e.target.value))}
          className="flex-1 accent-[var(--color-fg)]"
          aria-label="Share of 50,000 tokens held shrouded"
        />
        private
      </label>
      <p className="mt-4 text-center text-[12.5px] leading-relaxed text-fg-3">
        Example only: 50,000 {BRAND.symbol} held, fees equal to 2% of the vault arrive. The shrouded part earns; the public part earns nothing.
      </p>
    </div>
  );
}
