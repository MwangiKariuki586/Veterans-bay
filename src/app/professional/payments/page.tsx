import { PaymentList } from "@/components/invoices/payment-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalPaymentsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Payments"
      description="Review manual payment records and preserved adjustments."
      hideIntro
    >
      <PaymentList />
    </AuthenticatedShell>
  );
}
