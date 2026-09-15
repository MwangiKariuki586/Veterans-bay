import { MarketplacePageSkeleton } from "@/components/marketplace/marketplace-skeletons";

export default function MarketplaceLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8 py-6">
      <MarketplacePageSkeleton />
    </div>
  );
}
