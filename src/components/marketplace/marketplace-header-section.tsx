"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { LocationPicker } from "@/components/ui/location-picker";

export function MarketplaceHeaderSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentParams = useMemo(() => new URLSearchParams(searchKey), [searchKey]);

  function updateLocation(location: string) {
    const next = new URLSearchParams(currentParams);
    if (location) next.set("location", location);
    else next.delete("location");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `/marketplace?${query}` : "/marketplace");
  }

  return (
    <>
      <nav className="hidden text-[0.7rem] text-[#607087] sm:block" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Find Services</span>
      </nav>

      <header className="mt-1 flex flex-wrap items-end justify-between gap-5 sm:mt-3">
        <div>
          <h1 className="text-[2rem] leading-tight font-medium tracking-title sm:text-[2.15rem]">
            Find Services
          </h1>
          <p className="mt-1 text-[0.82rem] text-[#334a68]">
            Search trusted home service professionals in Nairobi.
          </p>
        </div>
        <LocationPicker
          value={currentParams.get("location") ?? "Nairobi"}
          onSelect={updateLocation}
          className="w-full sm:w-[13rem]"
        />
      </header>
    </>
  );
}
