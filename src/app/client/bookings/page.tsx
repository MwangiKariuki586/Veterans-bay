import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { ClientBookingsPage } from "@/components/workspace/client-bookings-page";

export default function ClientBookingsRoute() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Your bookings"
      description="Client bookings will arrive with the fulfilment phase."
      hideIntro
    >
      <ClientBookingsPage />
    </AuthenticatedShell>
  );
}
