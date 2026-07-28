import { WarrantyDetail } from "@/components/warranties/warranty-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalWarrantyDetailPage({
  params,
}: {
  params: Promise<{ warrantyId: string }>;
}) {
  const { warrantyId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Warranty details"
      description="Review coverage, claim decisions, return visits, and resolution history."
      hideIntro
    >
      <WarrantyDetail audience="professional" warrantyId={warrantyId} />
    </AuthenticatedShell>
  );
}
