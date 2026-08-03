import { BookingDetail } from "@/components/bookings/booking-detail";

export default async function ProfessionalBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <BookingDetail audience="professional" bookingId={bookingId} />
  );
}
