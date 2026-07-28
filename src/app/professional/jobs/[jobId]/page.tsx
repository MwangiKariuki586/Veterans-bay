import { JobDetail } from "@/components/jobs/job-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ProfessionalJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <AuthenticatedShell
      kind="professional"
      title="Job details"
      description="Execute the agreed work and preserve every decision."
      hideIntro
    >
      <JobDetail audience="professional" jobId={jobId} />
    </AuthenticatedShell>
  );
}
