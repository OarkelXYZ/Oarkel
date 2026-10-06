import type { Metadata } from "next";
import { ActivityList } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Activity",
  description: `Your ${BRAND.name} practice activity: shrouds, private sends, unshrouds and top-ups recorded by wallet signature. Practice data only, no real funds.`,
  path: "/app/activity",
  index: false,
});

export default function Page() {
  return <ActivityList />;
}
