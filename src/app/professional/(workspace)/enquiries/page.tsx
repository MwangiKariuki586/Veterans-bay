import { Suspense } from "react";

import { ProfessionalEnquiriesPage } from "@/components/service-requests/professional-enquiries-page";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ProfessionalEnquiriesRoute() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Service enquiries" summaryLabels={["New enquiries", "In review", "Needs info", "Converted"]} />}>
      <ProfessionalEnquiriesPage />
    </Suspense>
  );
}
