import { AppShell } from "@/components/app/AppShell";
import { PracticeProvider } from "@/components/app/PracticeProvider";
import { PoolProvider } from "@/components/app/pool/PoolProvider";
import { poolLive } from "@/config/contracts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (poolLive()) {
    return (
      <PoolProvider>
        <AppShell>{children}</AppShell>
      </PoolProvider>
    );
  }
  return (
    <PracticeProvider>
      <AppShell>{children}</AppShell>
    </PracticeProvider>
  );
}
