import { ClientRequestForm } from "@/components/service-requests/client-request-form";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

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
    <AuthenticatedShell
      kind="client"
      title="New request"
      description="Describe the service you need."
      hideIntro
    >
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
    </AuthenticatedShell>
  );
}
