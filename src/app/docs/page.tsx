import type { Metadata } from "next";
import { DocView } from "@/components/docs/DocView";
import { DOCS } from "@/components/docs/content";
import { pageMeta } from "@/lib/seo";

const doc = DOCS[0];

export const metadata: Metadata = pageMeta({ title: doc.title, description: doc.description, path: "/docs", type: "article" });

export default function Page() {
  return <DocView doc={doc} />;
}
