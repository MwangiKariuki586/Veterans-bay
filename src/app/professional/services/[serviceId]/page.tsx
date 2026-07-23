import { ServiceEditor } from "@/components/professional-services/service-catalogue";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;

  return (
    <AuthenticatedShell
      kind="professional"
      title="Manage service"
      description="Edit, validate, and control publication."
      hideIntro
    >
      <ServiceEditor serviceId={serviceId} />
    </AuthenticatedShell>
  );
}
