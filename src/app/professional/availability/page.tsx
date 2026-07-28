import { AvailabilitySettings } from "@/components/bookings/availability-settings";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalAvailabilityPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Professional availability"
      description="Publish working hours and protect unavailable time."
      hideIntro
    >
      <AvailabilitySettings />
    </AuthenticatedShell>
  );
}
