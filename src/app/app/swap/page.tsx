import type { Metadata } from "next";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { RealSwap } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "Swap",
  description: `Swap between ETH and ${BRAND.ticker} from your private notes into a new note in the ${BRAND.name} app.`,
  path: "/app/swap",
  index: false,
});

export default function Page() {
  return <RealSwap />;
}
