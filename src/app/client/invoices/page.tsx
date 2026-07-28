import { InvoiceList } from "@/components/invoices/invoice-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientInvoicesPage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="My invoices"
      description="Review issued amounts and manually recorded payments."
      hideIntro
    >
      <InvoiceList audience="client" />
    </AuthenticatedShell>
  );
}
