import { InvoiceDetail } from "@/components/invoices/invoice-detail";

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <InvoiceDetail audience="client" invoiceId={invoiceId} />
  );
}
