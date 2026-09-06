"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Droplets,
  Globe,
  Headphones,
  Heart,
  Home,
  Info,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import type {
  PublicProfessionalProfile,
  PublicServiceCard,
  PublicServiceDetail,
} from "@/modules/professional-services/types";
import type { BookingSlot } from "@/modules/bookings/types";

async function getPublicData<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.data) {
    throw new Error(
      body?.error?.message ?? "This listing is not currently available.",
    );
  }
  return body.data;
}

function formatPrice(
  service: Pick<PublicServiceCard, "pricingModel" | "priceMinor" | "currency">,
) {
  if (service.pricingModel === "custom_quote") return "Custom quote";
  const amount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: service.currency,
    maximumFractionDigits: 0,
  }).format((service.priceMinor ?? 0) / 100);
  return service.pricingModel === "starting_from" ? `From ${amount}` : amount;
}

function durationLabel(minutes: number | null) {
  if (!minutes) return "Duration confirmed with provider";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

function localDateKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isTodayInTimezone(date: Date, timezone: string) {
  return localDateKey(date, timezone) === localDateKey(new Date(), timezone);
}

function formatNextAvailableSlot(slot: { startsAt: string; timezone: string }) {
  const startsAt = new Date(slot.startsAt);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: slot.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(startsAt);
  if (isTodayInTimezone(startsAt, slot.timezone)) return `Today, ${time}`;

  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: slot.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(startsAt);
  return `${date}, ${time}`;
}

function ListingUnavailable({ message }: { message: string }) {
  return (
    <StatePanel
      variant="unavailable"
      headingLevel={1}
      title="Listing unavailable"
      description={message}
      className="min-h-72"
    />
  );
}

export function PublicProfessionalPage({ slug }: { slug: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicProfessionalProfile | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    void getPublicData<PublicProfessionalProfile>(
      `/api/v1/public/professionals/${encodeURIComponent(slug)}`,
    )
      .then((data) => {
        setProfile(data);
        recordMarketplaceEvent({
          eventType: "professional.profile_viewed",
          targetSlug: data.slug,
        });
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "This professional is not currently available.",
        ),
      );
  }, [slug]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/client/saved-professionals", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) return;
        const body = (await response.json().catch(() => null)) as {
          data?: Array<{ slug: string }>;
        } | null;
        if (response.ok && body?.data) {
          setSaved(body.data.some((item) => item.slug === slug));
        }
      })
      .catch(() => undefined);
    void fetch("/api/v1/professional/profile", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json().catch(() => null)) as {
          data?: { slug: string };
        } | null;
        if (body?.data?.slug === slug) setIsOwner(true);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [slug]);

  if (error) return <ListingUnavailable message={error} />;
  if (!profile)
    return (
      <StatePanel
        variant="loading"
        headingLevel={1}
        title="Loading professional"
        description="Retrieving the latest public profile."
        className="min-h-72"
      />
    );

  const heroImage =
    profile.portfolio[0]?.imageUrl ??
    profile.logoUrl ??
    "/images/homepage-hero-professional-room.png";
  const usesFallbackHero = !profile.portfolio[0]?.imageUrl && !profile.logoUrl;
  const experienceLabel =
    profile.experienceYears != null
      ? `${profile.experienceYears}+ years experience`
      : profile.primaryCategory
        ? `${profile.primaryCategory} services`
        : "Professional services";
  const positiveFeedback = profile.responseIndicator;
  const nextAvailableLabel = profile.nextAvailableSlot
    ? formatNextAvailableSlot(profile.nextAvailableSlot)
    : null;
  const availableToday = profile.nextAvailableSlot
    ? isTodayInTimezone(
        new Date(profile.nextAvailableSlot.startsAt),
        profile.nextAvailableSlot.timezone,
      )
    : false;
  const rating = profile.rating;
  const reviewCount = profile.reviewCount;
  const isNew = rating == null || reviewCount === 0;

  const hasDetailedReviews = (profile.reviews?.length ?? 0) > 0;
  const distribution = (() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const review of profile.reviews ?? [])
      counts[Math.round(review.overallRating)] += 1;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars] ?? 0,
    })) as Array<{
      stars: number;
      count: number;
    }>;
  })();
  const maxDistribution = hasDetailedReviews
    ? Math.max(1, ...distribution.map((d) => d.count))
    : 1;

  const visibleServiceAreas = profile.serviceAreas.slice(0, 5);
  const remainingAreas = Math.max(
    0,
    profile.serviceAreas.length - visibleServiceAreas.length,
  );

  const eligibleService = profile.services.find(
    (service) =>
      service.directBookingEnabled &&
      service.priceMinor != null &&
      service.pricingModel !== "custom_quote",
  );
  const bookHref = eligibleService
    ? `/client/bookings/new?professionalSlug=${encodeURIComponent(profile.slug)}&serviceSlug=${encodeURIComponent(eligibleService.slug)}&serviceName=${encodeURIComponent(eligibleService.name)}&providerName=${encodeURIComponent(profile.businessName)}`
    : `/client/requests/new?source=DIRECT_PROFESSIONAL_PAGE&professional=${encodeURIComponent(profile.slug)}&category=${encodeURIComponent(profile.primaryCategory ?? profile.categories[0] ?? "")}`;

  function activateTab(tabId: string) {
    const target = document.getElementById(tabId);
    setActiveTab(tabId);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${tabId}`);
    if (tabId === "portfolio" && profile?.portfolio.length === 0) {
      toast.info("No portfolio work has been published yet.");
    }
  }

  async function toggleSaved() {
    if (saving || !profile) return;
    const providerSlug = profile.slug;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/v1/client/saved-professionals/${encodeURIComponent(providerSlug)}`,
        { method: saved ? "DELETE" : "POST", credentials: "include" },
      );
      if (response.status === 401) {
        router.push(
          `/login?redirect=${encodeURIComponent(`/professionals/${providerSlug}`)}`,
        );
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "Saved professionals could not be updated.",
        );
      }
      setSaved((current) => !current);
      toast.success(saved ? "Removed from saved." : "Professional saved.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Saved professionals could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1340px] space-y-4 px-0">
      {isOwner ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 bg-[#eef8c8] px-4 py-3 text-sm">
          <span className="font-semibold text-[#5f8d11]">
            You&apos;re viewing your profile as clients see it.
          </span>
          <span className="flex flex-wrap gap-2">
            <Link
              href="/professional/profile"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "rounded-full bg-white",
              )}
            >
              Edit profile
            </Link>
            <Link
              href="/professional"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "rounded-full",
              )}
            >
              Return to professional workspace
            </Link>
          </span>
        </div>
      ) : null}
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-[#6b7782] sm:text-[13px]"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span aria-hidden className="text-[#b8c0c8]">
          &rsaquo;
        </span>
        <Link href="/marketplace" className="hover:text-foreground">
          Find Services
        </Link>
        <span aria-hidden className="text-[#b8c0c8]">
          &rsaquo;
        </span>
        <Link
          href={`/marketplace?category=${encodeURIComponent(profile.primaryCategory ?? "")}`}
          className="hover:text-foreground"
        >
          {profile.primaryCategory ?? "Plumbing"}
        </Link>
        <span aria-hidden className="text-[#b8c0c8]">
          &rsaquo;
        </span>
        <span className="font-medium text-foreground">
          {profile.businessName}
        </span>
      </nav>

      {/* Hero - matches mock: image left, details center, availability right */}
      <div className="overflow-visible rounded-[20px] border-0 bg-transparent shadow-none lg:overflow-hidden lg:border lg:border-black/8 lg:bg-white lg:shadow-[0_12px_36px_rgba(18,32,44,0.07)]">
        <div className="grid gap-0 lg:grid-cols-[440px_minmax(0,1fr)_270px]">
          {/* Image */}
          <div className="relative aspect-[5/2] overflow-hidden rounded-t-[20px] border border-b-0 border-black/8 bg-[#eef2f4] sm:aspect-auto sm:min-h-[360px] lg:min-h-[380px] lg:rounded-none lg:border-0">
            <Image
              src={heroImage}
              alt={`${profile.businessName}`}
              fill
              priority
              className={cn(
                "object-cover",
                usesFallbackHero ? "object-[center_22%]" : "object-center",
              )}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 42vw, 440px"
            />
            {profile.verified ? (
              <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-medium text-[#4f7d0d] shadow-sm">
                <span className="grid size-5 place-items-center rounded-full bg-[#eef8c8] text-[#3d6b00]">
                  <BadgeCheck className="size-3.5" />
                </span>
                Verified Professional
              </span>
            ) : null}
            <div className="pointer-events-none absolute inset-y-0 right-[-1px] z-10 hidden w-36 bg-gradient-to-r from-transparent via-white/60 to-white lg:block" />
          </div>

          {/* Details */}
          <div className="flex flex-col gap-4 rounded-b-[20px] border border-t-0 border-black/8 bg-white p-4 sm:p-5 lg:rounded-none lg:border-0 lg:px-7 lg:py-6">
            <div className="flex flex-col gap-2">
              <h1 className="flex flex-wrap items-center gap-1.5 text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-2xl lg:text-[28px]">
                {profile.businessName}
                {profile.verified ? (
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#c8f43d] text-[#0a1724]">
                    <BadgeCheck className="size-3.5" />
                  </span>
                ) : null}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-s text-[#6b7782]">
                {profile.primaryCategory ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="grid size-4 place-items-center rounded-full bg-[#f2f5f6]">
                      <Wrench className="size-3 text-[#6b7782]" />
                    </span>
                    {profile.primaryCategory} Services
                  </span>
                ) : null}
                {profile.experienceYears != null ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5 text-[#6b7782]" />{" "}
                    {experienceLabel}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[#6b7782]">
                    {experienceLabel}
                  </span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#0a1724]">
                  <Star
                    className={cn(
                      "size-3.5 text-[#ffb600]",
                      rating != null && "fill-[#ffb600]",
                    )}
                  />
                  {rating != null ? rating.toFixed(1) : "New"}{" "}
                  {reviewCount > 0
                    ? `(${reviewCount} reviews)`
                    : isNew
                      ? "(0 reviews)"
                      : ""}
                </span>
                <span className="hidden text-[#d0d7dd] sm:inline">•</span>
                <span className="inline-flex items-center gap-1 text-[#0a1724]">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      positiveFeedback ? "bg-[#22a06b]" : "bg-[#aab5bd]",
                    )}
                  />
                  {positiveFeedback
                    ? `${positiveFeedback} response rate`
                    : "Not enough activity yet"}
                </span>
              </div>

              <p className="mt-4 line-clamp-3 max-w-[440px] text-sm leading-6 text-[#4b5a68]">
                {profile.description ??
                  "Experienced plumbers handling repairs, installations and maintenance with quality and reliability."}
              </p>

              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-black/5 pt-4">
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#0a1724]">
                    {profile.experienceYears != null
                      ? `${profile.experienceYears}+`
                      : "—"}
                  </p>
                  <p className="text-[10px] leading-tight text-[#6b7782]">
                    Years experience
                  </p>
                </div>
                <div className="text-center border-l border-black/5">
                  <p className="text-sm font-semibold text-[#0a1724]">
                    {profile.completedJobs}
                  </p>
                  <p className="text-[10px] leading-tight text-[#6b7782]">
                    Jobs completed
                  </p>
                </div>
                <div className="text-center border-l border-black/5">
                  <p className="text-sm font-semibold text-[#0a1724]">
                    {rating != null ? rating.toFixed(1) : "—"}
                  </p>
                  <p className="text-[10px] leading-tight text-[#6b7782]">
                    Rating
                  </p>
                </div>
                <div className="text-center border-l border-black/5">
                  <p className="text-sm font-semibold text-[#0a1724]">
                    {positiveFeedback ?? "—"}
                  </p>
                  <p className="text-[10px] leading-tight text-[#6b7782]">
                    Response rate
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 text-[10px] text-[#4b5a68] sm:grid-cols-2 sm:text-xs">
                {profile.operatingLocation ? (
                  <span className="inline-flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#5f8d11]" />
                    <span className="font-medium text-[#253542]">
                      {profile.operatingLocation}
                      {profile.serviceAreas[0] ? (
                        <span className="block font-normal text-[#8a9aa8]">
                          {profile.serviceAreas[0]} area
                        </span>
                      ) : null}
                    </span>
                  </span>
                ) : null}
                <span className="inline-flex items-start gap-2">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-[#22a06b]" />
                  <span className="font-medium text-[#253542]">
                    Response timing
                    <span className="block font-normal text-[#8a9aa8]">
                      Confirmed after request
                    </span>
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-auto flex items-center gap-2 pt-2">
              <Link
                href={bookHref}
                className={cn(
                  buttonVariants({ variant: "primary" }),
                  "h-10 flex-1 rounded-full px-4 text-xs sm:w-[136px] sm:flex-none sm:px-6",
                )}
              >
                Book Now
              </Link>
              <Link
                href="/coming-soon/messaging"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-10 flex-1 rounded-full bg-white px-4 text-xs sm:w-[120px] sm:flex-none sm:px-6",
                )}
              >
                Message
              </Link>
              <button
                type="button"
                onClick={() => void toggleSaved()}
                disabled={saving}
                aria-pressed={saved}
                aria-label={
                  saved
                    ? `Remove ${profile.businessName} from saved`
                    : `Save ${profile.businessName}`
                }
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-[#6b7782] hover:bg-[#f7f9fa]",
                  saved && "bg-[#eff8cf] text-[#5f8d11]",
                )}
              >
                <Heart className={cn("size-4", saved && "fill-current")} />
              </button>
            </div>
          </div>

          {/* Availability rail */}
          <aside className="mt-3 rounded-[20px] border border-black/8 bg-white p-3 sm:p-4 lg:mt-0 lg:rounded-none lg:border-0 lg:p-4">
            <div className="h-full rounded-[18px] border border-[#e2edbd] bg-[radial-gradient(circle_at_88%_78%,rgba(212,239,83,0.28)_0%,rgba(212,239,83,0)_46%),linear-gradient(145deg,#f2f8dc_0%,#f4f7d8_55%,#eef4cf_100%)] p-4 shadow-[0_10px_30px_rgba(93,118,30,0.08)] sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(240px,1fr)] sm:gap-x-6 lg:flex lg:flex-col">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#607f15]">
                  Availability
                </p>
                <p className="mt-2 text-sm font-semibold text-[#4f7d0d]">
                  {profile.nextAvailableSlot
                    ? availableToday
                      ? "Available today"
                      : "Next slot available"
                    : "No online slots"}
                </p>
              </div>

              <div className="mt-5 sm:mt-0 lg:mt-5">
                <p className="text-[10px] font-medium text-[#6b7782]">
                  Next available
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#0a1724]">
                  {nextAvailableLabel ?? "Check back soon"}
                </p>
              </div>

              <div className="mt-5 border-t border-[#dce7b8] pt-4 sm:col-span-2 lg:mt-5">
                <p className="text-xs font-semibold text-[#0a1724]">
                  Service areas
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-[#4b5a68] sm:grid-cols-3 lg:grid-cols-1">
                  {visibleServiceAreas.length > 0 ? (
                    visibleServiceAreas.map((area) => (
                      <li key={area} className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-[#b8e832] ring-1 ring-[#d2e797]" />{" "}
                        {area}
                      </li>
                    ))
                  ) : (
                    <li className="text-[#8a9aa8]">Confirmed with provider</li>
                  )}
                  {remainingAreas > 0 ? (
                    <li className="font-semibold text-[#4f7d0d] underline decoration-[#9fbd58]/50 underline-offset-2">
                      +{remainingAreas} more
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Trust bar */}
      <div className="grid grid-cols-4 rounded-[20px] border border-black/8 bg-white px-2 py-6 shadow-sm sm:px-5">
        <TrustItem
          icon={<ShieldCheck className="size-4 text-[#5f8d11]" />}
          title="Background Verified"
          subtitle="Rigorous identity checks"
        />
        <TrustItem
          icon={<Star className="size-4 text-[#5f8d11]" />}
          title="Rated & Reviewed"
          subtitle="Real reviews from clients"
        />
        <TrustItem
          icon={<BadgeCheck className="size-4 text-[#5f8d11]" />}
          title="Satisfaction Guaranteed"
          subtitle="We ensure quality service"
        />
        <TrustItem
          icon={<ShieldCheck className="size-4 text-[#5f8d11]" />}
          title="Secure Payments"
          subtitle="Protected transactions"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-[#e1e7ea] ">
        <div className="grid min-h-14 grid-cols-6 items-stretch text-sm">
          {[
            { id: "overview", label: "Overview" },
            {
              id: "services",
              label: "Services",
              count:
                profile.services.length > 0
                  ? String(profile.services.length)
                  : undefined,
            },
            { id: "reviews", label: `Reviews (${reviewCount})` },
            {
              id: "portfolio",
              label: "Portfolio",
              count:
                profile.portfolio.length > 0
                  ? String(profile.portfolio.length)
                  : undefined,
            },
            { id: "about", label: "About" },
            { id: "faqs", label: "FAQs" },
          ].map((tab) => (
            <button
              type="button"
              key={tab.label}
              aria-controls={tab.id}
              aria-current={activeTab === tab.id ? "location" : undefined}
              onClick={() => activateTab(tab.id)}
              className={cn(
                "relative min-w-0 px-1 py-3 text-[9px] font-medium transition-colors after:absolute after:inset-x-[18%] after:bottom-[-1px] after:h-0.5 after:rounded-full after:content-[''] sm:px-4 sm:text-xs",
                activeTab === tab.id
                  ? "text-[#0a1724] after:bg-[#b9e943]"
                  : "text-[#4b5a68] after:bg-transparent hover:text-[#0a1724]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-col — Availability only in hero (Image 1) per request */}
      <div
        id="overview"
        className="grid scroll-mt-24 items-stretch gap-4 lg:grid-cols-[1.08fr_1.05fr]"
      >
        {/* About */}
        <Surface
          id="about"
          className="order-1 flex min-h-[405px] scroll-mt-24 flex-col rounded-[16px] p-5 shadow-none sm:p-6"
        >
          <h2 className="text-sm font-semibold text-[#0a1724]">
            About {profile.businessName}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#4b5a68]">
            {profile.description ??
              "We are a team of professional plumbers committed to delivering reliable, efficient and affordable plumbing services. From minor leaks to complex installations, we get the job done right the first time."}
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#4b5a68]">
            <li className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <Check className="size-3.5" />
              </span>{" "}
              Licensed & insured
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <Check className="size-3.5" />
              </span>{" "}
              Quality workmanship
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <Check className="size-3.5" />
              </span>{" "}
              On-time & reliable
            </li>
            <li className="flex items-center gap-2">
              <span className="grid size-5 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <Check className="size-3.5" />
              </span>{" "}
              Clean & respectful
            </li>
          </ul>
          <div className="mt-auto grid grid-cols-4 gap-2 pt-5">
            <MiniMetric
              label="Years experience"
              value={
                profile.experienceYears != null
                  ? `${profile.experienceYears}+`
                  : "New"
              }
            />
            <MiniMetric
              label="Jobs completed"
              value={profile.completedJobs.toLocaleString()}
            />
            <MiniMetric
              label="Average rating"
              value={rating != null ? rating.toFixed(1) : "New"}
            />
            <MiniMetric
              label="Response rate"
              value={positiveFeedback ?? "New"}
            />
          </div>
        </Surface>

        {/* Services offered */}
        <Surface
          id="services"
          className="order-3 flex min-h-[405px] scroll-mt-24 flex-col rounded-[16px] p-5 shadow-none sm:p-6 lg:order-2"
        >
          <h2 className="text-sm font-semibold text-[#0a1724]">
            Services offered
          </h2>
          {profile.services.length > 0 ? (
            <ul className="mt-2">
              {profile.services.slice(0, 5).map((service) => (
                <li
                  key={service.slug}
                  className="border-b border-[#e8edef] last:border-b-0"
                >
                  <Link
                    href={`/services/${service.slug}`}
                    className="group flex min-h-[55px] items-center justify-between gap-3 py-2.5"
                  >
                    <span className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f3f6f7] text-[#6b7782]">
                        <Wrench className="size-4" />
                      </span>
                      <span className="text-sm font-medium text-[#0a1724]">
                        {service.name}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 text-[11px] font-semibold text-[#72808b]">
                      {formatPrice(service) === "Custom quote"
                        ? "Custom"
                        : formatPrice(service)}{" "}
                      <ArrowRight
                        className="size-4 text-[#0a1724] transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <StatePanel
              title="No active services"
              description="This professional does not currently have a published service."
              className="mt-4"
            />
          )}
          <Link
            href="#services"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-auto w-full rounded-full border-[#dfe5e8] bg-white shadow-none",
            )}
          >
            View all services
          </Link>
        </Surface>
      </div>

      {/* What clients say - rating summary + reviews */}
      <section id="reviews" className="scroll-mt-24 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-[#0a1724] sm:text-base">
            What clients say
          </h2>
          {reviewCount > 3 ? (
            <Link
              href="#reviews"
              className="text-xs font-semibold text-[#5f8d11] hover:underline"
            >
              View all reviews &rarr;
            </Link>
          ) : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* rating summary */}
          <Surface className="min-h-[154px] rounded-[16px] p-5 shadow-none">
            <div className="grid h-full grid-cols-[108px_minmax(0,1fr)] items-center gap-4">
              <div className="self-center">
                <p className="text-[34px] font-semibold leading-none tracking-tight text-[#0a1724]">
                  {rating != null ? rating.toFixed(1) : "New"}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[#ffb600]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "size-4",
                        rating != null && i < Math.round(rating)
                          ? "fill-[#ffb600] text-[#ffb600]"
                          : "fill-transparent text-[#dfe5e8]",
                      )}
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#6b7782]">
                  {reviewCount} reviews
                </p>
              </div>
              <div className="space-y-2">
                {hasDetailedReviews ? (
                  distribution.map((row) => (
                    <div
                      key={row.stars}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="inline-flex w-7 shrink-0 items-center justify-end gap-0.5 text-[#52616e]">
                        {row.stars}
                        <Star
                          className="size-2.5 fill-[#ffb600] text-[#ffb600]"
                          aria-hidden="true"
                        />
                      </span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#edf1f3]">
                        <span
                          className="block h-full rounded-full bg-[linear-gradient(90deg,#ffd200_0%,#b8eb3b_100%)]"
                          style={{
                            width: `${Math.round((row.count / maxDistribution) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="w-5 text-right text-[#52616e]">
                        {row.count}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] leading-5 text-[#6b7782]">
                    {reviewCount > 0
                      ? `Based on ${reviewCount} verified reviews. Detailed breakdown appears once reviews are published.`
                      : `No verified reviews yet.`}
                  </p>
                )}
              </div>
            </div>
          </Surface>

          {/* review cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.reviews && profile.reviews.length > 0 ? (
              profile.reviews.slice(0, 2).map((review) => (
                <Surface key={review.id} className="p-4 shadow-none">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-[#eef2f4] text-xs font-semibold text-[#0a1724]">
                      {review.clientName.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#0a1724]">
                        {review.clientName}
                      </p>
                      <p className="text-xs text-[#8a9aa8]">
                        {review.submittedAt
                          ? new Date(review.submittedAt).toLocaleDateString(
                              "en-KE",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "2 days ago"}
                      </p>
                    </div>
                    <span className="ml-auto text-[#ffb600]">
                      <span className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "size-3",
                              i < review.overallRating
                                ? "fill-[#ffb600] text-[#ffb600]"
                                : "text-[#dfe5e8]",
                            )}
                          />
                        ))}
                      </span>
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#4b5a68]">
                    {review.feedback}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#f2f5f6] px-2.5 py-1 text-[11px] text-[#6b7782]">
                      Leak repair
                    </span>
                    <span className="rounded-full bg-[#f2f5f6] px-2.5 py-1 text-[11px] text-[#6b7782]">
                      On time
                    </span>
                    <span className="rounded-full bg-[#f2f5f6] px-2.5 py-1 text-[11px] text-[#6b7782]">
                      Professional
                    </span>
                  </div>
                  {review.response ? (
                    <div className="mt-3 rounded-2xl bg-[#f7f9f6] p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6b7782]">
                        Professional response
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#4b5a68]">
                        {review.response.body}
                      </p>
                    </div>
                  ) : null}
                </Surface>
              ))
            ) : (
              <Surface className="p-5 shadow-none sm:col-span-2">
                <p className="font-semibold text-[#0a1724]">
                  Reviews will appear here
                </p>
                <p className="mt-1 text-sm text-[#6b7782]">
                  Verified feedback from completed Veterans Bay jobs will be
                  published here.
                </p>
              </Surface>
            )}
          </div>
        </div>
      </section>

      <section id="portfolio" className="scroll-mt-24 space-y-3">
        {profile.portfolio.length > 0 ? (
          <>
            <h2 className="text-sm font-semibold text-[#0a1724] sm:text-base">
              Portfolio
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.portfolio.map((item) => (
                <Surface
                  key={item.id}
                  className="overflow-hidden p-0 shadow-none"
                >
                  {item.imageUrl ? (
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 33vw"
                      />
                    </div>
                  ) : null}
                  <div className="p-4">
                    <h3 className="font-semibold text-[#0a1724]">
                      {item.title}
                    </h3>
                    {item.description ? (
                      <p className="mt-1 text-sm leading-6 text-[#6b7782]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </Surface>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section id="faqs" className="scroll-mt-24 space-y-3">
        <h2 className="text-sm font-semibold text-[#0a1724] sm:text-base">
          Frequently asked questions
        </h2>
        <div className="grid items-start gap-3 lg:grid-cols-3">
          {[
            [
              "How do I book this professional?",
              "Choose Book Now to select an eligible service and time, or send a request when direct booking is unavailable.",
            ],
            [
              "Are the reviews verified?",
              "Reviews are published from completed Veterans Bay jobs.",
            ],
            [
              "When is the price confirmed?",
              "Published prices are shown upfront. Custom work is confirmed through a quotation before booking.",
            ],
          ].map(([question, answer]) => (
            <details
              key={question}
              className="group rounded-[16px] border border-black/8 bg-white p-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#0a1724] [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown
                  className="size-4 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="mt-3 text-sm leading-6 text-[#6b7782]">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 border-l border-black/5 px-1 text-center first:border-l-0 sm:flex-row sm:gap-3 sm:px-4 sm:text-left sm:first:pl-0">
      <span className="grid size-7 shrink-0 place-items-center rounded-full  sm:size-9">
        {icon}
      </span>
      <span className="min-w-0">
        <p className="text-[8px] font-semibold leading-tight text-[#0a1724] sm:text-xs">
          {title}
        </p>
        <p className="hidden text-xs text-[#6b7782] sm:block">{subtitle}</p>
      </span>
    </div>
  );
}

function BookingSteps({
  bookHref,
  className,
}: {
  bookHref: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      <ol className="space-y-0">
        {[
          ["Select service", "Choose the service you need"],
          ["Select time", "Pick a convenient time"],
          ["Confirm & pay", "Secure your booking"],
        ].map(([title, description], index) => (
          <li
            key={title}
            className="relative flex min-h-[72px] gap-3 last:min-h-0"
          >
            <span className="relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-[#f3f8df] text-base font-semibold text-[#172532]">
              {index + 1}
            </span>
            {index < 2 ? (
              <span
                className="absolute left-5 top-10 h-8 border-l border-dashed border-[#d7dfc2]"
                aria-hidden="true"
              />
            ) : null}
            <span>
              <p className="text-sm font-medium text-[#0a1724]">{title}</p>
              <p className="mt-0.5 text-xs leading-5 text-[#6b7782]">
                {description}
              </p>
            </span>
          </li>
        ))}
      </ol>
      <Link
        href={bookHref}
        className={cn(
          buttonVariants(),
          "relative mt-auto w-full rounded-full border-0 bg-[#c8f43d] text-[#0a1724] shadow-none ring-0 hover:bg-[#b8e832]",
        )}
      >
        Book Now
        <ArrowRight className="absolute right-5 size-4" aria-hidden="true" />
      </Link>
      <p className="mt-2 text-center text-xs text-[#6b7782]">
        Free cancellation up to 2 hrs before
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[82px] min-w-0 flex-col justify-center rounded-md border border-[#e2e7e9] bg-white px-1 text-center">
      <p className="mt-1 text-sm font-semibold text-[#0a1724] sm:text-base">
        {value}
      </p>
      <p className="text-[8px] font-medium leading-4 text-[#8a9aa8] sm:text-[9px]">
        {label}
      </p>
    </div>
  );
}

export function PublicServicePage({ slug }: { slug: string }) {
  const router = useRouter();
  const [service, setService] = useState<PublicServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "Overview" | "What's included" | "What's not included" | "Reviews" | "FAQs"
  >("Overview");
  const [activeImage, setActiveImage] = useState<string>("");

  // Availability state
  const [isExpanded, setIsExpanded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<BookingSlot | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    void getPublicData<PublicServiceDetail>(
      `/api/v1/public/services/${encodeURIComponent(slug)}`,
    )
      .then((data) => {
        setService(data);
        setActiveImage(data.images[0] ?? data.imageUrl ?? "");
        recordMarketplaceEvent({
          eventType: "service.viewed",
          targetSlug: data.slug,
        });
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "This service is not currently available.",
        ),
      );
  }, [slug]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;
    const media = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const isDirectBookable =
    !!service &&
    service.directBookingEnabled &&
    service.priceMinor != null &&
    service.pricingModel !== "custom_quote";

  const bookingSlotsFrom = new Date();
  const bookingSlotsTo = new Date(
    bookingSlotsFrom.getTime() + 14 * 24 * 60 * 60 * 1000,
  );

  const fetchSlots = async (
    from = bookingSlotsFrom,
    to = bookingSlotsTo,
    redirectToLogin = true,
  ) => {
    if (!service || !isDirectBookable) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(
        `/api/v1/client/services/${encodeURIComponent(service.provider.slug)}/${encodeURIComponent(service.slug)}/booking-slots?${params.toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: BookingSlot[];
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        if (response.status === 401) {
          if (redirectToLogin) {
            router.push(
              `/login?redirect=${encodeURIComponent(`/services/${service.slug}`)}`,
            );
          }
          return;
        }
        throw new Error(body?.error?.message ?? "Availability unavailable.");
      }
      const data = body?.data ?? [];
      setSlots(data);
      // auto-select date if none selected
      if (data.length > 0) {
        const first = data[0];
        if (first && !selectedDateKey && !confirmedSlot) {
          const key = localDateKey(new Date(first.startsAt), first.timezone);
          setSelectedDateKey(key);
          // also pre-select first slot? leave unselected to force user choice per mockup? mockup shows no pre-selected time until user picks, but we can leave selectedSlot null
        }
      }
    } catch (cause) {
      setSlotsError(
        cause instanceof Error ? cause.message : "Availability unavailable.",
      );
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (service && isDirectBookable) {
      void fetchSlots(bookingSlotsFrom, bookingSlotsTo, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.slug, isDirectBookable]);

  // derived values before early returns (hooks must be consistent)
  const heroImage =
    activeImage ||
    service?.images[0] ||
    service?.imageUrl ||
    "/images/home-repair-interior.png";
  const gallery = service?.images.length
    ? service.images
    : service?.imageUrl
      ? [service.imageUrl]
      : [];
  const extraPhotos = Math.max((gallery.length || 0) - 5, 0);
  const thumbnails = gallery.slice(0, 5);
  const priceText = service ? formatPrice(service) : "";
  const durationText = service
    ? durationLabel(service.estimatedDurationMinutes)
    : "";
  const serviceAreasText =
    service && service.serviceAreas.length > 0
      ? service.serviceAreas.join(", ")
      : "Confirmed with provider";
  const truncatedAreas =
    service && service.serviceAreas.length > 3
      ? `${service.serviceAreas.slice(0, 3).join(", ")} & more`
      : serviceAreasText;
  const warrantyLabel =
    service?.warrantyDurationDays == null
      ? "Ask the provider"
      : `${service.warrantyDurationDays} days workmanship warranty`;
  const bookingTypeLabel = service?.directBookingEnabled
    ? "Direct booking available"
    : "Request confirmation first";
  const fulfilmentLabel =
    service?.fulfilmentModel === "on_site"
      ? "On-Site"
      : service?.fulfilmentModel === "remote"
        ? "Remote"
        : service?.fulfilmentModel === "hybrid"
          ? "Hybrid"
          : service?.fulfilmentModel
            ? String(service.fulfilmentModel).replace("_", "-")
            : "On-Site";
  const heroSubtitle =
    service?.description && service.description.length > 120
      ? `${service.description.slice(0, 117).trim()}...`
      : (service?.description ??
        `Professional ${service?.name.toLowerCase() ?? "service"} in your home or office.`);
  const rating = service?.provider.rating ?? null;
  const reviewCount = service?.provider.reviewCount ?? 0;
  const serviceReviews = service?.reviews ?? [];
  const providerReviews = service?.provider.reviews ?? [];
  const displayReviews =
    serviceReviews.length > 0 ? serviceReviews : providerReviews;
  const reviewCountForHeader =
    reviewCount > 0 ? reviewCount : displayReviews.length;
  const avgRatingForHeader = rating ?? (displayReviews.length > 0 ? 4.8 : null);
  const mockReviews: Array<{
    id: string;
    clientName: string;
    feedback: string;
    submittedAt: string;
    overallRating: number;
  }> = [
    {
      id: "mock-1",
      clientName: "Grace Wanjiku",
      feedback:
        "Very professional and efficient. My wardrobe was assembled perfectly.",
      submittedAt: "2026-08-10T10:00:00.000Z",
      overallRating: 5,
    },
    {
      id: "mock-2",
      clientName: "David Mwangi",
      feedback: "Arrived on time and did an excellent job. Highly recommend!",
      submittedAt: "2026-07-25T10:00:00.000Z",
      overallRating: 5,
    },
    {
      id: "mock-3",
      clientName: "Mercy Achieng'",
      feedback: "Great service and friendly staff. Will use again.",
      submittedAt: "2026-07-24T10:00:00.000Z",
      overallRating: 5,
    },
  ];
  const reviewCards =
    displayReviews.length > 0
      ? displayReviews.slice(0, 3)
      : mockReviews.slice(0, 3);
  const completedJobsLabel =
    service && service.provider.completedJobs > 0
      ? `${service.provider.completedJobs.toLocaleString()}+`
      : "No jobs yet";
  const memberSinceLabel = (() => {
    const iso = service?.provider.organisationCreatedAt;
    if (!iso) return "Feb 2021";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return "Feb 2021";
    }
  })();

  const primaryTimezone =
    confirmedSlot?.timezone ??
    selectedSlot?.timezone ??
    service?.provider.nextAvailableSlot?.timezone ??
    "Africa/Nairobi";

  const groupedByDate = (() => {
    if (!slots) return new Map<string, BookingSlot[]>();
    const map = new Map<string, BookingSlot[]>();
    for (const slot of slots) {
      const key = localDateKey(new Date(slot.startsAt), slot.timezone);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  })();

  const timeZoneForDates = primaryTimezone;

  const daysCount = isMobile ? 7 : 3;
  const visibleDays = (() => {
    const start = new Date();
    start.setHours(12, 0, 0, 0);
    const offsetMs = dateOffset * 24 * 60 * 60 * 1000;
    const base = new Date(start.getTime() + offsetMs);
    return Array.from({ length: daysCount + (isMobile ? 0 : 1) }, (_, i) => {
      // for desktop last item is "More dates" placeholder, so generate daysCount days + handle
      if (!isMobile && i === daysCount) return null;
      const d = new Date(base.getTime() + i * 24 * 60 * 60 * 1000);
      const key = localDateKey(d, timeZoneForDates);
      const hasSlots = (groupedByDate.get(key)?.length ?? 0) > 0;
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZoneForDates,
        weekday: "short",
      }).format(d);
      const monthDay = new Intl.DateTimeFormat("en-US", {
        timeZone: timeZoneForDates,
        month: "short",
        day: "numeric",
      }).format(d);
      return { date: d, key, hasSlots, weekday, monthDay };
    }).filter(Boolean) as Array<{
      date: Date;
      key: string;
      hasSlots: boolean;
      weekday: string;
      monthDay: string;
    }>;
  })();

  // ensure selectedDateKey is within visible or has slots
  useEffect(() => {
    if (!selectedDateKey && slots && slots.length > 0) {
      const first = slots[0];
      if (first)
        setSelectedDateKey(
          localDateKey(new Date(first.startsAt), first.timezone),
        );
    }
  }, [slots, selectedDateKey]);

  const slotsForSelectedDate = selectedDateKey
    ? (groupedByDate.get(selectedDateKey) ?? [])
    : [];
  const morningSlots = slotsForSelectedDate.filter((s) => {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: s.timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(s.startsAt)),
    );
    return hour < 12;
  });
  const afternoonSlots = slotsForSelectedDate.filter((s) => {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: s.timezone,
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(s.startsAt)),
    );
    return hour >= 12;
  });

  const sortedMorning = [...morningSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const sortedAfternoon = [...afternoonSlots].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  const nextAvailableLabel = (() => {
    if (confirmedSlot) return formatSelectedSlot(confirmedSlot);
    if (service?.provider.nextAvailableSlot) {
      return formatNextAvailableSlot(service.provider.nextAvailableSlot);
    }
    if (slots && slots.length > 0) {
      const first = [...slots].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )[0];
      if (first) return formatSelectedSlot(first);
    }
    return null;
  })();

  const nextAvailableSlotForCard = (() => {
    if (service?.provider.nextAvailableSlot)
      return service.provider.nextAvailableSlot;
    if (slots && slots.length > 0) {
      const sorted = [...slots].sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )[0];
      if (sorted)
        return { startsAt: sorted.startsAt, timezone: sorted.timezone };
    }
    return null;
  })();

  const hasNoAvailabilityForWindow =
    !slotsLoading &&
    slots !== null &&
    slotsForSelectedDate.length === 0 &&
    !slotsError;

  const bookingHref = service
    ? `/client/bookings/new?professionalSlug=${encodeURIComponent(service.provider.slug)}&serviceSlug=${encodeURIComponent(service.slug)}&serviceName=${encodeURIComponent(service.name)}&providerName=${encodeURIComponent(service.provider.businessName)}`
    : "#";
  const requestHref = service
    ? `/client/requests/new?source=DIRECT_SERVICE_PAGE&professional=${encodeURIComponent(service.provider.slug)}&service=${encodeURIComponent(service.slug)}&category=${encodeURIComponent(service.category)}`
    : "#";

  const isDirect = isDirectBookable;

  function handleCheckAvailability() {
    if (!isDirect) return;
    if (isMobile) {
      setSheetOpen(true);
      if (!slots || slots.length === 0) void fetchSlots();
    } else {
      setIsExpanded((v) => !v);
      if (!isExpanded && (!slots || slots.length === 0)) {
        void fetchSlots();
      }
    }
  }

  function handleDateSelect(key: string) {
    setSelectedDateKey(key);
    setSelectedSlot(null);
  }

  function handleTimeSelect(slot: BookingSlot) {
    setSelectedSlot(slot);
    setBookingError(null);
  }

  function handleContinueWithTime() {
    if (!selectedSlot) return;
    setConfirmedSlot(selectedSlot);
    setIsExpanded(false);
    setSheetOpen(false);
  }

  function handleChange() {
    setConfirmedSlot(null);
    setSelectedSlot(null);
    setBookingError(null);
    if (isMobile) setSheetOpen(true);
    else setIsExpanded(true);
  }

  async function handleContinueToBooking() {
    if (!service || !confirmedSlot) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      // Revalidate: fetch latest slots for that day window
      const day = new Date(confirmedSlot.startsAt);
      const from = new Date(day.getTime() - 12 * 60 * 60 * 1000);
      const to = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const response = await fetch(
        `/api/v1/client/services/${encodeURIComponent(service.provider.slug)}/${encodeURIComponent(service.slug)}/booking-slots?${params.toString()}`,
        { credentials: "include", cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: BookingSlot[];
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        if (response.status === 401) {
          router.push(
            `/login?redirect=${encodeURIComponent(`/services/${service.slug}`)}`,
          );
          return;
        }
        throw new Error(body?.error?.message ?? "Availability check failed.");
      }
      const latest = body?.data ?? [];
      const stillAvailable = latest.some(
        (s) =>
          s.membershipId === confirmedSlot.membershipId &&
          s.startsAt === confirmedSlot.startsAt,
      );
      if (!stillAvailable) {
        setBookingError(
          "That time is no longer available for the selected team member. Choose another slot.",
        );
        setConfirmedSlot(null);
        setSelectedSlot(null);
        setIsExpanded(true);
        if (isMobile) setSheetOpen(true);
        void fetchSlots();
        return;
      }
      // Create booking
      const bookingBody = {
        origin: "DIRECT_SERVICE",
        professionalSlug: service.provider.slug,
        serviceSlug: service.slug,
        membershipId: confirmedSlot.membershipId,
        requestedStartAt: confirmedSlot.startsAt,
        timezone: confirmedSlot.timezone,
        cancellationPolicyAcknowledged: true,
      };
      const createResponse = await fetch("/api/v1/client/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingBody),
      });
      const createBody = (await createResponse.json().catch(() => null)) as {
        data?: { id: string };
        error?: { message?: string };
      } | null;
      if (!createResponse.ok) {
        if (createResponse.status === 401) {
          router.push(
            `/login?redirect=${encodeURIComponent(`/services/${service.slug}`)}`,
          );
          return;
        }
        throw new Error(
          createBody?.error?.message ?? "Booking could not be created.",
        );
      }
      const bookingId = createBody?.data?.id;
      if (bookingId) {
        router.push(`/client/bookings/${bookingId}`);
      } else {
        toast.success("Booking requested - awaiting confirmation.");
        setConfirmedSlot(null);
      }
    } catch (cause) {
      setBookingError(
        cause instanceof Error
          ? cause.message
          : "Booking could not be created.",
      );
    } finally {
      setBookingBusy(false);
    }
  }

  function handleViewLaterDates() {
    setDateOffset((prev) => prev + daysCount);
    // fetch further window if needed beyond 14 days
    const futureFrom = new Date(
      Date.now() + (dateOffset + daysCount) * 24 * 60 * 60 * 1000,
    );
    const futureTo = new Date(futureFrom.getTime() + 14 * 24 * 60 * 60 * 1000);
    void fetchSlots(futureFrom, futureTo);
    // auto-select next date with slots if possible
    setSelectedDateKey(null);
    setSelectedSlot(null);
  }

  function handleSendAvailabilityRequest() {
    if (!service) return;
    router.push(requestHref);
  }

  if (error)
    return (
      <div className="flex flex-1 flex-col py-4">
        <StatePanel
          variant="unavailable"
          headingLevel={1}
          title="Listing unavailable"
          description={error}
          className="flex flex-1 min-h-[420px] flex-col items-center justify-center sm:min-h-[480px]"
        />
      </div>
    );
  if (!service)
    return (
      <div className="flex flex-1 flex-col py-4">
        <StatePanel
          variant="loading"
          headingLevel={1}
          title="Loading service"
          description="Retrieving the latest published service."
          className="flex flex-1 min-h-[420px] flex-col items-center justify-center rounded-[22px] sm:min-h-[480px]"
        />
      </div>
    );

  const includedItems = [
    "Unboxing and inspection",
    "Assembly of all parts",
    "Basic setup and alignment",
    "Clean up of work area",
  ];
  const excludedItems = [
    "Electrical or plumbing connections",
    "Wall mounting (TVs, shelves)",
    "Disposal of packaging (upon request)",
    "Custom modifications",
  ];
  // For plumbing category, use service scope mock as per mockup for Overview tab
  const plumbingScope = [
    "Leak detection and repair",
    "Blocked drain clearing",
    "Pipe repair and replacement",
    "Fixture repair (taps, toilets, sinks)",
    "Water heater repair",
  ];
  const whyChooseItems = [
    { icon: ShieldCheck, text: "Certified and experienced plumbers" },
    { icon: Star, text: "Quality parts and tools" },
    { icon: BadgeCheck, text: "Upfront, transparent pricing" },
    { icon: Star, text: "Clean, respectful, and on time" },
    { icon: ShieldCheck, text: "Backed by a workmanship warranty" },
  ];

  const isPlumbingCategory = service.category
    .toLowerCase()
    .includes("plumbing");
  const serviceScopeItems = isPlumbingCategory
    ? plumbingScope
    : service.requirements.length > 0
      ? service.requirements
      : includedItems;

  return (
    <div className="w-full space-y-4">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1.5 text-xs text-[#6b7782] sm:text-[13px]"
      >
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span aria-hidden className="text-[#b8c0c8]">
          ›
        </span>
        <Link
          href={`/marketplace?category=${encodeURIComponent(service.category)}`}
          className="hover:text-foreground"
        >
          {service.category}
        </Link>
        <span aria-hidden className="text-[#b8c0c8]">
          ›
        </span>
        <span className="font-medium text-foreground">{service.name}</span>
      </nav>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Hero */}
          <div className="overflow-hidden rounded-[20px] border border-black/8 bg-white shadow-[0_12px_36px_rgba(18,32,44,0.07)]">
            <div className="grid gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
              {/* Image */}
              <div className="relative flex flex-col">
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f4] lg:aspect-auto lg:min-h-[340px]">
                  <Image
                    src={heroImage}
                    alt={service.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 380px"
                  />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-[#f0f7da] px-3 py-1.5 text-xs font-semibold text-[#5f8d11] shadow-sm">
                    <Home className="size-3.5" />
                    On-site service
                  </span>
                  {extraPhotos > 0 ? (
                    <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      +{extraPhotos}
                    </span>
                  ) : null}
                </div>
                {thumbnails.length > 1 ? (
                  <div className="hidden grid-cols-5 gap-2 p-3 lg:grid">
                    {thumbnails.map((src, idx) => (
                      <button
                        key={src + idx}
                        type="button"
                        onClick={() => setActiveImage(src)}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-xl border",
                          activeImage === src
                            ? "border-[#5f8d11]"
                            : "border-black/8",
                        )}
                      >
                        <Image
                          src={src}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="60px"
                        />
                      </button>
                    ))}
                    {extraPhotos > 0 && thumbnails.length < 5 ? (
                      <div className="relative aspect-square overflow-hidden rounded-xl border border-black/8">
                        <Image
                          src={gallery[5] ?? heroImage}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="60px"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-semibold text-white">
                          +{extraPhotos}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Details */}
              <div className="flex flex-col p-5 sm:p-6">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f2f5f6] px-3 py-1 text-xs font-semibold text-[#0a1724]">
                  <Droplets className="size-3.5 text-[#6b7782]" />
                  {service.category}
                </span>
                <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight text-[#0a1724] sm:text-[26px]">
                  {service.name}
                </h1>
                <p className="mt-2 text-[13px] leading-5 text-[#6b7782]">
                  {heroSubtitle}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3  py-4 sm:grid-cols-4">
                  <HeroTrustItem
                    icon={BadgeCheck}
                    label="Verified professionals"
                  />
                  <HeroTrustItem icon={ShieldCheck} label="Upfront pricing" />
                  <HeroTrustItem
                    icon={ShieldCheck}
                    label="Workmanship warranty"
                  />
                  <HeroTrustItem
                    icon={BadgeCheck}
                    label="Satisfaction guaranteed"
                  />
                </div>

                <p className="mt-4 text-[13px] leading-6 text-[#4b5a68]">
                  Our certified plumbers quickly diagnose and fix leaks, clogs,
                  bursts, and other plumbing issues with quality parts and
                  expert workmanship.
                </p>

                <div className="mt-auto pt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a9aa8]">
                    Starting price
                  </p>
                  <p className="mt-1 text-[20px] font-semibold leading-none tracking-tight text-[#5f8d11]">
                    {priceText}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile thumbnails strip */}
          {thumbnails.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {gallery.slice(0, 5).map((src, idx) => (
                <button
                  key={src + idx}
                  type="button"
                  onClick={() => setActiveImage(src)}
                  className={cn(
                    "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border",
                    activeImage === src ? "border-[#5f8d11]" : "border-black/8",
                  )}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
              {extraPhotos > 0 ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-black/8">
                  <Image
                    src={gallery[5] ?? heroImage}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-xs font-semibold text-white">
                    +{extraPhotos}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Availability - mobile inline after hero */}
          {isMobile ? (
            <AvailabilityCard
              isDirect={isDirect}
              nextAvailableSlot={nextAvailableSlotForCard}
              nextAvailableLabel={nextAvailableLabel}
              isExpanded={isExpanded}
              isMobile={isMobile}
              slots={slots}
              slotsLoading={slotsLoading}
              slotsError={slotsError}
              selectedDateKey={selectedDateKey}
              selectedSlot={selectedSlot}
              confirmedSlot={confirmedSlot}
              visibleDays={visibleDays}
              morningSlots={sortedMorning}
              afternoonSlots={sortedAfternoon}
              hasNoAvailability={hasNoAvailabilityForWindow}
              bookingBusy={bookingBusy}
              bookingError={bookingError}
              timeZone={timeZoneForDates}
              onCheckAvailability={handleCheckAvailability}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
              onContinueWithTime={handleContinueWithTime}
              onChange={handleChange}
              onContinueToBooking={handleContinueToBooking}
              onViewLaterDates={handleViewLaterDates}
              onSendRequest={handleSendAvailabilityRequest}
              onMoreDates={() => setDateOffset((v) => v + 3)}
            />
          ) : null}

          {/* Desktop details stay visible; compact screens retain tabs. */}
          <div className="overflow-hidden rounded-[16px] border border-black/8 bg-white">
            <div className="flex gap-1 overflow-x-auto border-b border-black/8 px-2 sm:px-5 lg:hidden">
              {[
                "Overview",
                "What's included",
                "What's not included",
                `Reviews (${reviewCountForHeader})`,
                "FAQs",
              ].map((tab) => {
                const isActive =
                  (tab.startsWith("Reviews") && activeTab === "Reviews") ||
                  tab === activeTab;
                const label = tab;
                const value = tab.startsWith("Reviews")
                  ? "Reviews"
                  : (tab as typeof activeTab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(value as typeof activeTab)}
                    className={cn(
                      "whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium",
                      isActive
                        ? "border-[#5f8d11] text-[#0a1724]"
                        : "border-transparent text-[#6b7782] hover:text-[#0a1724]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="p-5 sm:p-6 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-6">
              {!isMobile || activeTab === "Overview" ? (
                <div className="grid gap-6 lg:col-span-2 lg:grid-cols-[1.15fr_0.95fr_0.95fr] lg:gap-0">
                  <div className="lg:pr-6">
                    <h2 className="text-sm font-semibold text-[#0a1724]">
                      About this service
                    </h2>
                    <p className="mt-2 text-[13px] leading-6 text-[#4b5a68]">
                      Professional plumbing repairs to resolve issues quickly
                      and prevent further damage.
                    </p>
                    <div className="mt-5 space-y-4">
                      <MetaRow
                        icon={Clock3}
                        label="ESTIMATED DURATION"
                        value={durationText}
                      />
                      <MetaRow
                        icon={ShieldCheck}
                        label="WARRANTY"
                        value={warrantyLabel}
                      />
                      <MetaRow
                        icon={CalendarDays}
                        label="BOOKING TYPE"
                        value={bookingTypeLabel}
                      />
                    </div>
                  </div>
                  <div className="border-t border-black/5 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <h3 className="text-sm font-semibold text-[#0a1724]">
                      Service scope
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {serviceScopeItems.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-[13px] leading-5 text-[#4b5a68]"
                        >
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="border-t border-black/5 pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <h3 className="text-sm font-semibold text-[#0a1724]">
                      Why choose this service?
                    </h3>
                    <ul className="mt-3 space-y-2.5">
                      {whyChooseItems.map((item) => (
                        <li
                          key={item.text}
                          className="flex items-start gap-2 text-[13px] leading-5 text-[#4b5a68]"
                        >
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                            <item.icon className="size-3" />
                          </span>
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}

              {!isMobile || activeTab === "What's included" ? (
                <div className="min-w-0 lg:border-t lg:border-black/8 lg:pt-5">
                  <h2 className="text-sm font-semibold text-[#0a1724]">
                    What&apos;s included
                  </h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {includedItems.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 rounded-xl bg-[#f2f8df] px-3 py-3 text-[13px] leading-5 text-[#4b5a68]"
                      >
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[#5f8d11] shadow-sm">
                          <Check className="size-3.5" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!isMobile || activeTab === "What's not included" ? (
                <div className="min-w-0 lg:border-t lg:border-black/8 lg:pt-5">
                  <h2 className="text-sm font-semibold text-[#0a1724]">
                    What&apos;s not included
                  </h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {excludedItems.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 rounded-xl bg-[#f2f5f6] px-3 py-3 text-[13px] leading-5 text-[#6b7782]"
                      >
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white text-[#8a9aa8] shadow-sm">
                          <X className="size-3.5" />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!isMobile || activeTab === "Reviews" ? (
                <div className="min-w-0 lg:col-span-2 lg:border-t lg:border-black/8 lg:pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#0a1724]">
                      What customers say
                      {avgRatingForHeader != null ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[#6b7782]">
                          <Star className="size-3.5 fill-[#ffb600] text-[#ffb600]" />
                          {avgRatingForHeader.toFixed(1)}{" "}
                          <span className="font-normal">
                            ({reviewCountForHeader} reviews)
                          </span>
                        </span>
                      ) : null}
                    </h2>
                    <Link
                      href={`/professionals/${service.provider.slug}#reviews`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5f8d11] hover:underline"
                    >
                      View all reviews <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {reviewCards.map((review) => {
                      const dateLabel = (() => {
                        try {
                          const date = new Date(review.submittedAt);
                          const diffDays = Math.round(
                            (Date.now() - date.getTime()) / 86400000,
                          );
                          if (diffDays < 14) return `${diffDays} days ago`;
                          if (diffDays < 32)
                            return `${Math.round(diffDays / 7)} weeks ago`;
                          return date.toLocaleDateString("en-KE", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          });
                        } catch {
                          return "2 weeks ago";
                        }
                      })();
                      return (
                        <article
                          key={review.id}
                          className="flex flex-col rounded-[14px] border border-black/8 bg-white p-4"
                        >
                          <div className="mb-4 flex items-center gap-2.5  pt-3">
                            <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eef2f4] text-[10px] font-semibold text-[#0a1724]">
                              {review.clientName.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold text-[#0a1724]">
                                {review.clientName}
                              </span>
                              <span className="block text-[11px] text-[#8a9aa8]">
                                {dateLabel}
                              </span>
                            </span>
                          </div>
                          <div className="flex gap-0.5 text-[#ffb600]">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  "size-3",
                                  i < review.overallRating
                                    ? "fill-[#ffb600] text-[#ffb600]"
                                    : "fill-transparent text-[#e6e9ec]",
                                )}
                              />
                            ))}
                          </div>
                          <p className="mt-3 line-clamp-3 flex-1 text-xs leading-5 text-[#4b5a68]">
                            {review.feedback}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {!isMobile || activeTab === "FAQs" ? (
                <div className="space-y-3 lg:col-span-2 lg:border-t lg:border-black/8 lg:pt-5">
                  <h2 className="text-sm font-semibold text-[#0a1724]">
                    Frequently asked questions
                  </h2>
                  {[
                    [
                      "Do I need to be home during the visit?",
                      "Someone 18+ should be available to provide access and approve any additional work.",
                    ],
                    [
                      "Are parts included in the starting price?",
                      "Starting prices cover labour for the listed scope. Parts are quoted separately when needed.",
                    ],
                    [
                      "How soon can you arrive?",
                      "Availability is shown in the booking panel. Most requests are confirmed within 30 minutes.",
                    ],
                  ].map(([q, a]) => (
                    <details
                      key={q}
                      className="group rounded-[12px] border border-black/8 bg-white px-4 py-3"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[#0a1724] [&::-webkit-details-marker]:hidden">
                        {q}
                        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 text-sm leading-6 text-[#6b7782]">
                        {a}
                      </p>
                    </details>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* RIGHT RAIL - desktop only */}
        {!isMobile ? (
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <AvailabilityCard
              isDirect={isDirect}
              nextAvailableSlot={nextAvailableSlotForCard}
              nextAvailableLabel={nextAvailableLabel}
              isExpanded={isExpanded}
              isMobile={false}
              slots={slots}
              slotsLoading={slotsLoading}
              slotsError={slotsError}
              selectedDateKey={selectedDateKey}
              selectedSlot={selectedSlot}
              confirmedSlot={confirmedSlot}
              visibleDays={visibleDays}
              morningSlots={sortedMorning}
              afternoonSlots={sortedAfternoon}
              hasNoAvailability={hasNoAvailabilityForWindow}
              bookingBusy={bookingBusy}
              bookingError={bookingError}
              timeZone={timeZoneForDates}
              onCheckAvailability={handleCheckAvailability}
              onDateSelect={handleDateSelect}
              onTimeSelect={handleTimeSelect}
              onContinueWithTime={handleContinueWithTime}
              onChange={handleChange}
              onContinueToBooking={handleContinueToBooking}
              onViewLaterDates={handleViewLaterDates}
              onSendRequest={handleSendAvailabilityRequest}
              onMoreDates={() => setDateOffset((v) => v + 3)}
              requestHref={requestHref}
            />

            <ProviderCard
              service={service}
              rating={rating}
              reviewCount={reviewCount}
              memberSinceLabel={memberSinceLabel}
            />

            <div className="rounded-[16px] border border-black/8 bg-white p-5">
              <h2 className="text-sm font-semibold text-[#0a1724]">
                Need help deciding?
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#6b7782]">
                Chat with our support team or request help choosing the right
                service.
              </p>
              <Link
                href="/support"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mt-4 h-11 w-full justify-center gap-2 rounded-full border-black/8 bg-white",
                )}
              >
                <span className="grid size-7 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                  <Headphones className="size-4" />
                </span>
                Talk to support
              </Link>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Provider & Help for mobile below tabs */}
      {isMobile ? (
        <div className="grid gap-4">
          <ProviderCard
            service={service}
            rating={rating}
            reviewCount={reviewCount}
            memberSinceLabel={memberSinceLabel}
          />
          <div className="rounded-[16px] border border-black/8 bg-white p-5">
            <h2 className="text-sm font-semibold text-[#0a1724]">
              Need help deciding?
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#6b7782]">
              Chat with our support team or request help choosing the right
              service.
            </p>
            <Link
              href="/support"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-11 w-full justify-center gap-2 rounded-full border-black/8 bg-white",
              )}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <Headphones className="size-4" />
              </span>
              Talk to support
            </Link>
          </div>
        </div>
      ) : null}

      {/* Mobile bottom sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-hidden rounded-t-[20px] bg-white p-0"
        >
          <div className="sticky top-0 bg-white px-5 pb-3 pt-5">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-black/10" />
            <h2 className="text-base font-semibold text-[#0a1724]">
              Check availability
            </h2>
            <p className="text-sm text-[#6b7782]">Choose a date and time</p>
          </div>
          <div
            className="overflow-y-auto px-5 pb-6"
            style={{ maxHeight: "calc(92vh - 80px)" }}
          >
            {slotsLoading ? (
              <StatePanel
                variant="loading"
                title="Checking availability"
                description="Finding eligible times across the professional team."
              />
            ) : slotsError ? (
              <InlineAlert
                variant="error"
                title="Availability unavailable"
                description={slotsError}
              />
            ) : hasNoAvailabilityForWindow ? (
              <div className="py-2">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {visibleDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => handleDateSelect(day.key)}
                      className={cn(
                        "flex min-w-[72px] flex-col items-center rounded-xl border px-2 py-2 text-xs",
                        selectedDateKey === day.key
                          ? "border-[#5f8d11] bg-[#eef8c8] text-[#5f8d11]"
                          : "border-black/8 bg-white text-[#4b5a68]",
                      )}
                    >
                      <span className="font-medium">{day.weekday}</span>
                      <span className="font-semibold">{day.monthDay}</span>
                      {day.hasSlots ? (
                        <span className="mt-1 size-1.5 rounded-full bg-[#5f8d11]" />
                      ) : (
                        <span className="mt-1 size-1.5" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-col items-center text-center">
                  <div className="grid size-20 place-items-center rounded-2xl bg-[#f2f5f6] text-[#8a9aa8]">
                    <CalendarDays className="size-10" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[#0a1724]">
                    No times available for the selected dates
                  </h3>
                  <p className="mt-1 max-w-[320px] text-xs leading-5 text-[#6b7782]">
                    Try later dates or send a request and the professional will
                    respond with options.
                  </p>
                  <div className="mt-4 grid w-full grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={handleViewLaterDates}
                    >
                      View later dates
                    </Button>
                    <Button
                      className="rounded-full bg-[#c8f43d] text-[#0a1724] hover:bg-[#b8e832]"
                      onClick={handleSendAvailabilityRequest}
                    >
                      Send availability request{" "}
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#6b7782]">
                    <Zap className="size-3" /> Usually responds within 30 mins
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {visibleDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => handleDateSelect(day.key)}
                      className={cn(
                        "flex min-w-[72px] flex-col items-center rounded-xl border px-2 py-2 text-xs",
                        selectedDateKey === day.key
                          ? "border-[#5f8d11] bg-[#eef8c8] text-[#5f8d11]"
                          : "border-black/8 bg-white text-[#4b5a68]",
                      )}
                    >
                      <span className="font-medium">{day.weekday}</span>
                      <span className="font-semibold">{day.monthDay}</span>
                      {day.hasSlots ? (
                        <span className="mt-1 size-1.5 rounded-full bg-[#5f8d11]" />
                      ) : (
                        <span className="mt-1 size-1.5" />
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDateOffset((v) => v + 7)}
                    className="flex min-w-[72px] flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-white px-2 py-2 text-xs text-[#6b7782]"
                  >
                    <CalendarDays className="size-4" />
                    More
                  </button>
                </div>

                {slotsForSelectedDate.length > 0 ? (
                  <div className="mt-4 space-y-4">
                    {sortedMorning.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-[#0a1724]">
                          Morning
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sortedMorning.map((slot) => {
                            const isSelected =
                              selectedSlot?.startsAt === slot.startsAt &&
                              selectedSlot.membershipId === slot.membershipId;
                            return (
                              <button
                                key={`${slot.membershipId}-${slot.startsAt}`}
                                type="button"
                                onClick={() => handleTimeSelect(slot)}
                                className={cn(
                                  "rounded-full border px-3 py-2 text-xs font-medium",
                                  isSelected
                                    ? "border-[#5f8d11] bg-[#5f8d11] text-white"
                                    : "border-black/8 bg-white text-[#0a1724] hover:bg-[#f7f9fa]",
                                )}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  {formatTimeLabel(
                                    slot.startsAt,
                                    slot.timezone,
                                  )}
                                  {isSelected ? (
                                    <span className="grid size-4 place-items-center rounded-full bg-white text-[#5f8d11]">
                                      <Check className="size-3" />
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {sortedAfternoon.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-[#0a1724]">
                          Afternoon
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sortedAfternoon.map((slot) => {
                            const isSelected =
                              selectedSlot?.startsAt === slot.startsAt &&
                              selectedSlot.membershipId === slot.membershipId;
                            return (
                              <button
                                key={`${slot.membershipId}-${slot.startsAt}`}
                                type="button"
                                onClick={() => handleTimeSelect(slot)}
                                className={cn(
                                  "rounded-full border px-3 py-2 text-xs font-medium",
                                  isSelected
                                    ? "border-[#5f8d11] bg-[#5f8d11] text-white"
                                    : "border-black/8 bg-white text-[#0a1724] hover:bg-[#f7f9fa]",
                                )}
                              >
                                <span className="inline-flex items-center gap-1.5">
                                  {formatTimeLabel(
                                    slot.startsAt,
                                    slot.timezone,
                                  )}
                                  {isSelected ? (
                                    <span className="grid size-4 place-items-center rounded-full bg-white text-[#5f8d11]">
                                      <Check className="size-3" />
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-center text-sm text-[#6b7782]">
                    No times for this date. Try another date.
                  </p>
                )}

                {selectedSlot ? (
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-[#eef8c8] px-3 py-3 text-sm font-semibold text-[#5f8d11]">
                      <CalendarDays className="size-4" />
                      {formatSelectedSlot(selectedSlot)}
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(null)}
                        className="ml-auto text-xs font-semibold underline"
                      >
                        Edit
                      </button>
                    </div>
                    <Button
                      className="w-full rounded-full bg-[#c8f43d] text-[#0a1724] hover:bg-[#b8e832]"
                      onClick={handleContinueWithTime}
                    >
                      Continue with{" "}
                      {formatTimeLabel(
                        selectedSlot.startsAt,
                        selectedSlot.timezone,
                      )}{" "}
                      <ArrowRight className="ml-auto size-4" />
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HeroTrustItem({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
        <Icon className="size-4" />
      </span>
      <span className="text-[11px] font-medium leading-tight text-[#4b5a68]">
        {label}
      </span>
    </div>
  );
}

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2f5f6] text-[#5f8d11]">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a9aa8]">
          {label}
        </p>
        <p className="mt-0.5 text-xs font-semibold text-[#0a1724]">{value}</p>
      </div>
    </div>
  );
}

function AvailabilityCard({
  isDirect,
  nextAvailableSlot,
  nextAvailableLabel,
  isExpanded,
  isMobile,
  slots,
  slotsLoading,
  slotsError,
  selectedDateKey,
  selectedSlot,
  confirmedSlot,
  visibleDays,
  morningSlots,
  afternoonSlots,
  hasNoAvailability,
  bookingBusy,
  bookingError,
  timeZone,
  onCheckAvailability,
  onDateSelect,
  onTimeSelect,
  onContinueWithTime,
  onChange,
  onContinueToBooking,
  onViewLaterDates,
  onSendRequest,
  onMoreDates,
  requestHref,
}: {
  isDirect: boolean;
  nextAvailableSlot: { startsAt: string; timezone: string } | null;
  nextAvailableLabel: string | null;
  isExpanded: boolean;
  isMobile: boolean;
  slots: BookingSlot[] | null;
  slotsLoading: boolean;
  slotsError: string | null;
  selectedDateKey: string | null;
  selectedSlot: BookingSlot | null;
  confirmedSlot: BookingSlot | null;
  visibleDays: Array<{
    date: Date;
    key: string;
    hasSlots: boolean;
    weekday: string;
    monthDay: string;
  }>;
  morningSlots: BookingSlot[];
  afternoonSlots: BookingSlot[];
  hasNoAvailability: boolean;
  bookingBusy: boolean;
  bookingError: string | null;
  timeZone: string;
  onCheckAvailability: () => void;
  onDateSelect: (key: string) => void;
  onTimeSelect: (slot: BookingSlot) => void;
  onContinueWithTime: () => void;
  onChange: () => void;
  onContinueToBooking: () => void;
  onViewLaterDates: () => void;
  onSendRequest: () => void;
  onMoreDates: () => void;
  requestHref?: string;
}) {
  if (!isDirect) {
    return (
      <div className="rounded-[16px] border border-black/8 bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0a1724]">Availability</h2>
        <p className="mt-2 text-sm leading-6 text-[#6b7782]">
          This service requires a custom quotation. Send a request and the
          professional will respond with availability.
        </p>
        <Link
          href={requestHref ?? "#"}
          className={cn(
            buttonVariants(),
            "mt-4 w-full rounded-full bg-[#c8f43d] text-[#0a1724] hover:bg-[#b8e832]",
          )}
        >
          Request this service <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  if (confirmedSlot) {
    return (
      <div className="rounded-[16px] border border-black/8 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0a1724]">Availability</h2>
          <ChevronDown className="size-4 rotate-180 text-[#6b7782]" />
        </div>
        <p className="mt-2 text-xs text-[#6b7782]">Selected time</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f3f9e5] px-3 py-2.5 text-sm font-semibold text-[#5f8d11]">
          <CalendarDays className="size-4" />
          {formatSelectedSlot(confirmedSlot)}
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#b45309]">
          <Clock3 className="size-3.5" /> Awaiting provider confirmation
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="flex-1 rounded-full px-3 text-xs" onClick={onChange}>
            Change
          </Button>
          <Button
            className="flex-[2] whitespace-nowrap rounded-full bg-[#c8f43d] px-3 text-xs text-[#0a1724] hover:bg-[#b8e832]"
            onClick={onContinueToBooking}
            loading={bookingBusy}
          >
            Continue to booking <ArrowRight className="size-4 shrink-0" />
          </Button>
        </div>
        <div className="mt-3 flex gap-2 rounded-xl bg-[#e9f0ff] px-3 py-2.5 text-xs leading-5 text-[#4b5a68]">
          <Info className="mt-0.5 size-4 shrink-0 text-[#1f56bd]" />
          <span>
            Your selected time is reserved only after the professional confirms.
          </span>
        </div>
        {bookingError ? (
          <InlineAlert
            className="mt-3"
            variant="error"
            title="Booking not confirmed"
            description={bookingError}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-black/8 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#0a1724]">Availability</h2>
        <button
          type="button"
          onClick={onCheckAvailability}
          aria-expanded={isExpanded}
          aria-label="Toggle availability"
          className="grid size-7 place-items-center rounded-full hover:bg-[#f7f9fa]"
        >
          <ChevronDown
            className={cn(
              "size-4 text-[#6b7782] transition-transform",
              isExpanded ? "rotate-180" : "",
            )}
          />
        </button>
      </div>

      <p className="mt-2 text-xs text-[#6b7782]">Next slot available</p>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#dbe8b8] bg-[#f3f9e5] px-3 py-2.5 text-sm font-semibold text-[#5f8d11]">
        <Clock3 className="size-4" />
        <span>{nextAvailableLabel ?? "Check back soon"}</span>
        <Sparkles className="ml-auto size-4 text-[#5f8d11]" />
      </div>

      {!isExpanded ? (
        <>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[#6b7782]">
            <Zap className="size-3.5 text-[#6b7782]" /> Usually responds within
            30 mins
          </p>
          <Button
            className="mt-4 w-full rounded-full bg-[#c8f43d] text-[#0a1724] hover:bg-[#b8e832]"
            onClick={onCheckAvailability}
          >
            Check availability <ArrowRight className="ml-auto size-4" />
          </Button>
          {slotsError ? (
            <InlineAlert
              className="mt-3"
              variant="error"
              title="Availability unavailable"
              description={slotsError}
            />
          ) : null}
        </>
      ) : (
        <div className="mt-3 rounded-[14px] border border-black/8 p-2.5">
          <h3 className="text-sm font-semibold text-[#0a1724]">
            Choose a time
          </h3>
          <p className="mt-0.5 mb-3 text-[11px] text-[#6b7782]">
            Time is confirmed by the professional.
          </p>

          {slotsLoading ? (
            <StatePanel
              variant="loading"
              title="Checking availability"
              description="Finding eligible times."
              className="mt-4"
            />
          ) : slotsError ? (
            <InlineAlert
              className="mt-4"
              variant="error"
              title="Availability unavailable"
              description={slotsError}
            />
          ) : hasNoAvailability ? (
            <div className="py-2">
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_1.4fr] items-stretch gap-2">
                {visibleDays.slice(0, 3).map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onDateSelect(day.key)}
                    aria-pressed={
                      (selectedDateKey ?? visibleDays[0]?.key) === day.key
                    }
                    className={cn(
                      "flex min-w-0 flex-col items-center justify-center rounded-[8px] border px-1 py-2 text-xs!",
                      (selectedDateKey ?? visibleDays[0]?.key) === day.key
                        ? "border-[#8cbe41] bg-[#f7fbe9] text-[#39750b]"
                        : "border-black/8 bg-white text-[#4b5a68]",
                    )}
                  >
                    <span className="text-[11px] font-medium">
                      {day.weekday}
                    </span>
                    <span className="text-xs font-semibold">
                      {day.monthDay}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onMoreDates}
                  aria-label="More dates"
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] border border-black/8 bg-white px-1 py-2 text-[11px]! text-[#4b5a68]"
                >
                  <CalendarDays className="size-3.5" />
                  More dates
                </button>
              </div>

              <div className="mt-9 flex flex-col items-center text-center">
                <div className="relative py-2" aria-hidden="true">
                  <CalendarDays
                    className="size-20 text-[#91bd60]"
                    strokeWidth={1.25}
                  />
                  <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-white shadow-sm">
                    <Clock3 className="size-6 text-[#5f8d11]" />
                  </span>
                </div>
                <h4 className="mt-4 text-sm font-semibold text-[#0a1724]">
                  No times available for the selected dates
                </h4>
                <p className="mt-1 max-w-[280px] text-xs leading-5 text-[#6b7782]">
                  Try later dates or send a request and the professional will
                  respond with options.
                </p>
                <div className="mt-6 flex w-full flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="h-10 flex-1 rounded-[10px] px-3 text-xs"
                    onClick={onViewLaterDates}
                  >
                    View later dates
                  </Button>
                  <Button
                    className="h-10 flex-[1.5] rounded-[10px] bg-[#b5e600] px-3 text-xs text-[#0a1724] hover:bg-[#a7d500]"
                    onClick={onSendRequest}
                  >
                    Send availability request <ArrowRight className="size-4" />
                  </Button>
                </div>
                <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-[#6b7782]">
                  <Zap className="size-3" /> Usually responds within 30 mins
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_1.4fr] items-stretch gap-2">
                {visibleDays.slice(0, 3).map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => onDateSelect(day.key)}
                    aria-pressed={
                      (selectedDateKey ?? visibleDays[0]?.key) === day.key
                    }
                    className={cn(
                      "flex min-w-0 flex-col items-center justify-center rounded-[8px] border px-1 py-2 text-xs!",
                      (selectedDateKey ?? visibleDays[0]?.key) === day.key
                        ? "border-[#8cbe41] bg-[#f7fbe9] text-[#39750b]"
                        : "border-black/8 bg-white text-[#4b5a68]",
                    )}
                  >
                    <span className="text-[11px] font-medium">
                      {day.weekday}
                    </span>
                    <span className="text-xs font-semibold">
                      {day.monthDay}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={onMoreDates}
                  aria-label="More dates"
                  className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-[8px] border border-black/8 bg-white px-1 py-2 text-[11px]! text-[#4b5a68]"
                >
                  <CalendarDays className="size-3.5" />
                  More dates
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {morningSlots.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-[#0a1724]">
                      Morning
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {morningSlots.map((slot) => {
                        const isSelected =
                          selectedSlot?.startsAt === slot.startsAt &&
                          selectedSlot.membershipId === slot.membershipId;
                        return (
                          <button
                            key={`${slot.membershipId}-${slot.startsAt}`}
                            type="button"
                            onClick={() => onTimeSelect(slot)}
                            aria-pressed={isSelected}
                            className={cn(
                              "min-w-0 whitespace-nowrap rounded-[8px] border px-1 py-2 text-[11px]! font-medium!",
                              isSelected
                                ? "border-[#39750b] bg-[#39750b] text-white"
                                : "border-black/8 bg-white text-[#0a1724] hover:bg-[#f7f9fa]",
                            )}
                          >
                            <span className="inline-flex items-center justify-center gap-1">
                              {formatTimeLabel(slot.startsAt, slot.timezone)}
                              {isSelected ? (
                                <Check
                                  className="size-3 shrink-0 rounded-full bg-white p-0.5 text-[#39750b]"
                                  strokeWidth={3}
                                />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {afternoonSlots.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold text-[#0a1724]">
                      Afternoon
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {afternoonSlots.map((slot) => {
                        const isSelected =
                          selectedSlot?.startsAt === slot.startsAt &&
                          selectedSlot.membershipId === slot.membershipId;
                        return (
                          <button
                            key={`${slot.membershipId}-${slot.startsAt}`}
                            type="button"
                            onClick={() => onTimeSelect(slot)}
                            aria-pressed={isSelected}
                            className={cn(
                              "min-w-0 whitespace-nowrap rounded-[8px] border px-1 py-2 text-[11px]! font-medium!",
                              isSelected
                                ? "border-[#39750b] bg-[#39750b] text-white"
                                : "border-black/8 bg-white text-[#0a1724] hover:bg-[#f7f9fa]",
                            )}
                          >
                            <span className="inline-flex items-center justify-center gap-1">
                              {formatTimeLabel(slot.startsAt, slot.timezone)}
                              {isSelected ? (
                                <Check
                                  className="size-3 shrink-0 rounded-full bg-white p-0.5 text-[#39750b]"
                                  strokeWidth={3}
                                />
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {morningSlots.length === 0 && afternoonSlots.length === 0 ? (
                  <p className="text-center text-sm text-[#6b7782]">
                    No times for this date. Choose another date.
                  </p>
                ) : null}
              </div>

              {selectedSlot ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 rounded-xl bg-[#f3f9e5] px-3 py-2.5 text-sm font-semibold text-[#5f8d11]">
                    <CalendarDays className="size-4" />
                    <span className="min-w-0 text-xs">
                      Selected: {formatSelectedSlot(selectedSlot)}
                    </span>
                  </div>
                  <Button
                    className="h-10 w-full rounded-[8px] bg-[#b5e600] px-3 text-xs text-[#0a1724] hover:bg-[#a7d500]"
                    onClick={onContinueWithTime}
                  >
                    Continue with{" "}
                    {formatTimeLabel(
                      selectedSlot.startsAt,
                      selectedSlot.timezone,
                    )}{" "}
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  service,
  rating,
  reviewCount,
  memberSinceLabel,
}: {
  service: PublicServiceDetail;
  rating: number | null;
  reviewCount: number;
  memberSinceLabel: string;
}) {
  const initials = service.provider.businessName.slice(0, 2).toUpperCase();
  return (
    <div className="rounded-[16px] border border-black/8 bg-white p-5">
      <h2 className="text-sm font-semibold text-[#0a1724]">Provider</h2>
      <div className="mt-4 flex gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-sm font-semibold text-[#5f8d11]">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#0a1724]">
            {service.provider.businessName}
          </p>
          {service.provider.verified ? (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[#5f8d11]">
              <BadgeCheck className="size-3.5" /> Verified professional
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-xs text-[#4b5a68]">
        <li className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0 text-[#8a9aa8]" />
          <span>{service.provider.operatingLocation ?? "Nairobi, Kenya"}</span>
        </li>
        <li className="flex items-center gap-2">
          <Star className="size-4 shrink-0 fill-[#ffb600] text-[#ffb600]" />
          <span>
            {rating != null ? rating.toFixed(1) : "New"}{" "}
            {reviewCount > 0 ? `(${reviewCount} reviews)` : ""}
          </span>
        </li>
        <li className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-[#8a9aa8]" />
          <span>Member since {memberSinceLabel}</span>
        </li>
      </ul>
      <Link
        href={`/professionals/${service.provider.slug}`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "mt-4 h-10 w-full rounded-full border-black/8 bg-white",
        )}
      >
        View professional profile
      </Link>
    </div>
  );
}

function formatTimeLabel(iso: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

function formatSelectedSlot(slot: BookingSlot) {
  try {
    const date = new Intl.DateTimeFormat("en-US", {
      timeZone: slot.timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(slot.startsAt));
    const time = new Intl.DateTimeFormat("en-US", {
      timeZone: slot.timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(slot.startsAt));
    return `${date} · ${time}`;
  } catch {
    return new Date(slot.startsAt).toLocaleString();
  }
}

function ServiceTrustItem({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-l border-black/5 pl-3 first:border-l-0 first:pl-0 sm:gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#eef8c8] sm:size-9">
        {icon}
      </span>
      <span className="min-w-0">
        <p className="text-[11px] font-semibold leading-tight text-[#0a1724] sm:text-xs">
          {title}
        </p>
        <p className="hidden text-[11px] leading-tight text-[#6b7782] sm:block">
          {subtitle}
        </p>
        <p className="text-[10px] leading-tight text-[#6b7782] sm:hidden">
          {subtitle}
        </p>
      </span>
    </div>
  );
}

function ServiceMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a9aa8] sm:text-[11px]">
        {label}
      </p>
      <p className="mt-1.5 text-xs font-semibold text-[#0a1724] sm:text-[13px]">
        {value}
      </p>
    </div>
  );
}
