import { notFound } from "next/navigation";

import { getMarketplaceServiceBySlug } from "@/components/marketplace/fixtures";
import { ServiceDetailPage } from "@/components/marketplace/service-detail-page";
import { PublicShell } from "@/components/public/public-shell";

export default async function ServiceDetailRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = getMarketplaceServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  return (
    <PublicShell>
      <main>
        <ServiceDetailPage service={service} />
      </main>
    </PublicShell>
  );
}
