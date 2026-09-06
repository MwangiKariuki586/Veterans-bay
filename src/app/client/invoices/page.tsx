import { Suspense } from "react";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ClientInvoicesPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Your invoices" summaryLabels={["Total invoices", "Overdue invoices", "Balance remaining", "Payments recorded"]} />}>
      <InvoiceList audience="client" />
    </Suspense>
  );
}
