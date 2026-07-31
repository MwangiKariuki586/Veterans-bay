import { PlatformRulesManager } from "@/components/admin/operational-admin-queues";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminRulesPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Platform rules"
      description="Maintain explicit operational rules with reasons and audit history."
      hideIntro
    >
      <PlatformRulesManager />
    </AuthenticatedShell>
  );
}
