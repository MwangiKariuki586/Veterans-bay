import { ProfessionalReviewDetail } from "@/components/admin/professional-review-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function AdminProfessionalReviewPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  return (
    <AuthenticatedShell
      kind="admin"
      title="Professional application"
      description="Review submitted profile evidence and record a traceable decision."
      hideIntro
    >
      <ProfessionalReviewDetail organisationId={organisationId} />
    </AuthenticatedShell>
  );
}
