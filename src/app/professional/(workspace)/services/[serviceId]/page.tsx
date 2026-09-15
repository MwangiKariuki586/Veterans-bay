import { ProfessionalServiceDetailsPage } from "@/components/professional-services/professional-service-details-page";

export default async function ProfessionalServicePage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;

  return <ProfessionalServiceDetailsPage serviceId={serviceId} />;
}
