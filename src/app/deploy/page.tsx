import type { Metadata } from "next";
import { DeployPanel } from "@/components/onchain/DeployPanel";

export const metadata: Metadata = {
  title: "Deploy contracts",
  description: "Owner tool: deploy the Oarkel contracts from your own wallet.",
  robots: { index: false, follow: false },
};

export default function DeployPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-[960px] px-4 pt-[104px] pb-20 md:pt-[132px]">
      <DeployPanel />
    </main>
  );
}
