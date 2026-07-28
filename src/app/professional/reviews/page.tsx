import { ProfessionalReviews } from "@/components/reviews/professional-reviews";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalReviewsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Reviews"
      description="Read verified feedback and publish one professional response."
      hideIntro
    >
      <ProfessionalReviews />
    </AuthenticatedShell>
  );
}
