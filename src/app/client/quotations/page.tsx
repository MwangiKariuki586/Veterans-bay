import { Suspense } from "react";

import { QuotationList } from "@/components/quotations/quotation-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ClientQuotationsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Your quotations" summaryLabels={["Total received", "Awaiting decision", "Accepted", "Expiring soon"]} />}>
      <QuotationList audience="client" />
    </Suspense>
  );
}
