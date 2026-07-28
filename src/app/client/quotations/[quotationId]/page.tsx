import { QuotationDetail } from "@/components/quotations/quotation-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientQuotationDetailPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Quotation details"
      description="Review and act on the current eligible version."
      hideIntro
    >
      <QuotationDetail audience="client" quotationId={quotationId} />
    </AuthenticatedShell>
  );
}
