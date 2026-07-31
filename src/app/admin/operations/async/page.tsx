import { AsyncOperations } from "@/components/admin/async-operations";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminAsyncOperationsPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Async operations"
      description="Observe event delivery, retries, dead letters, and recovery."
      hideIntro
    >
      <AsyncOperations />
    </AuthenticatedShell>
  );
}
