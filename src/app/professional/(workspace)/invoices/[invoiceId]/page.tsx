import { redirect } from "next/navigation";

export default async function ProfessionalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  redirect(`/professional/invoices?invoiceId=${encodeURIComponent(invoiceId)}`);
}
