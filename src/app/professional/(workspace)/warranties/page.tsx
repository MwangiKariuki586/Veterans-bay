import { Suspense } from "react";

import { WarrantyList } from "@/components/warranties/warranty-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessionalWarrantiesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
      <WarrantyList audience="professional" />
    </Suspense>
  );
}
