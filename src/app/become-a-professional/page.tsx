import { PublicShell } from "@/components/public/public-shell";
import { BecomeProfessionalPage } from "@/components/marketplace/become-professional-page";

export default function BecomeAProfessionalRoute() {
  return (
    <PublicShell>
      <main>
        <BecomeProfessionalPage />
      </main>
    </PublicShell>
  );
}
