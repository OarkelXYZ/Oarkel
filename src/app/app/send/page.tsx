import type { Metadata } from "next";
import { SendForm } from "@/components/app/Screens";
import { BRAND } from "@/config/brand";
import { pageMeta } from "@/lib/seo";
import { poolLive } from "@/config/contracts";
import { RealSend } from "@/components/app/pool/RealScreens";

export const metadata: Metadata = pageMeta({
  title: "Send Privately",
  description: `Send practice ${BRAND.symbol} or ETH privately to another practice account in the ${BRAND.name} app. A signature only, no transaction is sent.`,
  path: "/app/send",
  index: false,
});

export default function Page() {
  return poolLive() ? <RealSend /> : <SendForm />;
}
