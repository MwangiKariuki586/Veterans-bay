import { Suspense } from "react";

import { MarketplaceListingModeration } from "@/components/admin/marketplace-listing-moderation";
import { StatePanel } from "@/components/ui/state-panel";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminMarketplaceListingsPage() {
  return (
    <AuthenticatedShell
      kind="admin"
      title="Listing moderation"
      description="Control public marketplace listing visibility."
      hideIntro
    >
      <Suspense
        fallback={
          <StatePanel
            variant="loading"
            title="Loading listings"
            description="Preparing the marketplace moderation queue."
            className="min-h-72"
          />
        }
      >
        <MarketplaceListingModeration />
      </Suspense>
    </AuthenticatedShell>
  );
}
