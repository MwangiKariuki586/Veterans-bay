import { ProfessionalReviewDetail } from "@/components/admin/professional-review-detail";

export default async function AdminProfessionalReviewPage({
  params,
}: {
  params: Promise<{ organisationId: string }>;
}) {
  const { organisationId } = await params;
  return (
    <ProfessionalReviewDetail organisationId={organisationId} />
  );
}
