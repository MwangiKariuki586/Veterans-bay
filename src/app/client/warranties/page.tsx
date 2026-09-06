import { Suspense } from "react";

import { WarrantyList } from "@/components/warranties/warranty-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ClientWarrantiesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Warranties" summaryLabels={["Active warranties", "Expiring soon", "Open claims", "Resolved claims"]} />}>
      <WarrantyList audience="client" />
    </Suspense>
  );
}
