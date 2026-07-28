import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Invoice details"
      description="Review issued items and manually recorded payments."
      hideIntro
    >
      <InvoiceDetail audience="client" invoiceId={invoiceId} />
    </AuthenticatedShell>
  );
}
