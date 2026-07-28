import { ProfessionalBookingStart } from "@/components/bookings/professional-booking-start";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
export default async function ProfessionalBookingNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Create booking"
      description="Use current service terms and availability for an organisation customer."
      hideIntro
    >
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
    </AuthenticatedShell>
  );
}
