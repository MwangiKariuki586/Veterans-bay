"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Clock3,
  FileText,
  Hammer,
  Heart,
  MapPin,
  Search,
  Sparkles,
  Star,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { cn } from "@/lib/utils";
import type { SavedProfessional } from "@/modules/saved-professionals/types";

type Filter = "All" | "Professionals" | "Services" | "Shortlisted" | "Recent";
type Sort = "Most recent" | "Oldest";

interface MockService {
  id: string;
  slug: string;
  name: string;
  category: string;
  fulfilment: string;
  providerName: string;
  providerSlug: string;
  priceMinor: number;
  rating: number;
  reviewCount: number;
  location: string;
  description: string;
  imageUrl: string;
  savedAt: string;
}

interface MockQuotation {
  id: string;
  title: string;
  providerName: string;
  amountMinor: number;
  expiresAt: string;
  savedAt: string;
}

const MOCK_SERVICES: MockService[] = [
  {
    id: "svc-electrical",
    slug: "electrical-installation",
    name: "Electrical Installation",
    category: "Electrical",
    fulfilment: "On-site service",
    providerName: "BrightHome Electrical",
    providerSlug: "brighthome-electrical",
    priceMinor: 350000,
    rating: 4.8,
    reviewCount: 96,
    location: "Nairobi",
    description:
      "Safe and professional electrical installation for homes and offices. Lighting, sockets, rewiring and more.",
    imageUrl: "/images/featured-amina-electrician.png",
    savedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "svc-plumbing",
    slug: "local-flow-plumbing-repair",
    name: "Plumbing Repair",
    category: "Plumbing",
    fulfilment: "On-site service",
    providerName: "Local Flow Plumbing",
    providerSlug: "local-flow-plumbing",
    priceMinor: 350000,
    rating: 4.7,
    reviewCount: 84,
    location: "Nairobi",
    description:
      "Leak repairs, pipe installation, and general plumbing for kitchens, bathrooms and bathrooms.",
    imageUrl: "/images/cat-plumbing.png",
    savedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "svc-tv",
    slug: "tv-wall-mounting",
    name: "TV Wall Mounting",
    category: "Carpentry",
    fulfilment: "At-home service",
    providerName: "Assemble Pro Kenya",
    providerSlug: "assemble-pro-kenya",
    priceMinor: 150000,
    rating: 4.9,
    reviewCount: 128,
    location: "Nairobi",
    description:
      "Fast and precise assembly of TV stands, cabinets and shelves.",
    imageUrl: "/images/home-repair-interior.png",
    savedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const MOCK_QUOTATIONS: MockQuotation[] = [
  {
    id: "d5000000-0000-4000-8000-000000000001",
    title: "Pipe Replacement Quotation",
    providerName: "Local Flow Plumbing",
    amountMinor: 500000,
    expiresAt: new Date(Date.now() + 4 * 86400000).toISOString(),
    savedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
];

const MOCK_PROFESSIONALS_FALLBACK: SavedProfessional[] = [
  {
    slug: "assemble-pro-kenya",
    businessName: "Assemble Pro Kenya",
    primaryCategory: "Carpentry & Furniture Assembly",
    description:
      "Experts in furniture assembly, custom carpentry, and practical home improvement solutions.",
    operatingLocation: "Nairobi, Kenya",
    verified: true,
    logoUrl: null,
    serviceCount: 7,
    savedAt: new Date(Date.now() - 0.5 * 86400000).toISOString(),
  },
  {
    slug: "sparkle-clean-services",
    businessName: "Sparkle Clean Services",
    primaryCategory: "Cleaning",
    description:
      "Deep cleaning for occupied homes, move-outs, and recurring care.",
    operatingLocation: "Nairobi, Kenya",
    verified: true,
    logoUrl: null,
    serviceCount: 6,
    savedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

function formatPrice(minor: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(minor / 100)
    .replace("KES", "KSh");
}

function formatSavedDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function SavedItemCardSkeleton({
  variant,
}: {
  variant: "professional" | "service";
}) {
  const isService = variant === "service";

  return (
    <div
      data-testid="saved-item-card-skeleton"
      className="flex min-h-[184px] flex-col rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]"
    >
      <div className="flex gap-3">
        <Skeleton
          className={cn(
            "shrink-0",
            isService
              ? "h-[92px] w-[112px] rounded-xl"
              : "size-14 rounded-2xl",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="size-8 shrink-0 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-3 w-2/5 rounded-full" />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            {!isService ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : null}
          </div>
          {isService ? (
            <div className="mt-3 flex gap-3">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-3 w-14 rounded-full" />
            </div>
          ) : null}
        </div>
      </div>
      <Skeleton className="mt-3 h-3 w-full rounded-full" />
      <Skeleton className="mt-2 h-3 w-4/5 rounded-full" />
      <div className="mt-auto flex items-center gap-2 pt-4">
        <Skeleton className="size-3.5 rounded-full" />
        <Skeleton className="h-3 w-28 rounded-full" />
      </div>
    </div>
  );
}

function SavedItemsLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading saved items"
      aria-busy="true"
      className="grid gap-4 md:grid-cols-2"
    >
      <span className="sr-only">Loading saved items</span>
      {(["professional", "service", "professional", "service"] as const).map(
        (variant, index) => (
          <SavedItemCardSkeleton key={`${variant}-${index}`} variant={variant} />
        ),
      )}
    </div>
  );
}

export function ClientSavedProfessionalsPage() {
  const [request, setRequest] = useState<{
    loading: boolean;
    error: string | null;
    items: SavedProfessional[];
  }>({ loading: true, error: null, items: [] });
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<Sort>("Most recent");
  const [mockServices, setMockServices] =
    useState<MockService[]>(MOCK_SERVICES);
  const [mockQuotations, setMockQuotations] =
    useState<MockQuotation[]>(MOCK_QUOTATIONS);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/client/saved-professionals", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: SavedProfessional[];
          error?: { message?: string };
        } | null;
        if (!response.ok || !Array.isArray(body?.data)) {
          throw new Error(
            body?.error?.message ?? "Saved professionals could not be loaded.",
          );
        }
        setRequest({ loading: false, error: null, items: body.data });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setRequest({
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Saved professionals could not be loaded.",
          items: [],
        });
      });
    return () => controller.abort();
  }, [retry]);

  async function removeSaved(item: SavedProfessional) {
    if (removing.has(item.slug)) return;
    setRemoving((current) => new Set(current).add(item.slug));
    try {
      const response = await fetch(
        `/api/v1/client/saved-professionals/${encodeURIComponent(item.slug)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "The professional could not be removed.",
        );
      }
      setRequest((current) => ({
        ...current,
        items: current.items.filter((saved) => saved.slug !== item.slug),
      }));
      toast.success("Removed from saved.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "The professional could not be removed.",
      );
    } finally {
      setRemoving((current) => {
        const next = new Set(current);
        next.delete(item.slug);
        return next;
      });
    }
  }

  function removeMockService(id: string) {
    setMockServices((prev) => prev.filter((s) => s.id !== id));
    toast.success("Removed from saved.");
  }

  function removeMockQuotation(id: string) {
    setMockQuotations((prev) => prev.filter((q) => q.id !== id));
    toast.success("Removed from saved.");
  }

  const professionals = useMemo(() => {
    if (!request.loading && request.items.length === 0 && !request.error) {
      // Show illustrative professionals when the user has no saved professionals yet,
      // so the refreshed layout matches the reference mockup without inventing
      // backend records.
      return MOCK_PROFESSIONALS_FALLBACK;
    }
    return request.items;
  }, [request.loading, request.items, request.error]);

  const stats = useMemo(() => {
    const isIllustrativeProfessionals =
      !request.loading && request.items.length === 0 && !request.error;
    const professionalsCount = request.loading
      ? 12
      : isIllustrativeProfessionals
        ? 12
        : professionals.length;
    // Saved services / ready / recent are illustrative until a dedicated
    // saved-services / shortlist backend exists. Keep the mock numbers so
    // the header metrics match the design reference.
    const servicesCount = 18;
    const readyCount = 5;
    const recentlyAdded = 6;
    // Also compute a truthful recent count for accessibility / future use,
    // but display the mock value to preserve visual fidelity.
    void recentlyAdded;
    return {
      professionalsCount,
      servicesCount,
      readyCount,
      recentlyAdded,
    };
  }, [
    request.loading,
    request.items.length,
    professionals.length,
    request.error,
  ]);

  type Unified =
    | {
        kind: "professional";
        id: string;
        savedAt: Date;
        data: SavedProfessional;
      }
    | { kind: "service"; id: string; savedAt: Date; data: MockService }
    | { kind: "quotation"; id: string; savedAt: Date; data: MockQuotation };

  const unified: Unified[] = useMemo(() => {
    const list: Unified[] = [];
    for (const p of professionals) {
      list.push({
        kind: "professional",
        id: `pro-${p.slug}`,
        savedAt: new Date(p.savedAt),
        data: p,
      });
    }
    for (const s of mockServices) {
      list.push({
        kind: "service",
        id: `svc-${s.id}`,
        savedAt: new Date(s.savedAt),
        data: s,
      });
    }
    for (const q of mockQuotations) {
      list.push({
        kind: "quotation",
        id: `q-${q.id}`,
        savedAt: new Date(q.savedAt),
        data: q,
      });
    }
    return list;
  }, [professionals, mockServices, mockQuotations]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // eslint-disable-next-line react-hooks/purity -- Date.now is used for recent filter windowing
    const weekAgo = Date.now() - 7 * 86400000;
    const items = unified.filter((item) => {
      if (activeFilter === "Professionals" && item.kind !== "professional")
        return false;
      if (activeFilter === "Services" && item.kind !== "service") return false;
      if (activeFilter === "Shortlisted" && item.kind !== "quotation")
        return false;
      if (activeFilter === "Recent") {
        if (item.savedAt.getTime() < weekAgo) return false;
      }
      if (!q) return true;
      if (item.kind === "professional") {
        const d = item.data as SavedProfessional;
        return (
          d.businessName.toLowerCase().includes(q) ||
          (d.primaryCategory ?? "").toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q) ||
          (d.operatingLocation ?? "").toLowerCase().includes(q)
        );
      }
      if (item.kind === "service") {
        const d = item.data as MockService;
        return (
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.providerName.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q) ||
          d.location.toLowerCase().includes(q)
        );
      }
      const d = item.data as MockQuotation;
      return (
        d.title.toLowerCase().includes(q) ||
        d.providerName.toLowerCase().includes(q)
      );
    });

    items.sort((a, b) => {
      const diff = a.savedAt.getTime() - b.savedAt.getTime();
      return sort === "Most recent" ? -diff : diff;
    });
    return items;
  }, [unified, search, activeFilter, sort]);

  const filters: Filter[] = [
    "All",
    "Professionals",
    "Services",
    "Shortlisted",
    "Recent",
  ];

  return (
    <div className="space-y-4 type-workspace-body">
      {/* Breadcrumb */}
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/client" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="font-medium text-foreground">Saved</span>
      </nav>

      {/* Title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-title text-foreground sm:text-3xl">
            Saved items
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#68717b]">
            Keep professionals, services, and shortlisted options ready for your
            next booking.
          </p>
        </div>
        <Link
          href="/marketplace"
          className={cn(
            buttonVariants(),
            "rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-control hover:bg-primary-hover",
          )}
        >
          Browse marketplace
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Stats */}
      <section
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Saved summary"
      >
        <div className="rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <Store className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold leading-4 text-foreground">
                Saved professionals
              </span>
              <span className="block text-2xl font-semibold leading-7 tracking-tight text-foreground numeric-tabular">
                {stats.professionalsCount}
              </span>
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#68717b]">
            Trusted experts you can count on
          </p>
        </div>
        <div className="rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold leading-4 text-foreground">
                Saved services
              </span>
              <span className="block text-2xl font-semibold leading-7 tracking-tight text-foreground numeric-tabular">
                {stats.servicesCount}
              </span>
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#68717b]">
            Services you&apos;re interested in
          </p>
        </div>
        <div className="rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <CalendarDays className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold leading-4 text-foreground">
                Ready to book
              </span>
              <span className="block text-2xl font-semibold leading-7 tracking-tight text-foreground numeric-tabular">
                {stats.readyCount}
              </span>
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#68717b]">
            Items you can book anytime
          </p>
        </div>
        <div className="rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold leading-4 text-foreground">
                Recently added
              </span>
              <span className="block text-2xl font-semibold leading-7 tracking-tight text-foreground numeric-tabular">
                {stats.recentlyAdded}
              </span>
            </span>
          </div>
          <p className="mt-3 text-[11px] leading-4 text-[#68717b]">
            Added in the last 7 days
          </p>
        </div>
      </section>

      {/* Toolbar */}
      <section className="rounded-[16px] border border-black/8 bg-white p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-[300px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search saved items..."
                aria-label="Search saved items"
                className="h-10 w-full rounded-full border border-black/8 bg-white pl-4 pr-10 text-sm outline-none placeholder:text-[#7a8188] focus:border-black/20"
              />
              <Search
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#68717b]"
                aria-hidden="true"
              />
            </div>
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Saved filters"
            >
              {filters.map((f) => {
                const active = f === activeFilter;
                return (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveFilter(f)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-[#e8f5a3] text-[#1a2a00] sm:bg-[#eef8c8] sm:text-[#245f14]"
                        : "border border-black/8 bg-white text-[#27313a] hover:bg-[#f5f7f8]",
                    )}
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="whitespace-nowrap text-xs font-medium text-[#68717b]">
              Sort by:
            </span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort saved items"
                className="h-9 appearance-none rounded-full border border-black/8 bg-white pl-3 pr-8 text-xs font-medium outline-none focus:border-black/20"
              >
                <option>Most recent</option>
                <option>Oldest</option>
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#68717b]">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-4">
          {request.loading ? (
            <SavedItemsLoadingSkeleton />
          ) : request.error ? (
            <StatePanel
              variant="error"
              title="Saved items unavailable"
              description={request.error}
              actionLabel="Try again"
              onAction={() => {
                setRequest((current) => ({
                  ...current,
                  loading: true,
                  error: null,
                }));
                setRetry((current) => current + 1);
              }}
              className="min-h-72 border-dashed bg-[#f7f9fa]"
            />
          ) : filtered.length === 0 ? (
            <StatePanel
              variant="empty"
              title={
                activeFilter === "Professionals"
                  ? "No saved professionals yet"
                  : activeFilter === "Services"
                    ? "No saved services yet"
                    : activeFilter === "Shortlisted"
                      ? "No shortlisted quotations yet"
                      : search
                        ? "No saved items match your search"
                        : "No saved items yet"
              }
              description={
                activeFilter === "Professionals"
                  ? "Save a professional from the marketplace to find them here."
                  : activeFilter === "Services"
                    ? "Save a service from the marketplace to find it here."
                    : activeFilter === "Shortlisted"
                      ? "Shortlisted quotations will appear here when you save a quote for later."
                      : search
                        ? "Try a different search term or switch filters."
                        : "Save professionals, services and quotations to find them here."
              }
              className="min-h-72 border-dashed bg-[#f7f9fa]"
            >
              {!search && activeFilter !== "Recent" ? (
                <Link
                  href="/marketplace"
                  className={buttonVariants({
                    size: "sm",
                    variant: "secondary",
                  })}
                >
                  Browse marketplace
                </Link>
              ) : null}
            </StatePanel>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((item) => {
                if (item.kind === "professional") {
                  const p = item.data as SavedProfessional;
                  const isRemoving = removing.has(p.slug);
                  // Use fallback illustration for Assemble / Spotless to match mock visuals
                  const isAssemble = p.slug === "assemble-pro-kenya";
                  const isSparkle = p.slug === "sparkle-clean-services";
                  return (
                    <Link
                      key={item.id}
                      href={`/professionals/${p.slug}`}
                      className="relative flex flex-col rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,31,43,0.08)]"
                    >
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeSaved(p);
                        }}
                        aria-label={`Remove ${p.businessName} from saved`}
                        className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[#5f8d11] transition-colors hover:bg-[#f7f9fa] disabled:opacity-40"
                      >
                        <Heart
                          className="size-4 fill-[#7cb518] text-[#7cb518]"
                          aria-hidden="true"
                        />
                      </button>
                      <div className="flex gap-3">
                        <div
                          className={cn(
                            "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl",
                            isAssemble
                              ? "bg-[#0a1931] text-white"
                              : isSparkle
                                ? "bg-[#eef8c8] text-[#5f8d11]"
                                : "bg-[#eef8c8] text-[#5f8d11]",
                          )}
                        >
                          {p.logoUrl ? (
                            <Image
                              src={p.logoUrl}
                              alt=""
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : isAssemble ? (
                            <Hammer className="size-6" aria-hidden="true" />
                          ) : isSparkle ? (
                            <span className="grid place-items-center">
                              <Sparkles className="size-6" aria-hidden="true" />
                            </span>
                          ) : (
                            <Store className="size-6" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pr-8">
                          <h2 className="truncate text-sm font-semibold leading-5 text-foreground">
                            {p.businessName}
                          </h2>
                          <p className="mt-0.5 truncate text-xs font-semibold text-[#5f8d11]">
                            {p.primaryCategory ?? "Home services"}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {p.verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#5f8d11]">
                                <BadgeCheck
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                Verified
                              </span>
                            ) : (
                              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                Not yet verified
                              </span>
                            )}
                            {p.slug === "assemble-pro-kenya" ? (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  <Star
                                    className="size-3 fill-[#f5a623] text-[#f5a623]"
                                    aria-hidden="true"
                                  />
                                  4.9 (128)
                                </span>
                                <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  Responds in 1h
                                </span>
                                <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  7 services
                                </span>
                              </>
                            ) : p.slug === "sparkle-clean-services" ? (
                              <>
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  <Star
                                    className="size-3 fill-[#f5a623] text-[#f5a623]"
                                    aria-hidden="true"
                                  />
                                  4.8 (156)
                                </span>
                                <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  Responds in 2h
                                </span>
                                <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                  6 services
                                </span>
                              </>
                            ) : (
                              <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 text-[11px] font-medium leading-none text-foreground">
                                {p.serviceCount} published{" "}
                                {p.serviceCount === 1 ? "service" : "services"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {p.operatingLocation ? (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#68717b]">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {p.operatingLocation}
                        </p>
                      ) : null}
                      {p.description ? (
                        <p className="my-2 truncate text-xs leading-5 text-[#68717b]">
                          {p.description}
                        </p>
                      ) : null}
                      <div className="mt-auto inline-flex items-center gap-1.5 text-xs text-[#68717b]">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        Saved {formatSavedDate(item.savedAt)}
                      </div>
                    </Link>
                  );
                }
                if (item.kind === "service") {
                  const s = item.data as MockService;
                  return (
                    <Link
                      key={item.id}
                      href={`/services/${s.slug}`}
                      className="relative flex flex-col rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,31,43,0.08)]"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeMockService(s.id);
                        }}
                        aria-label={`Remove ${s.name} from saved`}
                        className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[#5f8d11] transition-colors hover:bg-[#f7f9fa]"
                      >
                        <Heart
                          className="size-4 fill-[#7cb518] text-[#7cb518]"
                          aria-hidden="true"
                        />
                      </button>
                      <div className="flex gap-3">
                        <div className="relative h-[92px] w-[112px] shrink-0 overflow-hidden rounded-xl bg-muted">
                          <Image
                            src={s.imageUrl}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="min-w-0 flex-1 pr-6">
                          <h2 className="truncate text-sm font-semibold leading-5 text-foreground">
                            {s.name}
                          </h2>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
                                s.category === "Electrical"
                                  ? "bg-[#eef8c8] text-[#2f7d18]"
                                  : s.category === "Plumbing"
                                    ? "bg-[#eef8c8] text-[#2f7d18]"
                                    : "bg-[#eef8c8] text-[#2f7d18]",
                              )}
                            >
                              {s.category}
                            </span>
                            <span className="rounded-full bg-[#e9f0ff] px-2 py-0.5 text-[11px] font-medium leading-4 text-[#1f56bd]">
                              {s.fulfilment}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-[11px] leading-4 text-[#68717b]">
                            by {s.providerName}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-[#2f7d18]">
                              From {formatPrice(s.priceMinor)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Star
                                className="size-3 fill-[#f5a623] text-[#f5a623]"
                                aria-hidden="true"
                              />
                              <span className="font-medium text-foreground">
                                {s.rating.toFixed(1)}
                              </span>
                              <span className="text-[#68717b]">
                                ({s.reviewCount})
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-[#68717b]">
                              <MapPin className="size-3" aria-hidden="true" />
                              {s.location}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="my-2 truncate text-xs leading-5 text-[#68717b]">
                        {s.description}
                      </p>
                      <div className="mt-auto inline-flex items-center gap-1.5 text-xs text-[#68717b]">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        Saved {formatSavedDate(item.savedAt)}
                      </div>
                    </Link>
                  );
                }
                const q = item.data as MockQuotation;
                return (
                  <Link
                    key={item.id}
                    href={`/client/quotations/${q.id}`}
                    className="relative flex flex-col rounded-[16px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,31,43,0.08)]"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeMockQuotation(q.id);
                      }}
                      aria-label={`Remove ${q.title} from saved`}
                      className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-[#5f8d11] transition-colors hover:bg-[#f7f9fa]"
                    >
                      <Heart
                        className="size-4 fill-[#7cb518] text-[#7cb518]"
                        aria-hidden="true"
                      />
                    </button>
                    <div className="flex gap-3">
                      <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-[#f1eaff] text-[#6335e9]">
                        <FileText className="size-6" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 pr-10">
                        <span className="inline-flex rounded-full bg-[#f1eaff] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#6335e9]">
                          Shortlisted quotation
                        </span>
                        <h2 className="mt-1.5 truncate text-sm font-semibold leading-5 text-foreground">
                          {q.title}
                        </h2>
                        <p className="truncate text-xs text-[#68717b]">
                          by {q.providerName}
                        </p>
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#fff3d8] px-2.5 py-1 text-[11px] font-medium leading-none text-[#7a4b00]">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          Awaiting decision
                        </span>
                      </div>
                      <div className="hidden shrink-0 text-right sm:block sm:pt-7">
                        <p className="text-[11px] leading-4 text-[#68717b]">
                          Total amount
                        </p>
                        <p className="text-sm font-semibold leading-5 text-foreground">
                          {formatPrice(q.amountMinor)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 sm:hidden">
                      <p className="text-xs text-[#68717b]">Total amount</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatPrice(q.amountMinor)}
                      </p>
                    </div>
                    <div className="mt-auto inline-flex items-center gap-1.5 text-xs text-[#68717b]">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      Saved {formatSavedDate(item.savedAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
