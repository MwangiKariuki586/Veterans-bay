import { ClientRequestForm } from "@/components/service-requests/client-request-form";

export default async function NewClientRequestPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const source =
    typeof query.source === "string" &&
    [
      "MARKETPLACE_DISCOVERY",
      "PROFESSIONAL_BOOKING_LINK",
      "REPEAT_CLIENT",
      "DIRECT_SERVICE_PAGE",
    ].includes(query.source)
      ? (query.source as
          | "MARKETPLACE_DISCOVERY"
          | "PROFESSIONAL_BOOKING_LINK"
          | "REPEAT_CLIENT"
          | "DIRECT_SERVICE_PAGE")
      : "MARKETPLACE_DISCOVERY";
  return (
    <ClientRequestForm
        initial={{
          source,
          category:
            typeof query.category === "string" ? query.category : undefined,
          preferredProfessionalSlug:
            typeof query.professional === "string"
              ? query.professional
              : undefined,
          preferredServiceSlug:
            typeof query.service === "string" ? query.service : undefined,
        }}
      />
  );
}
