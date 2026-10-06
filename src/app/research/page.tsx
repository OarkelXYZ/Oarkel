import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { JsonLd } from "@/components/JsonLd";
import { NOTES } from "@/components/research/notes";
import { BRAND } from "@/config/brand";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Research",
  description: `${BRAND.name} privacy research: six interactive notes on the metadata leaks around private notes, from root timing and exit amounts to the real anonymity set.`,
  path: "/research",
});

export default function ResearchPage() {
  return (
    <main id="main" className="wrap py-14 md:py-20">
      <JsonLd data={breadcrumbs([{ name: "Research", path: "/research" }])} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <p className="label pt-3 text-surge">Research notes</p>
        <div className="min-w-0">
          <h1 className="display text-[44px] leading-[1.03] md:text-[60px]">Privacy research: what leaks around a private note</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-fg-2">
            Encryption hides what a note holds. It does not stop timing, amounts or habits from pointing at the person behind it. These
            notes take one leak at a time, show it in a small model you can play with, and describe how {BRAND.name} might close it.
          </p>
          <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fg-3">
            The models are illustrations with their assumptions written underneath. None of the numbers is read from a live pool.
          </p>
        </div>
      </div>
      <ol className="mt-14 border-t border-fg">
        {NOTES.map((n, i) => (
          <li key={n.slug} className="grid grid-cols-1 gap-6 border-b border-line py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
            <p className="display text-[44px] leading-none text-surge">{String(i + 1).padStart(2, "0")}</p>
            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <div className="min-w-0">
                <h2 className="display text-[30px] leading-tight">{n.title}</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-fg-2">{n.summary}</p>
                <Link href={`/research/${n.slug}`} className="link mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold">
                  Read the note: {n.title.toLowerCase()} <ArrowRight size={14} />
                </Link>
              </div>
              <div className="min-w-0 [&_figure]:mt-0">
                <n.Demo />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
