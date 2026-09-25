import { PublicProfessionalSkeleton } from "@/components/professional-services/public-catalogue-pages";
import { PublicShell } from "@/components/public/public-shell";

export default function Loading() {
  return (
    <PublicShell>
      <main>
        <PublicProfessionalSkeleton />
      </main>
    </PublicShell>
  );
}
