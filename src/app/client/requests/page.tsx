import { ClientRequestsPage as ClientRequestsWorkspace } from "@/components/service-requests/client-requests-page";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientRequestsPage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Your requests"
      description="Create, submit, and track service requirements."
      hideIntro
    >
      <ClientRequestsWorkspace />
    </AuthenticatedShell>
  );
}
