import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ChainStrip } from "@/components/chain/ChainStrip";
import { CopyCaBlock } from "@/components/CopyCa";
import { HOME_FAQ } from "@/components/home/faq";
import { YieldExample } from "@/components/home/YieldExample";
import { JsonLd } from "@/components/JsonLd";
import { Planned, Redact } from "@/components/ui";
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
      <Compare />
      <Yield />
      <WhoShrouds />
      <BuiltOnPool />
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
    <section className="relative overflow-hidden border-b border-line">
      <div className="wrap grid grid-cols-1 items-center gap-12 pt-14 pb-12 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:pb-16">
        <div className="min-w-0">
          <h1 className="display text-[44px] leading-[1.02] text-fg sm:text-[60px] lg:text-[72px]">
            <span className="block text-surge">{BRAND.name}.</span>{" "}
            <span className="block">Public Chain.</span>{" "}
            <span className="block italic">Private Balance.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-fg-2">
            {BRAND.name} is a privacy protocol for {CHAIN.name}. {BRAND.tagline.replace(" Immutable. No admin.", "")} The contracts are
            designed to be immutable, with no admin.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn-ink inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold">
              Try it in practice <ArrowRight size={16} />
            </Link>
            <Link href="/docs" className="btn-ghost inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold">
              Read the docs
            </Link>
          </div>
          <p className="mt-5 max-w-xl text-[13px] leading-relaxed text-fg-3">
            The private pool is not deployed yet. The app runs the whole shroud, hold and unshroud flow in practice mode, signed by your
            wallet, with no funds moving.
          </p>
        </div>
        <LedgerSlip />
      </div>
      <div className="border-t border-line bg-card/60">
        <div className="wrap py-4">
          <ChainStrip />
        </div>
      </div>
    </section>
  );
}

/** A wallet's public record, with the private values blacked out in turn. */
function LedgerSlip() {
  const rows: [string, string, string][] = [
    ["Balance", "ETH", "3.4210"],
    ["Balance", BRAND.symbol, "182,400.00"],
    ["Paid", "to 0x9b3e…11af", "0.8000 ETH"],
    ["Received", "from 0x52c1…0d7e", "24,000 OARKEL"],
    ["Paid", "to 0xa77f…6c02", "1.2500 ETH"],
  ];
  return (
    <div className="relative min-w-0">
      <div className="sheet ruled relative overflow-hidden px-5 pt-5 pb-6 shadow-[0_30px_60px_-30px_rgb(22_24_29/0.45)] md:px-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-fg pb-3">
          <p className="num text-[13px] text-fg">wallet 0x7f3a…c21e</p>
        </div>
        <ul className="mt-1">
          {rows.map(([kind, what, value], i) => (
            <li key={i} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-[9px] text-[14px]">
              <span className="text-fg-3">{kind}</span>
              <span className="num truncate text-fg-2">{what}</span>
              <span className="num relative text-right text-fg">
                <span className="invisible">{value}</span>
                <span className="absolute inset-0 flex items-center justify-end">
                  <span className="relative">
                    <span className="opacity-0">{value}</span>
                    <span className="redact redact-sweep absolute inset-y-[3px] right-0 left-0 h-auto" style={{ animationDelay: `${i * 0.35}s` }} />
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-relaxed text-fg-3">
          What an explorer shows for this wallet after shrouding: the deposit is still there. The balance and the payments behind it read as a commitment hash.
        </p>
        <span
          aria-hidden="true"
          className="label absolute top-3.5 right-5 z-10 rotate-[-6deg] bg-card rounded-[4px] border-2 border-surge px-2.5 py-1 text-[13px] font-medium tracking-[0.18em] text-surge opacity-90"
        >
          shrouded
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHead({ id, kicker, title, lede, night = false }: { id?: string; kicker: string; title: string; lede?: string; night?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <p id={id} className={`label pt-3 ${night ? "text-ember" : "text-surge"}`}>
        {kicker}
      </p>
      <div className="min-w-0">
        <h2 className={`display text-[34px] leading-[1.08] md:text-[46px] ${night ? "text-mist" : "text-fg"}`}>{title}</h2>
        {lede ? <p className={`mt-4 max-w-2xl text-[17px] leading-relaxed ${night ? "text-mist-2" : "text-fg-2"}`}>{lede}</p> : null}
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Shroud",
      text: `Deposit ETH or ${BRAND.symbol} into the private pool. The deposit itself is a normal public transaction, but what comes back is a private note: an encrypted record of your balance that only your keys can open.`,
      art: (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="num rounded-full border border-line-2 bg-card px-3 py-1">0x7f3a…c21e · 2.00 ETH</span>
          <ArrowRight size={14} className="text-fg-3" />
          <span className="num inline-flex items-center gap-2 rounded-full bg-fg px-3 py-1 text-paper">
            note <Redact w={5} className="bg-paper" />
          </span>
        </div>
      ),
    },
    {
      n: "02",
      title: "Hold",
      text: `Leave the note in the pool. Shrouded ${BRAND.symbol} carries a share of the fee vault, and every protocol fee that lands there raises what each share is worth. Holding in a public wallet earns none of it.`,
      art: (
        <div className="flex items-end gap-1.5" aria-hidden="true">
          {[22, 26, 29, 33, 38, 42, 47, 53].map((h, i) => (
            <span key={i} className="w-4 rounded-t-[2px] bg-fg" style={{ height: h, opacity: 0.35 + i * 0.08 }} />
          ))}
          <span className="ml-2 text-[13px] text-fg-3">share value, as fees arrive</span>
        </div>
      ),
    },
    {
      n: "03",
      title: "Spend or unshroud",
      text: "Pay someone inside the pool without a public trail, or pull the value out to whichever address you pick. A zero-knowledge proof convinces the contract the money is yours without saying which note it came from.",
      art: (
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="num inline-flex items-center gap-2 rounded-full bg-fg px-3 py-1 text-paper">
            note <Redact w={5} className="bg-paper" />
          </span>
          <ArrowRight size={14} className="text-fg-3" />
          <span className="rounded-full border border-surge px-3 py-1 text-surge">proof checks out</span>
          <ArrowRight size={14} className="text-fg-3" />
          <span className="num rounded-full border border-line-2 bg-card px-3 py-1">any address</span>
        </div>
      ),
    },
  ];
  return (
    <section className="border-b border-line py-20 md:py-28" aria-labelledby="how-title">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <p id="how-it-works" className="label pt-3 text-surge">
            How it works
          </p>
          <div className="min-w-0">
            <h2 id="how-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
              Shroud, hold, then spend: three moves from public to private
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-2">
              On {CHAIN.name}, like on every public chain, anyone can paste your address into an explorer and read your balance and every
              payment you have made. {BRAND.name} gives you a second place to keep value, where the chain can check the math but cannot read
              the numbers.
            </p>
          </div>
        </div>
        <ol className="mt-14 border-t border-fg">
          {steps.map((s) => (
            <li key={s.n} className="grid grid-cols-1 gap-5 border-b border-line py-9 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,0.9fr)]">
              <p className="display text-[56px] leading-none text-surge">{s.n}</p>
              <div className="min-w-0">
                <h3 className="display text-[30px] leading-tight">{s.title}</h3>
                <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-fg-2">{s.text}</p>
              </div>
              <div className="flex min-w-0 items-center md:col-start-2 lg:col-start-3">{s.art}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Compare() {
  const publicRows: [string, string, string][] = [
    ["0x7f3a…c21e", "182,400 OARKEL", "paid 0x9b3e…11af"],
    ["0x9b3e…11af", "41,050 OARKEL", "paid 0x52c1…0d7e"],
    ["0x52c1…0d7e", "9,800 OARKEL", "tagged: exchange"],
  ];
  return (
    <section className="night bg-night py-20 text-mist md:py-28" aria-labelledby="compare-title">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <p className="label pt-3 text-ember">What changes</p>
          <div className="min-w-0">
            <h2 id="compare-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
              A public token is a public diary. A private note is a sealed envelope.
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-mist-2">
              The difference is not what you own but who can read it. Once one of your addresses is linked to your name, by an exchange
              withdrawal or a single tagged payment, a public token tells that story to everyone. A shrouded balance does not.
            </p>
          </div>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="tile min-w-0 p-5 md:p-6">
            <p className="label text-mist-3">Ordinary ERC-20 · readable by anyone</p>
            <div className="table-scroll">
              <table className="w-full min-w-[420px] text-left text-[13.5px]">
                <thead>
                  <tr className="text-mist-3">
                    <th className="py-2 pr-3 font-normal">Holder</th>
                    <th className="py-2 pr-3 font-normal">Balance</th>
                    <th className="py-2 font-normal">Last move</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {publicRows.map((r) => (
                    <tr key={r[0]} className="border-t border-night-3">
                      <td className="py-2.5 pr-3">{r[0]}</td>
                      <td className="py-2.5 pr-3">{r[1]}</td>
                      <td className="py-2.5 text-mist-2">{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-mist-2">
              Every balance and every transfer is a permanent public row. Follow one tagged address and the rest of the chain unravels.
            </p>
          </div>
          <div className="tile min-w-0 p-5 md:p-6">
            <p className="label text-ember">Shrouded with {BRAND.name} · readable by the owner</p>
            <div className="table-scroll">
              <table className="w-full min-w-[420px] text-left text-[13.5px]">
                <thead>
                  <tr className="text-mist-3">
                    <th className="py-2 pr-3 font-normal">Holder</th>
                    <th className="py-2 pr-3 font-normal">Balance</th>
                    <th className="py-2 font-normal">Last move</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {["0x1c8e…a90b", "0x6d02…44f1", "0xe5b7…19c3"].map((c) => (
                    <tr key={c} className="border-t border-night-3">
                      <td className="py-2.5 pr-3 text-mist-2">commitment {c}</td>
                      <td className="py-2.5 pr-3">
                        <Redact w={9} />
                      </td>
                      <td className="py-2.5">
                        <Redact w={10} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-mist-2">
              The chain stores commitments, which look alike. Who owns each one, how much it holds and where it went stay with the keys.
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-3xl text-[15px] leading-relaxed text-mist-2">
          One honest limit: the deposit that enters the pool and the withdrawal that leaves it are public transactions. {BRAND.name} hides the
          path between them, which is why exits are designed to land on any fresh address and why a larger crowd in the pool protects
          everyone in it.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Yield() {
  const sources: [string, string][] = [
    [`Creator fee on ${BRAND.symbol} trades`, "A cut of the launchpad creator fee on every buy and sell is routed to buy back for the vault."],
    ["Shroud fee", "A small fee taken when value enters the pool."],
    ["Unshroud fee", "A flat fee per withdrawal, so the fee reveals nothing about the note's size or age."],
    ["Private transfer fee", "A small fee on payments made inside the pool."],
  ];
  return (
    <section className="border-b border-line py-20 md:py-28" aria-labelledby="yield-title">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <p id="yield" className="label pt-3 text-surge">
            Holder yield
          </p>
          <div className="min-w-0">
            <h2 id="yield-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
              Private holders earn the protocol fees. Public holders earn nothing.
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-2">
              This is the part most privacy tools leave out: a reason to stay private. Every fee the protocol takes is designed to flow into
              one vault, and the vault belongs to shrouded {BRAND.symbol}. The more activity the protocol sees, the more each private share is
              worth. It is passive yield that needs no staking step and no claim button.
            </p>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[18px] font-semibold">Where the fees come from</h3>
              <Planned />
            </div>
            <ul className="mt-4 border-t border-fg">
              {sources.map(([t, d]) => (
                <li key={t} className="grid grid-cols-1 gap-1 border-b border-line py-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-6">
                  <p className="font-semibold text-fg">{t}</p>
                  <p className="text-[15px] leading-relaxed text-fg-2">{d}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <div className="rounded-[10px] bg-fg px-4 py-3 text-paper">
                <p className="label text-paper/60">Fee vault</p>
                <p className="mt-1 text-[14.5px]">Fees land here as {BRAND.symbol} backing. No new shares are minted.</p>
              </div>
              <ArrowRight size={18} className="mx-auto rotate-90 text-fg-3 sm:rotate-0" />
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-[10px] border border-up/40 bg-card px-4 py-2.5">
                  <p className="text-[14px] font-semibold text-up">Private {BRAND.symbol} notes</p>
                  <p className="text-[13px] text-fg-2">Each share is now backed by more {BRAND.symbol}.</p>
                </div>
                <div className="rounded-[10px] border border-line-2 bg-card px-4 py-2.5">
                  <p className="text-[14px] font-semibold text-fg-3">Public wallets</p>
                  <p className="text-[13px] text-fg-3">Same balance as before.</p>
                </div>
              </div>
            </div>
            <p className="mt-6 text-[14px] leading-relaxed text-fg-3">
              Rates are not final and yield can be zero: it is paid from real fees, never printed. Shrouded ETH pays fees into the vault
              too; in the planned design the yield itself accrues to shrouded {BRAND.symbol}.
            </p>
          </div>
          <YieldExample />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function WhoShrouds() {
  const who: [string, string, string][] = [
    [
      "A",
      "Traders",
      `Hold ${BRAND.symbol} in a private note instead of a watched wallet, so a position cannot be copied, front-run or used against you, and collect fee yield while you wait.`,
    ],
    [
      "B",
      "Privacy-minded holders",
      "Keep savings on-chain without publishing them. Paying a friend or a merchant no longer hands them a full view of your net worth and history.",
    ],
    [
      "C",
      "Institutions",
      `Settle on ${CHAIN.name} without broadcasting treasury size, counterparties or timing to competitors, and withdraw to a fresh address when a payment must be public.`,
    ],
    [
      "D",
      "Communities",
      "Launch a privacy coin into the same pool instead of a new one. Every coin that joins adds to one shared crowd, and a bigger crowd makes each note harder to single out.",
    ],
  ];
  return (
    <section className="border-b border-line py-20 md:py-28">
      <div className="wrap">
        <SectionHead kicker="Who it is for" title="Who shrouds, and what they get out of it" />
        <dl className="mt-14 grid grid-cols-1 border-t border-l border-line md:grid-cols-2">
          {who.map(([k, t, d]) => (
            <div key={k} className="min-w-0 border-r border-b border-line bg-card/50 p-6 md:p-8">
              <dt className="flex items-baseline gap-3">
                <span className="display text-[28px] text-surge">{k}.</span>
                <span className="display text-[26px]">{t}</span>
              </dt>
              <dd className="mt-3 text-[15.5px] leading-relaxed text-fg-2">{d}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function BuiltOnPool() {
  const items: [string, string, string][] = [
    ["Relayer support", "Next", "A relayer sends the shroud or unshroud transaction on your behalf and covers gas, recovering its fee from the note. The receiving wallet never needs ETH."],
    ["Private settlement", "Next", `Desks and treasuries settle with each other inside the pool on ${CHAIN.name}, then exit only what must be shown.`],
    ["Private swaps", "Later", `Swap shrouded value for other ${CHAIN.name} assets with no visible link between what went in and what came out.`],
    ["Community privacy coins", "Later", "New coins launch straight into the shared pool, so every launch grows the crowd for everyone already in it."],
  ];
  return (
    <section className="border-b border-line py-20 md:py-24" aria-labelledby="built-title">
      <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <p className="label pt-3 text-surge">On the roadmap</p>
        <div className="min-w-0">
          <h2 id="built-title" className="display text-[34px] leading-[1.08] md:text-[42px]">
            One shared pool, with more built on top of it
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-2">
            The pool comes first. These are the pieces planned around it, in order. None of them is live yet.
          </p>
          <ul className="mt-10 border-t border-fg">
            {items.map(([t, when, d]) => (
              <li key={t} className="grid grid-cols-1 gap-2 border-b border-line py-5 md:grid-cols-[minmax(0,0.8fr)_80px_minmax(0,1.6fr)] md:gap-6">
                <p className="text-[17px] font-semibold">{t}</p>
                <p className="label pt-1 text-fg-3">{when}</p>
                <p className="text-[15.5px] leading-relaxed text-fg-2">{d}</p>
              </li>
            ))}
          </ul>
          <Link href="/docs/roadmap" className="link mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold">
            Read the full roadmap <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function GetToken() {
  const steps: [string, string, string | null][] = [
    [
      "Buy it like any token",
      `${BRAND.symbol} is planned as a plain ERC-20 on ${CHAIN.name}. It launches on the Pons bonding curve, moves to a Uniswap v4 pool when it graduates, and aggregators can route to it from there.`,
      null,
    ],
    [
      "Shroud what you bought",
      "A purchase lands publicly in your wallet, like any trade. Shrouding it in the app turns it into a note that collects fee yield.",
      null,
    ],
    ["Buy straight into a note", `Pay ETH inside the app and receive ${BRAND.symbol} directly as a private note, so the purchase never sits in a public wallet.`, "Later"],
  ];
  return (
    <section className="border-b border-line py-20 md:py-28" aria-labelledby="get-title">
      <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <p id="get-oarkel" className="label pt-3 text-surge">
          ERC-20 on {CHAIN.name}
        </p>
        <div className="min-w-0">
          <h2 id="get-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
            How to get {BRAND.symbol}
          </h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-2">
            The token is how the protocol pays its private holders. The contract address is not published yet: when it is, it appears below,
            on the token page and on {BRAND.xHandle}, and nowhere else.
          </p>
          <ol className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map(([t, d, tag], i) => (
              <li key={t} className="tile min-w-0 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-[13px] text-fg-3">step {i + 1}</span>
                  {tag ? <Planned>{tag}</Planned> : null}
                </div>
                <p className="mt-3 text-[17px] font-semibold">{t}</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{d}</p>
              </li>
            ))}
          </ol>
          <CopyCaBlock className="mt-6" />
          <Link href="/token" className="link mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold">
            Token details and the buy card <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Design() {
  const props: [string, string][] = [
    ["No admin keys", "No address can move, freeze or redirect a note. There is no owner role over user funds."],
    ["Immutable contracts", "No proxy and no upgrade path. The code that holds deposits on day one is the code that holds them forever."],
    ["Exits cannot be paused", "At most, new deposits could be capped or halted. Private payments and exits keep working no matter what."],
    ["Proofs made on your device", "Your browser builds the zero-knowledge proof. Your notes and keys stay inside your browser."],
    ["Keys from one signature", "Note keys are derived from a signature by your wallet; sign again on any device and they come back."],
  ];
  return (
    <section className="night bg-night py-20 text-mist md:py-28" aria-labelledby="design-title">
      <div className="wrap">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <p className="label pt-3 text-ember">Contract design</p>
          <div className="min-w-0">
            <h2 id="design-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
              Built so that nobody, including us, can touch a note
            </h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-mist-2">
              These are the rules the {BRAND.name} contracts are being written to. They are design goals for contracts that are not deployed
              yet, and each one will be checkable on the explorer the day they are.
            </p>
          </div>
        </div>
        <ul className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-night-3 bg-night-3 md:grid-cols-2 lg:grid-cols-3">
          {props.map(([t, d]) => (
            <li key={t} className="min-w-0 bg-night p-6">
              <Planned tone="night" />
              <p className="mt-4 text-[18px] font-semibold text-mist">{t}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-mist-2">{d}</p>
            </li>
          ))}
          <li className="min-w-0 bg-night-2 p-6">
            <p className="label text-ember">The trade-off</p>
            <p className="mt-4 text-[18px] font-semibold text-mist">A bug cannot be patched</p>
            <p className="mt-2 text-[15px] leading-relaxed text-mist-2">
              Without an admin there is nobody to ship a fix. That is why the plan is a public review, staged deposit caps and a bounty
              before real value goes in.
            </p>
          </li>
        </ul>
        <p className="display mt-16 max-w-4xl text-[30px] leading-[1.15] md:text-[40px]">
          The short version: private holders earn, public holders get nothing, and no one holds a key that can change that.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Faq() {
  return (
    <section className="border-b border-line py-20 md:py-28" aria-labelledby="faq-title">
      <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <p id="faq" className="label pt-3 text-surge">
          FAQ
        </p>
        <div className="min-w-0">
          <h2 id="faq-title" className="display text-[34px] leading-[1.08] md:text-[46px]">
            Questions people ask about {BRAND.name}
          </h2>
          <div className="mt-10 border-t border-fg">
            {HOME_FAQ.map(([q, a]) => (
              <details key={q} className="group border-b border-line py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                  <h3 className="min-w-0">{q}</h3>
                  <span aria-hidden="true" className="num mt-0.5 shrink-0 text-surge transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-fg-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section className="py-20 md:py-28">
      <div className="wrap">
        <div className="sheet ruled grid grid-cols-1 gap-8 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:p-10">
          <div className="min-w-0">
            <h2 className="display text-[36px] leading-[1.05] md:text-[52px]">Walk through it before it is live</h2>
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-fg-2">
              Connect a wallet, open a practice account and shroud, hold, send and unshroud with practice balances. Each step is a free
              signature in your own wallet. No transaction is sent and no real funds move.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/app" className="btn-surge inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold">
              Open the app <ArrowRight size={16} />
            </Link>
            <Link href="/docs/get-started" className="btn-ghost inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold">
              Get started guide
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
