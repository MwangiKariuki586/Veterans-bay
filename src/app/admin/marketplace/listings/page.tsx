import { Suspense } from "react";

import { MarketplaceListingModeration } from "@/components/admin/marketplace-listing-moderation";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function AdminMarketplaceListingsPage() {
  return (
    <Suspense fallback={<ListPageSkeleton className="min-h-72" />}>
      <MarketplaceListingModeration />
    </Suspense>
  );
}
