import { QuotationList } from "@/components/quotations/quotation-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalQuotationsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Quotations"
      description="Prepare and manage formal commercial terms."
      hideIntro
    >
      <QuotationList audience="professional" />
    </AuthenticatedShell>
  );
}
