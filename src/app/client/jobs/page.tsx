import { JobList } from "@/components/jobs/job-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientJobsPage() {
  return (
    <AuthenticatedShell
      kind="client"
      title="My jobs"
      description="Track progress, approve changes, and confirm completed work."
      hideIntro
    >
      <JobList audience="client" />
    </AuthenticatedShell>
  );
}
