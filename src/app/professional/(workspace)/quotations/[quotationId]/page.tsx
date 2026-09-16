import { QuotationDetail } from "@/components/quotations/quotation-detail";

export default async function ProfessionalQuotationDetailPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  return (
    <QuotationDetail audience="professional" quotationId={quotationId} />
  );
}
