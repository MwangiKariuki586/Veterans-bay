import { CustomerDetail } from "@/components/customers/customer-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Customer record"
      description="Private organisation-scoped contact, history, and follow-up information."
      hideIntro
    >
      <CustomerDetail customerId={customerId} />
    </AuthenticatedShell>
  );
}
