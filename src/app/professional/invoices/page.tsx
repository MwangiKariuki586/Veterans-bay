import { InvoiceList } from "@/components/invoices/invoice-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalInvoicesPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Invoices"
      description="Issue auditable invoices and preserve manual payment history."
      hideIntro
    >
      <InvoiceList audience="professional" />
    </AuthenticatedShell>
  );
}
