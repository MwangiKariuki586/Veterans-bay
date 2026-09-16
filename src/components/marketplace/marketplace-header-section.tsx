"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { LocationPicker } from "@/components/ui/location-picker";

export function MarketplaceHeaderSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentParams = useMemo(
    () => new URLSearchParams(searchKey),
    [searchKey],
  );

  function updateLocation(location: string) {
    const next = new URLSearchParams(currentParams);
    if (location) next.set("location", location);
    else next.delete("location");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `/marketplace?${query}` : "/marketplace");
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-5  pb-5">
      <div>
        <h1 className="text-[2rem] leading-none font-semibold tracking-tight sm:text-[2.15rem]">
          Find Services
        </h1>
        <p className="mt-2 text-[0.82rem] leading-5 text-[#5a6b84]">
          Search trusted home service professionals in Nairobi.
        </p>
      </div>
      <LocationPicker
        value={currentParams.get("location") ?? "Nairobi"}
        onSelect={updateLocation}
        className="w-full sm:w-[13rem]"
      />
    </header>
  );
}
