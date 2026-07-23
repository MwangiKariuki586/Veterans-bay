import { ServiceCatalogue } from "@/components/professional-services/service-catalogue";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalServicesPage() {
  return <AuthenticatedShell kind="professional" title="Services" description="Manage the services clients can request or book." hideIntro><ServiceCatalogue /></AuthenticatedShell>;
}
