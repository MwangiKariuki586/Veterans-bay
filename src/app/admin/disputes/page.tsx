import { DisputeQueue } from "@/components/admin/operational-admin-queues";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminDisputesPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Disputes"
      description="Resolve service and payment disagreements without rewriting transaction history."
      hideIntro
    >
      <DisputeQueue />
    </AuthenticatedShell>
  );
}
