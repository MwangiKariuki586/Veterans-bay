import type { MarketplaceAnalyticsEvent } from "@/modules/marketplace/types";

export function recordMarketplaceEvent(event: MarketplaceAnalyticsEvent): void {
  void fetch("/api/v1/public/marketplace/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
