import { ProfessionalEnquiriesPage } from "@/components/service-requests/professional-enquiries-page";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalEnquiriesRoute() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Service enquiries"
      description="Review and qualify client requirements."
      hideIntro
    >
      <ProfessionalEnquiriesPage />
    </AuthenticatedShell>
  );
}
