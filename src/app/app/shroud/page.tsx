import type { Metadata } from "next";
import { ShroudForm } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Shroud",
  description: `Shroud practice ETH or ${BRAND.symbol} into a private note in the ${BRAND.name} practice app. A wallet signature, no transaction and no real funds.`,
  path: "/app/shroud",
  index: false,
});

export default function Page() {
  return <ShroudForm />;
}
