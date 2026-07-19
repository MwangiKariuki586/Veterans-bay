import { PublicShell } from "@/components/public/public-shell";
import { MarketplacePage } from "@/components/marketplace/marketplace-page";

export default function MarketplaceRoute() {
  return (
    <PublicShell>
      <main>
        <MarketplacePage />
      </main>
    </PublicShell>
  );
}
