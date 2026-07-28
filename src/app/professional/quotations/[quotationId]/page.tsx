import { QuotationDetail } from "@/components/quotations/quotation-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalQuotationDetailPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Quotation details"
      description="Review the current terms and immutable version history."
      hideIntro
    >
      <QuotationDetail audience="professional" quotationId={quotationId} />
    </AuthenticatedShell>
  );
}
