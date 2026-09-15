import { ModerationCaseDetailView } from "@/components/admin/moderation-case-detail";

export default async function AdminModerationCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  return (
    <ModerationCaseDetailView caseId={caseId} />
  );
}
