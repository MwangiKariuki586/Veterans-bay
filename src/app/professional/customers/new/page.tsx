import { CustomerCreate } from "@/components/customers/customer-create";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
export default function NewCustomerPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Add customer"
      description="Keep imported contacts separate from platform identities until registration is verified."
      hideIntro
    >
      <CustomerCreate />
    </AuthenticatedShell>
  );
}
