import { JobDetail } from "@/components/jobs/job-detail";

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <JobDetail audience="client" jobId={jobId} />
  );
}
