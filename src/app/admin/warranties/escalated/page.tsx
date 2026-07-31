import { EscalatedWarrantyQueue } from "@/components/admin/operational-admin-queues";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminEscalatedWarrantiesPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Escalated warranties"
      description="Review unresolved warranty claims with purpose-limited evidence."
      hideIntro
    >
      <EscalatedWarrantyQueue />
    </AuthenticatedShell>
  );
}
