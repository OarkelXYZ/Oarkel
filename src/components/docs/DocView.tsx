import Link from "next/link";
import { ArrowLeft, ArrowRight, CaretDown } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { DOCS, docHref, type Doc } from "@/components/docs/content";
import { BRAND } from "@/config/brand";
import { breadcrumbs } from "@/lib/seo";

function DocNav({ doc }: { doc: Doc }) {
  const groups = [...new Set(DOCS.map((d) => d.group))];
  return (
    <>
      {groups.map((g) => (
        <div key={g} className="mb-6">
          <p className="label mb-2 text-fg-3">{g}</p>
          <ul className="border-l border-line">
            {DOCS.filter((d) => d.group === g).map((d) => (
              <li key={d.slug}>
                <Link
                  href={docHref(d.slug)}
                  aria-current={d === doc ? "page" : undefined}
                  className={`-ml-px block border-l-2 py-1.5 pl-3 text-[14.5px] transition-colors ${
                    d === doc ? "border-surge font-semibold text-fg" : "border-transparent text-fg-2 hover:border-line-2 hover:text-fg"
                  }`}
                >
                  {d.nav}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

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
  return (
    <main id="main" className="wrap py-10 md:py-14">
      {data.map((d, n) => (
        <JsonLd key={n} data={d} />
      ))}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14">
        <aside className="min-w-0">
          <details className="group tile lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14.5px] font-semibold [&::-webkit-details-marker]:hidden">
              <span>
                Docs: <span className="font-normal text-fg-2">{doc.nav}</span>
              </span>
              <CaretDown size={14} className="transition-transform group-open:rotate-180" />
            </summary>
            <nav aria-label="Docs pages" className="border-t border-line px-4 pt-4">
              <DocNav doc={doc} />
            </nav>
          </details>
          <nav aria-label="Docs sections" className="sticky top-24 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2 lg:block">
            <DocNav doc={doc} />
          </nav>
        </aside>
        <article className="min-w-0 max-w-[760px]">
          <p className="label text-surge">{doc.group}</p>
          <h1 className="display mt-3 text-[40px] leading-[1.05] md:text-[52px]">{doc.h1}</h1>
          <p className="mt-4 text-[19px] leading-relaxed text-fg-2">{doc.lede}</p>
          {doc.sections.length > 1 ? (
            <nav aria-label="On this page" className="mt-7 border-y border-line py-4">
              <p className="label text-fg-3">On this page</p>
              <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[14.5px]">
                {doc.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="link text-fg-2 hover:text-fg">
                      {s.h}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <div className="prose-ok mt-2">
            {doc.sections.map((s) => (
              <section key={s.id} aria-labelledby={s.id}>
                <h2 id={s.id}>{s.h}</h2>
                {s.body}
              </section>
            ))}
          </div>
          <nav className="mt-16 grid grid-cols-1 gap-3 border-t border-fg pt-6 sm:grid-cols-2" aria-label="Previous and next page">
            {prev ? (
              <Link href={docHref(prev.slug)} className="tile group flex flex-col px-4 py-3.5 transition-colors hover:bg-card-2">
                <span className="flex items-center gap-1 text-[12.5px] text-fg-3">
                  <ArrowLeft size={12} /> Previous
                </span>
                <span className="mt-0.5 font-semibold group-hover:text-surge">{prev.nav}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link href={docHref(next.slug)} className="tile group flex flex-col items-end px-4 py-3.5 text-right transition-colors hover:bg-card-2">
                <span className="flex items-center gap-1 text-[12.5px] text-fg-3">
                  Next <ArrowRight size={12} />
                </span>
                <span className="mt-0.5 font-semibold group-hover:text-surge">{next.nav}</span>
              </Link>
            ) : null}
          </nav>
        </article>
      </div>
    </main>
  );
}
