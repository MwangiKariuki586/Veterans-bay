import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import { ProfessionalDashboard } from "@/components/workspace/professional-dashboard";

export default function ProfessionalWorkspacePage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Overview"
      description="Manage organisation operations from your professional context."
      hideIntro
    >
      <ProfessionalDashboard />
    </AuthenticatedShell>
  );
}
