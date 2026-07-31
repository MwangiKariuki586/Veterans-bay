import { ModerationReportQueue } from "@/components/admin/moderation-report-queue";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminReportsPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Reports and moderation cases"
      description="Investigate reported activity and preserve reasoned case decisions."
      hideIntro
    >
      <ModerationReportQueue />
    </AuthenticatedShell>
  );
}
