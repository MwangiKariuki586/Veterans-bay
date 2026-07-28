import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Invoice details"
      description="Review items, allocations, evidence, and adjustments."
      hideIntro
    >
      <InvoiceDetail audience="professional" invoiceId={invoiceId} />
    </AuthenticatedShell>
  );
}
