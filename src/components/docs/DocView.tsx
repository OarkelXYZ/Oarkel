import Link from "next/link";
import { ArrowLeft, ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { CopyPage, DocsSidebar, DocsToc } from "@/components/docs/DocsChrome";
import { JsonLd } from "@/components/JsonLd";
import { DOCS, docHref, type Doc } from "@/components/docs/content";
import { BRAND } from "@/config/brand";
import { breadcrumbs } from "@/lib/seo";

export function DocView({ doc }: { doc: Doc }) {
  const i = DOCS.indexOf(doc);
  const prev = DOCS[i - 1];
  const next = DOCS[i + 1];
  const url = `${BRAND.url}${docHref(doc.slug)}`;
  const data = [
    breadcrumbs(doc.slug ? [{ name: "Docs", path: "/docs" }, { name: doc.nav, path: docHref(doc.slug) }] : [{ name: "Docs", path: "/docs" }]),
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: doc.h1,
      description: doc.description,
      url,
      inLanguage: "en",
      keywords: doc.keyword,
      dateModified: "2026-10-06",
      author: { "@type": "Organization", name: BRAND.name, url: BRAND.url },
      publisher: { "@id": `${BRAND.url}/#org` },
      mainEntityOfPage: url,
    },
  ];
  const items = DOCS.map((d) => ({ slug: d.slug, href: docHref(d.slug), nav: d.nav, group: d.group, h1: d.h1 }));
  const toc = doc.sections.map((s) => ({ id: s.id, h: s.h }));
  return (
    <main id="main" className="mx-auto w-full max-w-[1248px] px-4 pt-[104px] pb-24 md:pt-[112px]">
      {data.map((d, n) => (
        <JsonLd key={n} data={d} />
      ))}
      <div className="flex gap-10 xl:gap-12">
        <aside className="sticky top-24 hidden max-h-[calc(100vh-112px)] w-[260px] shrink-0 self-start overflow-y-auto pr-2 lg:block">
          <DocsSidebar items={items} current={doc.slug} />
        </aside>
        <article className="min-w-0 flex-1 lg:max-w-[656px]">
          <details className="group mb-8 rounded-[10px] border border-white/10 bg-white/[0.02] lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-mono text-[12.5px] [&::-webkit-details-marker]:hidden">
              <span>
                Docs <span className="text-fg-3">/ {doc.nav}</span>
              </span>
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-white/10 px-2 pt-4 pb-3">
              <DocsSidebar items={items} current={doc.slug} />
            </div>
          </details>
          {doc.slug ? <p className="font-mono text-[11px] tracking-[0.3em] text-white/45 uppercase">{doc.group}</p> : null}
          <h1 className={`font-mono text-[30px] leading-[1.15] font-medium tracking-[-0.025em] text-fg md:text-[36px] ${doc.slug ? "mt-3" : ""}`}>
            {doc.h1}
          </h1>
          <p className="mt-4 text-[18px] leading-relaxed text-white/60">{doc.lede}</p>
          <div className="mt-7">
            <CopyPage />
          </div>
          <hr className="mt-8 border-white/10" />
          {toc.length > 1 ? (
            <details className="mt-8 rounded-[10px] border border-white/10 bg-white/[0.02] px-4 py-3 xl:hidden">
              <summary className="cursor-pointer font-mono text-[11px] tracking-[0.25em] text-white/55 uppercase">On this page</summary>
              <ul className="mt-3 flex flex-col gap-1.5 text-[14px]">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="text-white/70 hover:text-white">
                      {t.h}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="prose-ok">
            {doc.sections.map((s) => (
              <section key={s.id} aria-labelledby={s.id}>
                <h2 id={s.id}>{s.h}</h2>
                {s.body}
              </section>
            ))}
          </div>
          <nav className="mt-16 grid grid-cols-1 gap-3 border-t border-white/10 pt-6 sm:grid-cols-2" aria-label="Previous and next page">
            {prev ? (
              <Link href={docHref(prev.slug)} className="group flex flex-col rounded-[8px] border border-white/10 px-4 py-3.5 transition-colors hover:border-white/25">
                <span className="flex items-center gap-1 font-mono text-[11.5px] text-white/50">
                  <ArrowLeft size={12} /> Previous
                </span>
                <span className="mt-1 text-[15px] text-fg">{prev.nav}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link href={docHref(next.slug)} className="group flex flex-col items-end rounded-[8px] border border-white/10 px-4 py-3.5 text-right transition-colors hover:border-white/25">
                <span className="flex items-center gap-1 font-mono text-[11.5px] text-white/50">
                  Next <ArrowRight size={12} />
                </span>
                <span className="mt-1 text-[15px] text-fg">{next.nav}</span>
              </Link>
            ) : null}
          </nav>
        </article>
        {toc.length > 1 ? (
          <aside className="sticky top-24 hidden w-[220px] shrink-0 self-start xl:block">
            <DocsToc items={toc} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}
