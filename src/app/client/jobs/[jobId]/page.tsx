import { LegacyClientJobRedirect } from "@/components/jobs/legacy-client-job-redirect";

export default async function ClientJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return (
    <LegacyClientJobRedirect jobId={jobId} />
  );
}
