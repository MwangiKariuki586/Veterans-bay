import { BookingDetail } from "@/components/bookings/booking-detail";

export default async function ClientBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;
  return (
    <BookingDetail audience="client" bookingId={bookingId} />
  );
}
