import { QuotationList } from "@/components/quotations/quotation-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientQuotationsPage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="Your quotations"
      description="Review scope, pricing, warranty, and payment terms."
      hideIntro
    >
      <QuotationList audience="client" />
    </AuthenticatedShell>
  );
}
