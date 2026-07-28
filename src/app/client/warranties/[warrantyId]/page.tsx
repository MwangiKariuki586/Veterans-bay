import { WarrantyDetail } from "@/components/warranties/warranty-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Warranty details"
      description="Review coverage and track follow-up claims."
      hideIntro
    >
      <WarrantyDetail audience="client" warrantyId={warrantyId} />
    </AuthenticatedShell>
  );
}
