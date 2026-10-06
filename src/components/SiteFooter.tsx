import Link from "next/link";
import { ChainStrip } from "@/components/chain/ChainStrip";
import { CopyCaBlock } from "@/components/CopyCa";
import { BRAND, hasGithub } from "@/config/brand";
import { poolLive } from "@/config/contracts";
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
      { href: "/docs/contracts", label: "Contracts" },
      { href: "/docs/trust-model", label: "Team powers" },
      ...(hasGithub ? [{ href: BRAND.github, label: "GitHub", external: true }] : []),
    ],
  },
  {
    title: BRAND.name,
    links: [
      { href: "/token", label: `${BRAND.symbol} token` },
      { href: "/#faq", label: "FAQ" },
      { href: "/app", label: "Launch app" },
    ],
  },
];

const linkCls = "text-[14px] leading-5 text-[#ededed] underline-offset-4 decoration-white/40 transition-colors duration-150 hover:underline";

export function SiteFooter() {
  return (
    <footer className="dither-footer">
      <div className="dither-footer-bg" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-[1152px] px-4 pt-16 md:px-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 md:gap-8">
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="min-w-0">
              <p className="font-mono text-[12px] leading-4 text-white/60 uppercase">{col.title}</p>
              <ul className="mt-5 flex flex-col gap-3.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noreferrer" className={linkCls}>
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className={linkCls}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <CopyCaBlock tone="night" className="w-full max-w-xl" />
          <p className="font-mono text-[12px] text-white/50">
            {poolLive() ? "Pool live on Robinhood Chain" : "Contracts written, not deployed yet · the app runs in practice mode"}
          </p>
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 lg:flex-row lg:items-center lg:justify-between">
          <ChainStrip note={false} compact />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[12px] text-white/60">
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                GitHub
              </a>
            ) : null}
            {hasX ? (
              <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X (${BRAND.xHandle})`} className="transition-colors hover:text-white">
                X
              </a>
            ) : null}
            <span className="whitespace-nowrap">© 2026 {BRAND.domain}</span>
          </div>
        </div>
      </div>
      <p className="footer-wordmark relative mt-10" aria-hidden="true">
        OARKEL
      </p>
    </footer>
  );
}
