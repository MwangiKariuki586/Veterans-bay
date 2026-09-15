import { Suspense } from "react";

import { ProfessionalReviewQueue } from "@/components/admin/professional-review-queue";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function AdminProfessionalsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton className="min-h-72" />}>
      <ProfessionalReviewQueue />
    </Suspense>
  );
}
