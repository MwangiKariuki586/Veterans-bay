import { JobList } from "@/components/jobs/job-list";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalJobsPage() {
  return (
    <AuthenticatedShell
      kind="professional"
      title="Active jobs"
      description="Coordinate assignments, field work, evidence, and client approval."
      hideIntro
    >
      <JobList audience="professional" />
    </AuthenticatedShell>
  );
}
