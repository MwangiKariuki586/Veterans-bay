import { Suspense } from "react";

import { CustomerList } from "@/components/customers/customer-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ProfessionalCustomersPage() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Customers" summaryLabels={["Total customers", "Active", "Repeat clients", "New 30 days"]} />}>
      <CustomerList />
    </Suspense>
  );
}
