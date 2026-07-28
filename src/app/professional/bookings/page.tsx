import { BookingList } from "@/components/bookings/booking-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalBookingsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Bookings"
      description="Confirm schedules, assignments, and booking changes."
      hideIntro
    >
      <BookingList audience="professional" />
    </AuthenticatedShell>
  );
}
