import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ChainStrip } from "@/components/chain/ChainStrip";
import { CopyCaBlock } from "@/components/CopyCa";
import { JsonLd } from "@/components/JsonLd";
import { OnchainFacts } from "@/components/token/OnchainFacts";
import { ChainTrade } from "@/components/trade/ChainTrade";
import { BRAND, CHAIN, PONS, TOKEN, isAddress } from "@/config/brand";
import { breadcrumbs, hasX, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `The ${BRAND.name} ${BRAND.symbol} token on ${CHAIN.name}: official contract address, how to buy it on Pons, and how shrouding it earns a share of protocol fees.`,
  path: "/token",
});

export default function TokenPage() {
  const token = isAddress(BRAND.ca) ? BRAND.ca : null;
  const links: { label: string; href: string | null }[] = [
    { label: "Explorer", href: TOKEN.explorerUrl },
    { label: "Pons launch page", href: token ? PONS.page(token) : null },
    { label: "Chart", href: TOKEN.chartUrl },
    { label: `X ${BRAND.xHandle}`, href: hasX ? BRAND.x : null },
  ];
  const facts: [string, string][] = [
    ["Name", BRAND.name],
    ["Ticker", BRAND.symbol],
    ["Network", `${CHAIN.name} · chain id ${CHAIN.id}`],
    ["Standard", "ERC-20"],
    ["Launch venue", "Pons bonding curve, then Uniswap v4"],
    ["Contract", token ?? "Coming soon"],
  ];
  return (
    <main id="main" className="wrap pt-[120px] pb-20 md:pt-[136px]">
      <JsonLd data={breadcrumbs([{ name: `${BRAND.symbol} token`, path: "/token" }])} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <p className="eyebrow">ERC-20 · {CHAIN.name}</p>
          <h1 className="mt-4 font-mono text-[30px] leading-[1.15] font-medium tracking-[-0.025em] md:text-[36px]">
            {BRAND.name} ({BRAND.symbol}) token
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-white/60">
            {BRAND.symbol} is the token of {BRAND.name}, the privacy protocol for {CHAIN.name}. Held in a public wallet it is an ordinary
            ERC-20. Shrouded into the private pool it becomes a note that, by the pool contract&apos;s design, earns a share of every protocol fee.
          </p>
          {!token ? (
            <p className="mt-6 max-w-2xl rounded-[8px] border border-l-[3px] border-white/10 border-l-surge bg-white/[0.025] px-5 py-4 text-[15px] leading-relaxed">
              Contract address coming soon. It will be published here, in the site footer and on {BRAND.xHandle} at the same time. Until
              then, any token using the name or ticker is not ours.
            </p>
          ) : null}
          <CopyCaBlock className="mt-6" />

          <h2 className="mt-14 border-t border-line pt-6 font-mono text-[20px] leading-tight font-medium tracking-[-0.02em] md:text-[22px]">Token details</h2>
          <dl className="mt-4 border-t border-line">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-1 gap-1 border-b border-line py-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <dt className="text-[14px] text-fg-3">{k}</dt>
                <dd className="num text-[13.5px] break-all text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="tile mt-5 p-4">
            <p className="eyebrow mb-3">Read from the contract</p>
            <OnchainFacts />
          </div>
          <ul className="mt-5 flex flex-wrap gap-2">
            {links.map((l) =>
              l.href ? (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer" className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-full px-4 font-mono text-[12px]">
                    {l.label} <ArrowUpRight size={13} />
                  </a>
                </li>
              ) : (
                <li key={l.label}>
                  <span className="btn-ghost inline-flex h-9 items-center rounded-full px-4 font-mono text-[12px] opacity-50" aria-disabled="true">
                    {l.label} · at launch
                  </span>
                </li>
              ),
            )}
          </ul>

          <h2 className="mt-14 border-t border-line pt-6 font-mono text-[20px] leading-tight font-medium tracking-[-0.02em] md:text-[22px]">How to buy {BRAND.symbol}</h2>
          <div className="prose-ok mt-2">
          <ol>
            <li>Connect an EVM wallet. The site adds {CHAIN.name} to it for you.</li>
            <li>Hold some ETH on {CHAIN.name} for the purchase and for gas.</li>
            <li>Check the contract address above against {BRAND.xHandle}, enter an amount in the buy card and sign the swap in your wallet.</li>
            <li>
              Shroud what you bought in the <Link href="/app/shroud">app</Link> so it earns from the fee vault instead of sitting in public.
            </li>
          </ol>
          </div>
          <h2 className="mt-14 border-t border-line pt-6 font-mono text-[20px] leading-tight font-medium tracking-[-0.02em] md:text-[22px]">Why shroud {BRAND.symbol}</h2>
          <div className="prose-ok mt-2">
          <p>
            Every fee the protocol takes is designed to reach one vault that backs shrouded {BRAND.symbol}. Public holders get none of it.
            Read <Link href="/docs/pool-and-yield">vault and yield</Link> for the share arithmetic, and{" "}
            <Link href="/docs/fees">fees</Link> for each source.
          </p>
          </div>
        </div>
        <aside className="min-w-0" id="buy">
          <div className="lg:sticky lg:top-24">
            <ChainTrade token={token} symbol={BRAND.ticker} title={`Buy ${BRAND.symbol}`} />
            <p className="mt-3 text-[12.5px] leading-relaxed text-fg-3">
              Quotes come from the Pons contracts on {CHAIN.name}; every swap is signed in your own wallet. The card switches on by itself
              when the contract address is published.
            </p>
          </div>
        </aside>
      </div>
      <div className="mt-16 border-t border-line pt-5">
        <ChainStrip />
      </div>
    </main>
  );
}
