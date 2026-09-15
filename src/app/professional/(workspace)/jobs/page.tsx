import { Suspense } from "react";

import { JobList } from "@/components/jobs/job-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ProfessionalJobsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Jobs" summaryLabels={["Today", "In progress", "Awaiting confirmation", "Needs attention"]} />}>
      <JobList audience="professional" />
    </Suspense>
  );
}
