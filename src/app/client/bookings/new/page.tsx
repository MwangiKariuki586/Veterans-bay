import { BookingStart } from "@/components/bookings/booking-start";

export default async function NewClientBookingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <BookingStart
        professionalSlug={
          typeof query.professionalSlug === "string"
            ? query.professionalSlug
            : undefined
        }
        serviceSlug={
          typeof query.serviceSlug === "string"
            ? query.serviceSlug
            : undefined
        }
        serviceName={
          typeof query.serviceName === "string"
            ? query.serviceName
            : undefined
        }
        providerName={
          typeof query.providerName === "string"
            ? query.providerName
            : undefined
        }
        sourceBookingId={
          typeof query.sourceBookingId === "string"
            ? query.sourceBookingId
            : undefined
        }
      />
  );
}
