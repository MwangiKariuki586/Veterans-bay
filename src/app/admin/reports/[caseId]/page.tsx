import { ModerationCaseDetailView } from "@/components/admin/moderation-case-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function AdminModerationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return (
    <AuthenticatedShell
      kind="admin"
      title="Moderation case"
      description="Review linked records, evidence, history, and enforcement decisions."
      hideIntro
    >
      <ModerationCaseDetailView caseId={caseId} />
    </AuthenticatedShell>
  );
}
