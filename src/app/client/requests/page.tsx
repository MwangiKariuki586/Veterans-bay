import { Suspense } from "react";

import { ClientRequestsPage as ClientRequestsWorkspace } from "@/components/service-requests/client-requests-page";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ClientRequestsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Your service requests" summaryLabels={["Total requests", "Active requests", "Needs action", "Drafts"]} />}>
      <ClientRequestsWorkspace />
    </Suspense>
  );
}
