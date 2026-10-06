import { AppShell } from "@/components/app/AppShell";
import { PracticeProvider } from "@/components/app/PracticeProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PracticeProvider>
      <AppShell>{children}</AppShell>
    </PracticeProvider>
  );
}
