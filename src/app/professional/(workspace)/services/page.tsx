import { ServiceCatalogue } from "@/components/professional-services/service-catalogue";

export default async function ProfessionalServicesPage({ searchParams }: { searchParams: Promise<{ editor?: string }> }) {
  const { editor } = await searchParams;
  return (<ServiceCatalogue initialEditor={editor ?? null} />);
}
