import type { Metadata } from "next";
import { SettingsView } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { poolLive } from "@/config/contracts";
import { RealSettings } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "Settings",
  description: `Wallet, keys and storage settings for the ${BRAND.name} practice app, plus the example fee rates it uses. Practice mode only, no real funds.`,
  path: "/app/settings",
  index: false,
});

export default function Page() {
  return poolLive() ? <RealSettings /> : <SettingsView />;
}
