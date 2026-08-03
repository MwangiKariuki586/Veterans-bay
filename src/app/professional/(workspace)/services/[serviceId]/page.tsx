import { ServiceEditor } from "@/components/professional-services/service-catalogue";

export default async function ProfessionalServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;

  return (
    <ServiceEditor serviceId={serviceId} />
  );
}
