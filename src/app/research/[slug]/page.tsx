import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { NOTES, noteBySlug } from "@/components/research/notes";
import { BRAND } from "@/config/brand";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return NOTES.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const note = noteBySlug((await params).slug);
  if (!note) return {};
  return pageMeta({ title: note.title, description: note.description, path: `/research/${note.slug}`, type: "article" });
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const note = noteBySlug((await params).slug);
  if (!note) notFound();
  const i = NOTES.indexOf(note);
  const next = NOTES[(i + 1) % NOTES.length];
  const url = `${BRAND.url}/research/${note.slug}`;
  return (
    <main id="main" className="wrap py-12 md:py-16">
      <JsonLd data={breadcrumbs([{ name: "Research", path: "/research" }, { name: note.title, path: `/research/${note.slug}` }])} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: note.title,
          description: note.description,
          url,
          inLanguage: "en",
          dateModified: "2026-10-06",
          author: { "@type": "Organization", name: BRAND.name, url: BRAND.url },
          publisher: { "@id": `${BRAND.url}/#org` },
          mainEntityOfPage: url,
        }}
      />
      <article className="mx-auto max-w-[780px]">
        <Link href="/research" className="inline-flex items-center gap-1.5 text-[14px] text-fg-2 hover:text-fg">
          <ArrowLeft size={14} /> All research notes
        </Link>
        <p className="label mt-8 text-surge">Research note {String(i + 1).padStart(2, "0")}</p>
        <h1 className="display mt-3 text-[42px] leading-[1.05] md:text-[56px]">{note.title}</h1>
        <p className="mt-4 text-[19px] leading-relaxed text-fg-2">{note.summary}</p>
        <note.Demo />
        <div className="prose-ok mt-4">
          {note.body.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              {s.p.map((p, k) => (
                <p key={k}>{p}</p>
              ))}
            </section>
          ))}
          <h2>Status</h2>
          <p>
            This is research, not a shipped feature. Whether and how it lands in the pool will be written up in the{" "}
            <Link href="/docs/roadmap">roadmap</Link> and the <Link href="/docs/parameters">parameters page</Link>.
          </p>
        </div>
        <div className="mt-14 border-t border-fg pt-6">
          <p className="text-[13px] text-fg-3">Next note</p>
          <Link href={`/research/${next.slug}`} className="display mt-1 inline-block text-[26px] hover:text-surge">
            {next.title}
          </Link>
        </div>
      </article>
    </main>
  );
}
