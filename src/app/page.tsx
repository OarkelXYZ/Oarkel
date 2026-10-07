import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ChainStrip } from "@/components/chain/ChainStrip";
import { HOME_FAQ } from "@/components/home/faq";
import { CopyCaInline, Guarantees, HowSteps, TraceGraph, type Guarantee, type Step } from "@/components/home/Interactive";
import { JsonLd } from "@/components/JsonLd";
import { SlatMark } from "@/components/Mark";
import { BRAND, CHAIN } from "@/config/brand";

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOME_FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
};

export default function Home() {
  return (
    <main id="main">
      <JsonLd data={faqLd} />
      <Hero />
      <HowItWorks />
      <Trace />
      <Yield />
      <Uses />
      <GetToken />
      <Design />
      <Faq />
      <FinalCall />
    </main>
  );
}

/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="hero">
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-grain" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-[9%] flex justify-center md:top-[30%] md:-translate-y-[0%]" aria-hidden="true">
        <SlatMark id="hero" animate size={null} className="h-auto w-[52vw] max-w-[340px] text-white/[0.075]" />
      </div>
      <div className="relative mt-auto px-6 pt-[40vh] pb-16 md:px-12 md:pt-[46vh] md:pb-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[460px]">
            <h1 className="reveal-up font-mono text-[30px] leading-[36px] font-medium tracking-[-0.025em] text-fg md:text-[36px] md:leading-[40px]">
              <span className="block text-fg-2">{BRAND.name}.</span>
              <span className="block">Public chain.</span>
              <span className="block">Private balance.</span>
            </h1>
            <p className="reveal-up mt-4 text-[18px] leading-7 text-pretty text-fg/75" style={{ animationDelay: "0.12s" }}>
              {BRAND.name} is a privacy protocol for {CHAIN.name}. Shroud ETH or {BRAND.symbol}, keep a balance nobody else can read, and
              collect a share of the fees.
            </p>
            <div className="reveal-up mt-8 flex flex-wrap items-center gap-x-5 gap-y-4 md:gap-6" style={{ animationDelay: "0.22s" }}>
              <Link href="/app" className="btn-ink inline-flex h-11 items-center rounded-full px-6 text-[14px] font-medium md:px-7">
                Try it in practice
              </Link>
              <Link href="/#how-it-works" className="group inline-flex items-center gap-2 font-mono text-[13px] text-fg/70 md:text-[14px] transition-colors hover:text-fg">
                See how it works <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
          <ChainStrip note={false} className="reveal-up max-w-[520px] lg:justify-end" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const STEPS: Step[] = [
  {
    n: "01",
    title: "Shroud.",
    text: `Deposit ETH or ${BRAND.symbol} into the shared pool. What you get back is a note only your keys can open.`,
  },
  {
    n: "02",
    title: "Hold.",
    text: `Shrouded ${BRAND.symbol} owns a slice of the fee vault, and every fee raises its worth. Public wallets get none of it.`,
  },
  {
    n: "03",
    title: "Spend or unshroud.",
    text: "Pay someone inside the pool, or withdraw to an address you pick. A zero-knowledge proof shows the funds are yours without naming the note.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="relative pt-28 pb-20 md:pt-36 md:pb-28" aria-labelledby="how-title">
      <div className="dot-grid fade-y pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="wrap-narrow relative">
        <p className="eyebrow">01 / How it works</p>
        <h2 id="how-title" className="h2-mono mt-4">
          Shroud, hold, spend: three moves to a private balance.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-2">
          On {CHAIN.name}, as on every public chain, anyone can paste your address into an explorer and read your balance and every payment
          you have made. {BRAND.name} adds a second place to keep value, where the chain can check the math but cannot read the numbers.
        </p>
        <HowSteps steps={STEPS} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Trace() {
  return (
    <section className="relative bg-paper pt-16 pb-6 md:pt-24" aria-labelledby="trace-title">
      <div className="wrap-narrow">
        <p className="eyebrow">What changes when you shroud</p>
        <h2 id="trace-title" className="h2-mono mt-3">
          A public diary, then a sealed envelope.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-2">
          The difference is not what you own but who can read it. Once one of your addresses is tied to your name, through an exchange
          withdrawal or one tagged payment, a public token tells the whole story. A shrouded balance does not.
        </p>
      </div>
      <TraceGraph />
    </section>
  );
}

/* ------------------------------------------------------------------ */

const S = BRAND.symbol;

function Yield() {
  return (
    <div className="relative">
      <section id="yield" className="wrap relative py-24 md:py-32" aria-labelledby="yield-title">
        <header className="mb-12 border-t border-line pt-6 md:mb-16">
          <p className="eyebrow">02 / Holder yield</p>
          <h2 id="yield-title" className="h2-wide mt-4 max-w-2xl">
            Fees go to private holders. Public holders get nothing.
          </h2>
        </header>
        <p className="mb-6 max-w-3xl text-[16px] leading-relaxed text-fg-2 md:mb-8">
          This is the part most privacy tools leave out: a reason to stay private. Every fee the protocol takes is designed to flow into one
          vault, and the vault belongs to shrouded {S}. More activity means each private share is worth more. It is passive yield with no
          staking step and no claim button.
        </p>
        <YieldDiagram />
        <dl className="mx-auto mt-10 grid max-w-[1100px] grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [`Creator fee on ${S} trades`, "A cut of the launchpad creator fee on every buy and sell is harvested to buy back for the vault."],
            ["Shroud fee", "A small fee taken when value enters the pool."],
            ["Unshroud fee", "A flat fee per exit, so the fee says nothing about the note's size or age."],
            ["Private transfer fee", "A small fee on payments made inside the pool."],
          ].map(([t, d]) => (
            <div key={t} className="min-w-0 border-t border-line pt-4">
              <dt className="font-mono text-[13px] font-medium text-fg">{t}</dt>
              <dd className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mx-auto mt-8 max-w-[1100px] font-mono text-[11.5px] leading-relaxed text-fg-3">
          Contract design. Default rates: 0.25% to shroud, 0.10% per private transfer, a flat 0.0005 ETH or 20 {S} to unshroud, fixed at
          deploy. Yield can be zero: it is paid from real fees, never printed. Only shrouded {S} earns; ETH fees are swept and swapped into it.
        </p>
      </section>
    </div>
  );
}

function YieldDiagram() {
  const box = (l: number, t: number, w: number, h: number) => ({ "--l": `${l}%`, "--t": `${t}%`, "--w": `${w}%`, "--h": `${h}%` }) as React.CSSProperties;
  return (
    <div className="yield-diagram">
      <div className="yield-flow" role="img" aria-label={`How trading and private activity add value to shrouded ${S}`}>
        <svg className="yield-lines" viewBox="0 0 1100 540" preserveAspectRatio="none" aria-hidden="true">
          <path id="yp-in" d="M140 95 L390 95" />
          <path id="yp-out" d="M710 95 L960 95" />
          <path id="yp-fa" d="M245 132 L245 303 Q245 315 257 315 L488 315 Q500 315 500 327 L500 345" />
          <path id="yp-fb" d="M550 290 L550 345" />
          <path id="yp-fc" d="M855 132 L855 303 Q855 315 843 315 L612 315 Q600 315 600 327 L600 345" />
          <path id="yp-t1" d="M130 345 L165 345" />
          <path id="yp-t2" d="M130 385 L165 385" />
          <path id="yp-t3" d="M130 425 L165 425" />
          <path id="yp-h" className="hot" d="M330 385 L470 385" />
          <path id="yp-team" d="M212 435 L212 462" />
          <path id="yp-p" className="hot" d="M630 385 L770 385" />
          <path className="dash" d="M550 425 L550 469 Q550 481 562 481 L810 481" />
          {[
            ["yp-in", "0;0.3;1", "0;1;1", 4, ""],
            ["yp-out", "0;0.54;0.76;1", "0;0;1;1", 4, ""],
            ["yp-fa", "0;0.5;0.66;1", "0;0;1;1", 3, ""],
            ["yp-fb", "0;0.52;0.67;1", "0;0;1;1", 3, ""],
            ["yp-fc", "0;0.54;0.69;1", "0;0;1;1", 3, ""],
            ["yp-t2", "0;0.25;0.41;1", "0;0;1;1", 3, ""],
            ["yp-h", "0;0.4;0.62;1", "0;0;1;1", 4, "hot-dot"],
            ["yp-p", "0;0.67;0.83;1", "0;0;1;1", 4, "hot-dot"],
          ].map(([id, times, points, r, cls]) => (
            <circle key={id as string} r={r as number} className={cls as string}>
              <animateMotion dur="14s" repeatCount="indefinite" keyTimes={times as string} keyPoints={points as string} calcMode="linear">
                <mpath href={`#${id}`} />
              </animateMotion>
            </circle>
          ))}
        </svg>
        <div className="ynode is-pill" style={box(1.82, 13.33, 10.91, 8.52)}>
          <h3>Public wallet</h3>
          <p>Balance visible to all</p>
        </div>
        <div className="ynode is-dim" style={box(15.45, 10.74, 13.64, 13.7)}>
          <h3>Shroud</h3>
          <p>ETH or {S} goes in. Small fee.</p>
        </div>
        <div className="ynode flute justify-start!" style={box(35.45, 4.44, 29.09, 49.26)}>
          <h3>{BRAND.name} pool</h3>
          <p>Shared by everyone. Balances unreadable.</p>
          <div className="note-field" aria-hidden="true">
            {["ETH note", `${S} note`, "ETH note", `${S} note`, "ETH note", `${S} note`].map((n, i) => (
              <span key={i} className="note-chip">
                {n}
              </span>
            ))}
          </div>
          <div className="mt-3 border-t border-line pt-2.5 md:mt-auto">
            <strong>Private transfer</strong>
            <span className="sub block">Notes are spent and new ones written, and nothing ties old to new.</span>
          </div>
        </div>
        <div className="ynode" style={box(70.91, 10.74, 13.64, 13.7)}>
          <h3>Unshroud</h3>
          <p>Leave to an address you choose. Flat fee.</p>
        </div>
        <div className="ynode is-pill" style={box(87.27, 13.33, 10.91, 8.52)}>
          <h3>Fresh address</h3>
          <p>Where the exit lands</p>
        </div>
        <div className="ysources" style={box(1.82, 61.11, 10, 20.37)} aria-label="Where trade fees come from">
          <span>Pons launch</span>
          <span>Uniswap v4</span>
          <span>Routers</span>
        </div>
        <div className="ynode" style={box(15, 62.04, 15, 18.52)}>
          <h3>Fee harvester</h3>
          <p>Collects each trade&apos;s creator fee; the larger part goes to holders</p>
          <span className="tag badge">planned</span>
        </div>
        <div className="ynode is-team" style={box(15, 85.56, 8.64, 7.41)}>
          <h3>Team share</h3>
        </div>
        <div className="ynode is-vault" style={box(42.73, 63.89, 14.55, 14.81)}>
          <h3>Fee vault</h3>
          <p>Every fee lands here as {S} backing.</p>
        </div>
        <div className="ynode" style={box(70, 61.11, 28.18, 20.37)}>
          <h3>Shrouded {S}</h3>
          <p>Each share is backed by more over time.</p>
          <div className="holder-notes" aria-hidden="true">
            <span>Note</span>
            <span className="mine">Yours</span>
            <span>Note</span>
          </div>
        </div>
        <div className="ynode is-dim" style={box(73.64, 84.81, 24.55, 8.52)}>
          <h3>Public {S}</h3>
          <p>Earns nothing.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Uses() {
  const items: [string, string, string][] = [
    ["next", "Private settlement", `Desks and treasuries settle with each other inside the pool on ${CHAIN.name}, then exit only what has to be shown.`],
    ["next", "Selective disclosure", "Show one payment or one note to an accountant or a counterparty with a read-only viewing key, and nothing else in your history."],
    ["later", "Private swaps", `Swap shrouded value for other ${CHAIN.name} assets with no visible link between what went in and what came out.`],
    ["later", "Launch privacy coins", "New coins launch straight into the shared pool, so every launch grows the crowd that protects everyone already in it."],
  ];
  const who: [string, string][] = [
    ["Traders", `Hold ${S} in a note instead of a watched wallet, so a position cannot be copied or front-run, and collect fee yield meanwhile.`],
    ["Privacy-minded holders", "Keep savings on-chain without publishing them. Paying a friend no longer hands them your net worth and history."],
    ["Institutions", `Settle on ${CHAIN.name} without broadcasting treasury size, counterparties or timing, and leave the pool to a new address when needed.`],
    ["Communities", "Bring a privacy coin into the same pool instead of a new one. A bigger crowd makes each note harder to single out."],
  ];
  return (
    <section className="wrap py-24 md:py-32" aria-labelledby="uses-title">
      <header className="border-t border-line pt-6">
        <h2 id="uses-title" className="h2-wide max-w-2xl">
          What shrouded {S} is for
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-2">The pool comes first. These pieces are planned on top of it, in order. None of them is live yet.</p>
      </header>
      <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-2 md:gap-5">
        {items.map(([when, t, d]) => (
          <div key={t} tabIndex={0} className="group tick-frame relative min-w-0 overflow-hidden rounded-[2px] border border-line bg-card p-6 md:p-7">
            <div className="flute absolute inset-0 transition-opacity duration-700 ease-out group-hover:opacity-0 group-focus-visible:opacity-0" aria-hidden="true" />
            <div className="relative">
              <span className="tag">{when}</span>
              <h3 className="mt-5 font-mono text-[15px] font-medium tracking-[-0.02em] text-fg md:text-[16px]">{t}</h3>
              <p className="mt-2 max-w-[46ch] text-[14px] leading-relaxed text-fg-2">{d}</p>
            </div>
          </div>
        ))}
      </div>
      <h3 className="eyebrow mt-16">Who shrouds</h3>
      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {who.map(([t, d]) => (
          <div key={t} className="min-w-0">
            <dt className="font-mono text-[15px] font-medium tracking-[-0.02em] text-fg">{t}</dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-fg-2">{d}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function GetToken() {
  const steps: [string, string, string | null][] = [
    ["Buy it like any token.", `A plain ERC-20 on ${CHAIN.name}: the Pons bonding curve first, then a Uniswap v4 pool after it graduates, with routers on top.`, null],
    ["Shroud what you bought.", "A purchase lands publicly in your wallet. Shrouding it in the app turns it into a note that collects fee yield.", null],
    ["Buy straight into a note.", `Pay ETH inside the app and receive ${S} directly as a private note, never sitting in a public wallet.`, "later"],
  ];
  return (
    <section id="get-oarkel" className="relative overflow-hidden py-16 md:py-24" aria-labelledby="get-title">
      <div className="dot-grid fade-y pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="wrap-narrow relative flex flex-col items-center text-center">
        <p className="eyebrow">ERC-20 · {CHAIN.name}</p>
        <div className="mark-halo mt-8 text-fg" aria-hidden="true">
          <SlatMark id="get" size={60} />
        </div>
        <h2 id="get-title" className="mt-8 font-mono text-[28px] leading-[1.5] font-medium tracking-[-0.02em] text-fg md:text-[34px]">
          Get {S}.
        </h2>
        <CopyCaInline />
        <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-fg-2">
          The token is how the protocol pays its private holders. The address is not published yet. When it is, it appears here, on the
          token page and on {BRAND.xHandle}, and nowhere else.
        </p>
        <div className="relative mt-12 w-full">
          <div className="get-track hidden md:block" aria-hidden="true">
            <i />
          </div>
          <ol className="grid grid-cols-1 gap-10 pt-2 md:grid-cols-3 md:gap-0 md:pt-10">
            {steps.map(([t, d, tag], i) => (
              <li key={t} className="get-step relative px-4 md:px-7">
                <p className="font-mono text-[11px] tracking-[0.2em] text-fg-2">0{i + 1}</p>
                <h3 className="mt-2 flex items-center justify-center gap-2 font-mono text-[15px] font-medium tracking-[-0.02em] text-fg">
                  {t}
                  {tag ? <span className="tag">{tag}</span> : null}
                </h3>
                <p className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-relaxed text-fg-2 md:max-w-none">{d}</p>
              </li>
            ))}
          </ol>
        </div>
        <Link href="/token" className="btn-ink mt-12 inline-flex h-10 items-center rounded-full px-6 font-mono text-[14px]">
          Token page
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const GUARANTEES: Guarantee[] = [
  {
    title: "No key can freeze a note.",
    text: "The pool contract has no owner and no admin function. No one is able to lock a note, halt the pool or redirect a payment; shrouds, private payments and exits always work.",
    tag: "in the code",
  },
  {
    title: "Your browser proves it.",
    text: "Your browser builds the zero-knowledge proof in about four seconds. Your notes and keys never leave it; only the proof and nullifiers go on-chain.",
    tag: "in the code",
  },
  {
    title: "Your wallet sends it.",
    text: "Every shroud, private payment and unshroud is submitted from your own wallet. No third party handles your proof and no extra fee is added; the recipient and amounts are bound into the proof.",
    tag: "in the code",
  },
  {
    title: "One signature, all keys.",
    text: "Note keys are derived from a signature by your wallet. Sign again on any device and they come back: there is no seed file to back up.",
    tag: "in the code",
  },
  {
    title: "Immutable, by design.",
    text: "No proxy and no upgrade path; every parameter is fixed when the pool is deployed. A bug cannot be patched, so the code is open source and anyone can check the deployed bytecode against it.",
    tag: "in the code",
  },
  {
    title: "Private holders get paid.",
    text: `Shrouded ${S} collects a share of every protocol fee. The same tokens held in public collect nothing, and that gap is the reason to shroud.`,
  },
];

function Design() {
  return (
    <section className="relative py-16 lg:py-0" aria-labelledby="design-title">
      <div className="wrap-narrow pt-8 lg:pt-28">
        <p className="eyebrow">Contract design</p>
        <h2 id="design-title" className="h2-mono mt-3">
          Built so that nobody, including us, can touch a note.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-2">
          These are the rules the {BRAND.name} contracts are written to. The contracts are written and tested but not deployed yet; each
          rule will be checkable on the explorer the day they are.
        </p>
      </div>
      <div className="mt-12 lg:mt-0">
        <Guarantees items={GUARANTEES} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Faq() {
  return (
    <section id="faq" className="wrap py-24 md:py-32" aria-labelledby="faq-title">
      <header className="mb-12 border-t border-line pt-6 md:mb-16">
        <p className="eyebrow">03 / FAQ</p>
        <h2 id="faq-title" className="h2-wide mt-4 max-w-2xl">
          {BRAND.name}, in plain words.
        </h2>
      </header>
      <div className="border-t border-line">
        {HOME_FAQ.map(([q, a]) => (
          <details key={q} className="group border-b border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-mono text-fg [&::-webkit-details-marker]:hidden">
              <h3 className="min-w-0 text-[15px] font-normal md:text-[16px]">{q}</h3>
              <span aria-hidden="true" className="relative size-3 shrink-0">
                <span className="absolute top-1/2 left-0 h-px w-3 bg-fg-2" />
                <span className="absolute top-0 left-1/2 h-3 w-px bg-fg-2 transition-transform group-open:scale-y-0" />
              </span>
            </summary>
            <p className="max-w-3xl pb-6 text-[16px] leading-relaxed text-fg-2">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="tide flex flex-col" aria-labelledby="final-title">
      <div className="tide-bg" aria-hidden="true" />
      <div className="flex flex-1 flex-col items-center px-4 pt-[18vh] pb-24 text-center md:pt-[22vh]">
        <h2 id="final-title" className="max-w-4xl font-mono text-[44px] leading-[0.95] font-medium tracking-[-0.025em] text-fg md:text-[72px]">
          Drop off the record.
        </h2>
        <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-balance text-fg-2">
          Connect a wallet and walk the whole flow with practice balances. Every step is a free signature; nothing is sent on chain.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/app" className="btn-ink inline-flex h-[52px] items-center rounded-full px-8 font-mono text-[14px] font-semibold">
            Launch app
          </Link>
          <Link href="/docs/get-started" className="btn-ghost inline-flex h-[52px] items-center rounded-full px-8 font-mono text-[14px] text-fg/90">
            Get started guide
          </Link>
        </div>
      </div>
    </section>
  );
}
