import { ProfessionalEnquiryDetail } from "@/components/service-requests/professional-enquiry-detail";

export default async function ProfessionalEnquiryDetailRoute({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <ProfessionalEnquiryDetail requestId={requestId} />
  );
}
