"use client";

import {
  ArrowRight,
  BadgeCheck,
  Grid2X2,
  Heart,
  List,
  MapPin,
  Medal,
  RefreshCw,
  ShieldCheck,
  Star,
  Tag,
  Headphones,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  marketplaceCategories,
  marketplaceServices,
} from "@/components/marketplace/fixtures";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const trustItems = [
  { label: "Verified Pros", icon: ShieldCheck },
  { label: "Upfront Pricing", icon: Tag },
  { label: "Real Reviews", icon: BadgeCheck },
  { label: "Quality Guaranteed", icon: Medal },
] as const;

export function MarketplacePage() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tab, setTab] = useState("All Services");
  const [availableToday, setAvailableToday] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState("popular");
  const [minPrice, setMinPrice] = useState("500");
  const [maxPrice, setMaxPrice] = useState("50000");

  const filtered = useMemo(() => {
    let items = [...marketplaceServices];
    if (selectedCategories.length) {
      items = items.filter((item) =>
        selectedCategories.includes(item.category.toLowerCase().split(" ")[0]!),
      );
    }
    if (tab !== "All Services") {
      items = items.filter((item) => item.category === tab);
    }
    if (availableToday) {
      items = items.filter((item) => item.availability === "today");
    }
    const min = Number(minPrice) || 0;
    const max = Number(maxPrice) || Number.POSITIVE_INFINITY;
    items = items.filter(
      (item) => item.priceFrom >= min && item.priceFrom <= max,
    );
    if (sort === "rating") {
      items.sort((a, b) => b.rating - a.rating);
    } else if (sort === "price") {
      items.sort((a, b) => a.priceFrom - b.priceFrom);
    }
    return items;
  }, [availableToday, maxPrice, minPrice, selectedCategories, sort, tab]);

  function toggleCategory(id: string) {
    setSelectedCategories((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function clearFilters() {
    setSelectedCategories([]);
    setAvailableToday(false);
    setMinPrice("500");
    setMaxPrice("50000");
    setTab("All Services");
  }

  return (
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Find Services</span>
      </nav>
      <h1 className="mt-4 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
        Find Services
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        Discover verified professionals for repairs, maintenance, and home
        improvements across Nairobi.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map(({ label, icon: Icon }) => (
          <Surface
            key={label}
            className="flex items-center gap-3 p-4 shadow-none"
          >
            <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold">{label}</span>
          </Surface>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)_240px]">
        <aside className="space-y-4">
          <Surface className="p-4 shadow-none">
            <p className="text-xs font-semibold text-[#68717b]">Your Location</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-[#5f8d11]" /> Nairobi, Kenya
            </p>
            <button type="button" className="mt-2 text-xs font-semibold text-[#5f8d11]">
              Change location
            </button>
          </Surface>
          <Surface className="p-4 shadow-none">
            <p className="text-sm font-bold">Category</p>
            <ul className="mt-3 space-y-2">
              {marketplaceCategories.map((category) => (
                <li key={category.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.id)}
                      onChange={() => toggleCategory(category.id)}
                    />
                    <span className="flex-1">{category.label}</span>
                    <span className="text-xs text-[#68717b]">{category.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Surface>
          <Surface className="p-4 shadow-none">
            <p className="text-sm font-bold">Price Range</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                className="h-10 rounded-xl border border-black/8 px-3 text-xs"
                aria-label="Minimum price"
              />
              <input
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                className="h-10 rounded-xl border border-black/8 px-3 text-xs"
                aria-label="Maximum price"
              />
            </div>
          </Surface>
          <Surface className="p-4 shadow-none">
            <p className="text-sm font-bold">Availability</p>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={availableToday}
                onChange={(event) => setAvailableToday(event.target.checked)}
              />
              Available Today
            </label>
          </Surface>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-black/8 bg-white text-sm font-semibold"
          >
            <RefreshCw className="size-4" /> Clear Filters
          </button>
        </aside>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              Showing {filtered.length} services
            </p>
            <div className="flex items-center gap-2">
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-10 rounded-full border border-black/8 bg-white px-3 text-xs"
                aria-label="Sort services"
              >
                <option value="popular">Sort by: Most Popular</option>
                <option value="rating">Highest rated</option>
                <option value="price">Lowest price</option>
              </select>
              <button
                type="button"
                className={cn(
                  "grid size-10 place-items-center rounded-full border border-black/8",
                  view === "grid" && "bg-primary",
                )}
                aria-label="Grid view"
                onClick={() => setView("grid")}
              >
                <Grid2X2 className="size-4" />
              </button>
              <button
                type="button"
                className={cn(
                  "grid size-10 place-items-center rounded-full border border-black/8",
                  view === "list" && "bg-primary",
                )}
                aria-label="List view"
                onClick={() => setView("list")}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["All Services", "Plumbing", "Electrical", "Cleaning", "Painting"].map(
              (label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setTab(label)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold",
                    tab === label
                      ? "bg-primary text-primary-foreground"
                      : "border border-black/8 bg-white",
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div
            className={cn(
              "mt-5 grid gap-4",
              view === "grid" ? "sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            {filtered.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.slug}`}
                className="block rounded-[22px] outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Surface className="overflow-hidden p-0 shadow-none">
                  <div className="relative aspect-[4/3]">
                    <Image
                      src={service.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="300px"
                    />
                    <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-[0.65rem] font-semibold">
                      {service.availability === "today"
                        ? "Available Today"
                        : "Available This Week"}
                    </span>
                    <span
                      className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white"
                      aria-hidden="true"
                    >
                      <Heart className="size-4" />
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="font-bold">{service.title}</h2>
                    <p className="mt-1 text-xs text-[#68717b]">
                      {service.serviceName} · {service.category}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">
                      <Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" />
                      {service.rating}{" "}
                      <span className="font-normal text-[#68717b]">
                        ({service.reviews})
                      </span>
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-[#68717b]">
                      <MapPin className="size-3.5" /> {service.location}
                    </p>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-[0.65rem] text-[#68717b]">
                          Starting from
                        </p>
                        <p className="text-sm font-bold">
                          KSh {service.priceFrom.toLocaleString()}
                        </p>
                      </div>
                      <span
                        className="grid size-10 place-items-center rounded-full bg-primary"
                        aria-hidden="true"
                      >
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </div>
                </Surface>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((page) => (
                <button
                  key={page}
                  type="button"
                  className={cn(
                    "grid size-9 place-items-center rounded-lg font-semibold",
                    page === 1 ? "bg-primary" : "border border-black/8 bg-white",
                  )}
                >
                  {page}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#68717b]">Show 12 per page</p>
          </div>
        </section>

        <aside className="space-y-4">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Need help choosing?</h2>
            <p className="mt-2 text-sm text-[#68717b]">
              Get tailored recommendations for your home project.
            </p>
            <Link
              href="/contact"
              className={cn(
                buttonVariants(),
                "mt-4 h-11 w-full justify-between rounded-full pr-1 pl-4 text-xs",
              )}
            >
              Get Recommendations
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </Surface>
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Trusted by Thousands</h2>
            <p className="mt-3 text-2xl font-bold">25,000+</p>
            <p className="text-sm text-[#68717b]">Happy Customers</p>
            <p className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
              <Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" /> 4.8/5
            </p>
          </Surface>
          <Surface className="p-5 shadow-none">
            <h2 className="inline-flex items-center gap-2 font-bold">
              <Headphones className="size-4 text-[#5f8d11]" /> Need help?
            </h2>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-11 w-full justify-between rounded-full border-black/8 pr-1 pl-4 text-xs",
              )}
            >
              Contact Support
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
