import { InvoiceDetail } from "@/components/invoices/invoice-detail";

export default async function ProfessionalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <InvoiceDetail audience="professional" invoiceId={invoiceId} />
  );
}
