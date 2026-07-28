import { ProfessionalEnquiryDetail } from "@/components/service-requests/professional-enquiry-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalEnquiryDetailRoute({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Enquiry details"
      description="Review client requirements."
      hideIntro
    >
      <ProfessionalEnquiryDetail requestId={requestId} />
    </AuthenticatedShell>
  );
}
