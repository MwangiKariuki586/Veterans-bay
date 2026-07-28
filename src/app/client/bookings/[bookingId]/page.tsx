import { BookingDetail } from "@/components/bookings/booking-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Booking details"
      description="Review schedule, assignment, policy, and history."
      hideIntro
    >
      <BookingDetail audience="client" bookingId={bookingId} />
    </AuthenticatedShell>
  );
}
