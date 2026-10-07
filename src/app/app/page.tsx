import type { Metadata } from "next";
import { Overview } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { poolLive } from "@/config/contracts";
import { RealOverview } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "App",
  description: `${BRAND.name} app: your private notes, your public balance and the shared fee vault on Robinhood Chain.`,
  path: "/app",
  index: false,
});

export default function Page() {
  return poolLive() ? <RealOverview /> : <Overview />;
}
