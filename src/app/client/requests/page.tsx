import { Suspense } from "react";

import { ClientRequestsPage as ClientRequestsWorkspace } from "@/components/service-requests/client-requests-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientRequestsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
      <ClientRequestsWorkspace />
    </Suspense>
  );
}
