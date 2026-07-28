import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { BookingList } from "@/components/bookings/booking-list";

export default function ClientBookingsRoute() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Your bookings"
      description="Choose times and manage confirmed service arrangements."
      hideIntro
    >
      <BookingList audience="client" />
    </AuthenticatedShell>
  );
}
