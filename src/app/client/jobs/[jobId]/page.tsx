import { JobDetail } from "@/components/jobs/job-detail";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <AuthenticatedShell
      kind="client"
      title="Job progress"
      description="Follow the work, review changes, and respond to completion."
      hideIntro
    >
      <JobDetail audience="client" jobId={jobId} />
    </AuthenticatedShell>
  );
}
