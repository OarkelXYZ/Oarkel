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
    <main id="main" className="mx-auto w-full max-w-[1016px] px-4 pt-[124px] pb-24 md:pt-[136px]">
      <JsonLd data={breadcrumbs([{ name: "Research", path: "/research" }])} />
      <p className="font-mono text-[12px] tracking-[0.12em] text-white/45 uppercase">Research</p>
      <h1 className="mt-4 font-mono text-[30px] leading-[1.2] font-medium tracking-[-0.025em] text-fg md:text-[36px]">
        Privacy research notes
      </h1>
      <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-2">
        Encryption hides what a note holds. It does not stop timing, amounts or habits from pointing at the person behind it. These notes
        take one leak at a time, show it in a small model you can play with, and describe how {BRAND.name} might close it. The models are
        illustrations with their assumptions written underneath; none of the numbers is read from a live pool.
      </p>
      <hr className="mt-14 border-white/10" />
      <ol>
        {NOTES.map((n, i) => (
          <li key={n.slug} className="pt-14">
            <p className="font-mono text-[11px] tracking-[0.2em] text-white/40">{String(i + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 font-mono text-[20px] leading-snug font-medium tracking-[-0.02em] text-fg">{n.title}</h2>
            <p className="mt-2 text-[16px] leading-relaxed text-fg-2">{n.summary}</p>
            <div className="min-w-0">
              <n.Demo />
            </div>
            <Link href={`/research/${n.slug}`} className="group mt-5 inline-flex items-center gap-2 font-mono text-[13px] text-fg/75 transition-colors hover:text-fg">
              Read the note: {n.title.toLowerCase()} <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
