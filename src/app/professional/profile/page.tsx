import { ProfessionalProfileManager } from "@/components/professional-services/professional-profile-manager";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalProfilePage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Business profile"
      description="Manage the public profile and portfolio clients see."
      hideIntro
    >
      <ProfessionalProfileManager />
    </AuthenticatedShell>
  );
}
