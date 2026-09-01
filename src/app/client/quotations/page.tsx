import { Suspense } from "react";

import { QuotationList } from "@/components/quotations/quotation-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClientQuotationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
      <QuotationList audience="client" />
    </Suspense>
  );
}
