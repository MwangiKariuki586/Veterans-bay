import { WarrantyList } from "@/components/warranties/warranty-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientWarrantiesPage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="My warranties"
      description="Review recorded coverage and track follow-up claims."
      hideIntro
    >
      <WarrantyList audience="client" />
    </AuthenticatedShell>
  );
}
