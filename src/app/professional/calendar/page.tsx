import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalCalendarPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Booking calendar"
      description="Review confirmed work across the team."
      hideIntro
    >
      <BookingCalendar />
    </AuthenticatedShell>
  );
}
