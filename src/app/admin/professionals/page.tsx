import { Suspense } from "react";

import { ProfessionalReviewQueue } from "@/components/admin/professional-review-queue";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { StatePanel } from "@/components/ui/state-panel";

export default function AdminProfessionalsPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Professional reviews"
      description="Review professional applications and marketplace eligibility."
      hideIntro
    >
      <Suspense
        fallback={
          <StatePanel
            variant="loading"
            title="Loading review queue"
            description="Preparing current professional applications."
            className="min-h-72"
          />
        }
      >
        <ProfessionalReviewQueue />
      </Suspense>
    </AuthenticatedShell>
  );
}
