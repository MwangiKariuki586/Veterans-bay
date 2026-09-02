import { redirect } from "next/navigation";

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  redirect(`/client/invoices?invoiceId=${encodeURIComponent(invoiceId)}`);
}
