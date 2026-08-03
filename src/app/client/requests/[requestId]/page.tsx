import { ClientRequestForm } from "@/components/service-requests/client-request-form";

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <ClientRequestForm requestId={requestId} />
  );
}
