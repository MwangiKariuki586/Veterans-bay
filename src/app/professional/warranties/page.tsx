import { WarrantyList } from "@/components/warranties/warranty-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalWarrantiesPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Warranties"
      description="Review coverage, claims, return visits, and resolution history."
      hideIntro
    >
      <WarrantyList audience="professional" />
    </AuthenticatedShell>
  );
}
