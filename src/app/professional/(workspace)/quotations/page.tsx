import { Suspense } from "react";

import { QuotationList } from "@/components/quotations/quotation-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ProfessionalQuotationsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Quotations" summaryLabels={["Drafts", "Awaiting decision", "Accepted", "Expiring soon"]} />}>
      <QuotationList audience="professional" />
    </Suspense>
  );
}
