import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { ClientDashboard } from "@/components/workspace/client-dashboard";

export default function ClientWorkspacePage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Overview"
      description="Manage requests, bookings, and account settings from your client context."
      hideIntro
    >
      <ClientDashboard />
    </AuthenticatedShell>
  );
}
