import { Suspense } from "react";

import { PublicShell } from "@/components/public/public-shell";
import { MarketplacePage } from "@/components/marketplace/marketplace-page";
import { StatePanel } from "@/components/ui/state-panel";

export default function MarketplaceRoute() {
  return (
    <PublicShell>
      <main>
        <Suspense
          fallback={
            <StatePanel
              variant="loading"
              headingLevel={1}
              title="Loading marketplace"
              description="Preparing the latest public service listings."
              className="min-h-72"
            />
          }
        >
          <MarketplacePage />
        </Suspense>
      </main>
    </PublicShell>
  );
}
