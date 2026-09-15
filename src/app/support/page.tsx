import { PublicShell } from "@/components/public/public-shell";
import { SupportPage } from "@/components/support/support-page";

export default function PublicSupportPage() {
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-6xl pb-8">
        <SupportPage />
      </main>
    </PublicShell>
  );
}
