import type { MetadataRoute } from "next";
import { DOCS, docHref } from "@/components/docs/content";
import { NOTES } from "@/components/research/notes";
import { BRAND } from "@/config/brand";

/** Every indexable page. The app routes (/app/*) are practice views and stay out (noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  const modified = new Date("2026-10-06T00:00:00Z");
  const paths: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/token", priority: 0.6 },
    ...DOCS.map((d) => ({ path: docHref(d.slug), priority: 0.6 })),
    { path: "/research", priority: 0.6 },
    ...NOTES.map((n) => ({ path: `/research/${n.slug}`, priority: 0.6 })),
  ];
  return paths.map((p) => ({
    url: `${BRAND.url}${p.path === "/" ? "" : p.path}`,
    lastModified: modified,
    changeFrequency: p.path === "/" ? "daily" : "weekly",
    priority: p.priority,
  }));
}
