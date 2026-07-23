import { CreateServiceForm } from "@/components/professional-services/service-catalogue";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function NewProfessionalServicePage() {
  return <AuthenticatedShell kind="professional" title="New service" description="Create a private service draft." hideIntro><CreateServiceForm /></AuthenticatedShell>;
}
