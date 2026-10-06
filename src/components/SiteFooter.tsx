import Link from "next/link";
import { ChainStrip } from "@/components/chain/ChainStrip";
import { CopyCaBlock } from "@/components/CopyCa";
import { XGlyph } from "@/components/icons";
import { Wordmark } from "@/components/Mark";
import { BRAND, CHAIN, hasGithub } from "@/config/brand";
import { hasX } from "@/lib/seo";

const COLUMNS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: "Protocol",
    links: [
      { href: "/#how-it-works", label: "How shrouding works" },
      { href: "/#yield", label: "Private holder yield" },
      { href: "/research", label: "Privacy research" },
      { href: "/docs/roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/contracts", label: "Planned contracts" },
      { href: "/docs/trust-model", label: "Team powers" },
      ...(hasGithub ? [{ href: BRAND.github, label: "GitHub", external: true }] : []),
    ],
  },
  {
    title: BRAND.name,
    links: [
      { href: "/token", label: `Get ${BRAND.symbol}` },
      { href: "/#faq", label: "FAQ" },
      { href: "/app", label: "Open the app" },
      ...(hasX ? [{ href: BRAND.x, label: `X ${BRAND.xHandle}`, external: true }] : []),
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="night mt-0 bg-night text-mist">
      <div className="wrap grid grid-cols-1 gap-10 pt-16 pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)]">
        <div className="min-w-0">
          <Wordmark className="text-mist" />
          <p className="mt-4 max-w-sm text-[14.5px] leading-relaxed text-mist-2">
            {BRAND.name} is a {BRAND.category} for {CHAIN.name}. {BRAND.slogan}
          </p>
          <CopyCaBlock tone="night" className="mt-6 max-w-md" />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <p className="label text-mist-3">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-2.5 text-[14.5px]">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a href={l.href} target="_blank" rel="noreferrer" className="text-mist-2 transition-colors hover:text-mist">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link href={l.href} className="text-mist-2 transition-colors hover:text-mist">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-night-3">
        <div className="wrap flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:justify-between">
          <ChainStrip tone="night" />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-mist-3">
            <span>Contracts not deployed · app runs in practice mode</span>
            {hasX ? (
              <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`} className="text-mist-2 hover:text-mist">
                <XGlyph size={15} />
              </a>
            ) : null}
            <span className="whitespace-nowrap">© 2026 {BRAND.domain}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
