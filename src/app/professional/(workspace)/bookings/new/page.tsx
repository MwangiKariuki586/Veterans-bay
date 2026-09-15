import { ProfessionalBookingStart } from "@/components/bookings/professional-booking-start";
export default async function ProfessionalBookingNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <ProfessionalBookingStart
        customerId={
          typeof query.customerId === "string" ? query.customerId : undefined
        }
        sourceBookingId={
          typeof query.sourceBookingId === "string"
            ? query.sourceBookingId
            : undefined
        }
      />
  );
}
