import { JobDetail } from "@/components/jobs/job-detail";

export default async function ProfessionalJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <JobDetail audience="professional" jobId={jobId} />
  );
}
