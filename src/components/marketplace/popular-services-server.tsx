import "server-only";

import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

import { getPopularServices } from "@/lib/marketplace-server";

function fallbackImage(category: string) {
  const value = category.toLowerCase();
  if (value.includes("electric")) return "/images/category-electrical.png";
  if (value.includes("clean")) return "/images/category-cleaning.png";
  if (value.includes("paint")) return "/images/category-painting.png";
  if (value.includes("appliance")) return "/images/category-appliance.png";
  return "/images/category-plumbing.png";
}

function formatPrice(priceMinor: number | null, currency: string, pricingModel: string) {
  if (pricingModel === "custom_quote" || priceMinor == null) return "Custom quote";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(priceMinor / 100)
    .replace("KES", "KSh");
}

export async function PopularServicesServer({ location }: { location?: string }) {
  const items = await getPopularServices(location).catch(() => []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-4">
      <h2 className="font-semibold">Popular near you</h2>
      <div className="mt-3 border-t border-black/8 pt-2">
        {items.map((service) => (
          <Link
            key={service.slug}
            href={`/services/${service.slug}`}
            prefetch={false}
            className="flex gap-3 border-b border-black/8 py-3 last:border-0 hover:bg-[#fbfdf4] rounded-lg px-1 -mx-1 transition-colors"
          >
            <Image
              src={service.imageUrl ?? fallbackImage(service.category)}
              alt={service.name}
              width={54}
              height={54}
              className="size-[54px] shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1 text-[0.68rem] leading-4">
              <p className="line-clamp-1 font-semibold">{service.name}</p>
              <p className="text-[#52647a]">{formatPrice(service.priceMinor, service.currency, service.pricingModel)}</p>
              <p className="mt-1 flex items-center gap-1 text-[#52647a]">
                <Star className="size-3 shrink-0 fill-[#ffb000] text-[#ffb000]" aria-hidden="true" />
                <span>
                  {service.provider.rating != null ? `${service.provider.rating.toFixed(1)} (${service.provider.reviewCount})` : "New"} · Popular locally
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
