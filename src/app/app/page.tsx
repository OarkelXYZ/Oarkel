import type { Metadata } from "next";
import { Overview } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { poolLive } from "@/config/contracts";
import { RealOverview } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "App",
  description: `${BRAND.name} app in practice mode: your private notes, public practice balance and the shared fee vault, with live Robinhood Chain data.`,
  path: "/app",
  index: false,
});

export default function Page() {
  return poolLive() ? <RealOverview /> : <Overview />;
}
