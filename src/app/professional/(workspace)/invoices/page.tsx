import { Suspense } from "react";

import { InvoiceList } from "@/components/invoices/invoice-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessionalInvoicesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
      <InvoiceList audience="professional" />
    </Suspense>
  );
}
