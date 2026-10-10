import type { Metadata } from "next";
import { UnshroudForm } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { poolLive } from "@/config/contracts";
import { RealUnshroud } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "Unshroud",
  description: `Unshroud practice notes to any address in the ${BRAND.name} practice app, with a flat exit fee and an optional relayer. No real funds move.`,
  path: "/app/unshroud",
  index: false,
});

export default function Page() {
  return poolLive() ? <RealUnshroud /> : <UnshroudForm />;
}
