import { AuditLog } from "@/components/admin/operational-admin-queues";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminAuditPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Audit history"
      description="Inspect traceable high-risk platform and commercial actions."
      hideIntro
    >
      <AuditLog />
    </AuthenticatedShell>
  );
}
