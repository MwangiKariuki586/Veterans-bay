import { ClientRequestForm } from "@/components/service-requests/client-request-form";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Request details"
      description="Review and track your service request."
      hideIntro
    >
      <ClientRequestForm requestId={requestId} />
    </AuthenticatedShell>
  );
}
