import { BookingDetail } from "@/components/bookings/booking-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Booking details"
      description="Confirm schedule, assignment, and lifecycle actions."
      hideIntro
    >
      <BookingDetail audience="professional" bookingId={bookingId} />
    </AuthenticatedShell>
  );
}
