import { CustomerList } from "@/components/customers/customer-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalCustomersPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Customers"
      description="Manage marketplace and existing customers in this organisation."
      hideIntro
    >
      <CustomerList />
    </AuthenticatedShell>
  );
}
