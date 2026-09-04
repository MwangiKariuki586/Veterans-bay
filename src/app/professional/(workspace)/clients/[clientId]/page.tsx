import { ClientRelationshipProfile } from "@/components/client-context/client-relationship-profile";

export default async function ClientContextRoute({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { clientId } = await params;
  const query = await searchParams;
  return (
    <ClientRelationshipProfile
      clientId={clientId}
      contextId={query.contextId ?? null}
      contextType={(query.contextType as "job" | "booking" | "request" | "customer" | undefined) ?? null}
    />
  );
}
