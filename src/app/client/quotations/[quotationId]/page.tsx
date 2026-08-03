import { QuotationDetail } from "@/components/quotations/quotation-detail";

export default async function ClientQuotationDetailPage({
  params,
}: {
  params: Promise<{ quotationId: string }>;
}) {
  const { quotationId } = await params;
  return (
    <QuotationDetail audience="client" quotationId={quotationId} />
  );
}
