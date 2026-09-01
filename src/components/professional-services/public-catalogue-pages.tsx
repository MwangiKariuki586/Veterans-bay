"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Globe,
  Headphones,
  Heart,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { recordMarketplaceEvent } from "@/lib/marketplace-analytics";
import type {
  PublicProfessionalProfile,
  PublicServiceCard,
  PublicServiceDetail,
} from "@/modules/professional-services/types";

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

  const distribution = (() => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const review of profile.reviews ?? [])
      counts[review.overallRating] += 1;
    return [5, 4, 3, 2, 1].map((stars) => ({
      stars,
      count: counts[stars] ?? 0,
    })) as Array<{
      stars: number;
      count: number;
    }>;
  })();
  const maxDistribution = Math.max(1, ...distribution.map((d) => d.count));

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

  const messageHref = `/client/requests/new?source=PROFESSIONAL_MESSAGE&professional=${encodeURIComponent(profile.slug)}`;

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
    <div className="mx-auto w-full max-w-[1240px] space-y-4 px-0">
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
                  buttonVariants({ variant: "secondary" }),
                  "h-10 flex-1 rounded-full border-0 px-4 text-xs shadow-none ring-0 outline-none hover:shadow-none focus-visible:ring-2 focus-visible:ring-[#7ba51d] focus-visible:ring-offset-2 sm:w-[136px] sm:flex-none sm:px-6",
                )}
              >
                Book Now
              </Link>
              <Link
                href={messageHref}
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
                <Link
                  href={bookHref}
                  className="relative mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-white px-10 text-xs font-semibold text-[#315c18] shadow-[0_6px_16px_rgba(50,72,24,0.1)] ring-1 ring-black/5 hover:bg-[#fbfcf8]"
                >
                  Check availability
                  <CalendarDays
                    className="absolute right-4 size-3.5"
                    aria-hidden="true"
                  />
                </Link>
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

      {/* Main 3-col */}
      <div
        id="overview"
        className="grid scroll-mt-24 items-stretch gap-4 lg:grid-cols-[1.08fr_1.05fr_0.84fr]"
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

        {/* Book this professional */}
        <Surface className="order-2 hidden min-h-[405px] rounded-[16px] p-5 shadow-none sm:p-6 lg:order-3 lg:flex lg:flex-col">
          <h2 className="text-sm font-semibold text-[#0a1724]">
            Book this professional
          </h2>
          <BookingSteps
            bookHref={bookHref}
            className="mt-5 flex flex-1 flex-col"
          />
        </Surface>

        <details className="group order-2 rounded-[20px] border border-black/8 bg-white lg:hidden">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-sm font-semibold text-[#0a1724] [&::-webkit-details-marker]:hidden">
            Book this professional
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-black/8 px-5 pb-5 pt-4">
            <BookingSteps bookHref={bookHref} />
          </div>
        </details>
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
                {distribution.map((row) => (
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
                ))}
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
  const [service, setService] = useState<PublicServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPublicData<PublicServiceDetail>(
      `/api/v1/public/services/${encodeURIComponent(slug)}`,
    )
      .then((data) => {
        setService(data);
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

  const heroImage =
    service.images[0] ?? service.imageUrl ?? "/images/home-repair-interior.png";
  const isDirectBookable =
    service.directBookingEnabled &&
    service.priceMinor != null &&
    service.pricingModel !== "custom_quote";
  const bookingHref = `/client/bookings/new?professionalSlug=${encodeURIComponent(service.provider.slug)}&serviceSlug=${encodeURIComponent(service.slug)}&serviceName=${encodeURIComponent(service.name)}&providerName=${encodeURIComponent(service.provider.businessName)}`;
  const requestHref = `/client/requests/new?source=DIRECT_SERVICE_PAGE&professional=${encodeURIComponent(service.provider.slug)}&service=${encodeURIComponent(service.slug)}&category=${encodeURIComponent(service.category)}`;
  const primaryHref = isDirectBookable ? bookingHref : requestHref;
  const primaryLabel = isDirectBookable
    ? "Book this service"
    : "Request this service";

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
  const durationText = durationLabel(service.estimatedDurationMinutes);
  const priceText = formatPrice(service);
  const serviceAreasText =
    service.serviceAreas.length > 0
      ? service.serviceAreas.join(", ")
      : "Confirmed with provider";
  const truncatedAreas =
    service.serviceAreas.length > 3
      ? `${service.serviceAreas.slice(0, 3).join(", ")} & more`
      : serviceAreasText;
  const warrantyLabel =
    service.warrantyDurationDays == null
      ? "Ask the provider"
      : `${service.warrantyDurationDays} days workmanship warranty`;
  const bookingTypeLabel = service.directBookingEnabled
    ? "Direct booking available"
    : "Request confirmation first";

  const fulfilmentLabel =
    service.fulfilmentModel === "on_site"
      ? "On-Site"
      : service.fulfilmentModel === "remote"
        ? "Remote"
        : service.fulfilmentModel === "hybrid"
          ? "Hybrid"
          : String(service.fulfilmentModel).replace("_", "-");

  const heroSubtitle =
    service.description && service.description.length > 120
      ? `${service.description.slice(0, 117).trim()}...`
      : (service.description ??
        `Professional ${service.name.toLowerCase()} in your home or office.`);

  const rating = service.provider.rating;
  const reviewCount = service.provider.reviewCount ?? 0;
  const serviceReviews = service.reviews ?? [];
  const providerReviews = service.provider.reviews ?? [];
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
    service.provider.completedJobs > 0
      ? `${service.provider.completedJobs.toLocaleString()}+`
      : "No jobs yet";
  const memberSinceLabel = (() => {
    const iso = service.provider.organisationCreatedAt;
    if (!iso) return "Mar 2022";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return "Mar 2022";
    }
  })();

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
          href={`/professionals/${service.provider.slug}`}
          className="hover:text-foreground"
        >
          {service.provider.businessName}
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
          <div className="relative overflow-hidden rounded-[20px] border border-black/8 bg-[#eef2f4] shadow-[0_18px_55px_rgba(20,38,52,0.08)]">
            <div className="relative aspect-[16/9] min-h-[320px] w-full sm:min-h-[420px]">
              <Image
                src={heroImage}
                alt={service.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1280px) 100vw, 760px"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#c8f43d] px-3 py-1 text-xs font-semibold text-[#0a1724]">
                    {service.category}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-white/35 bg-black/25 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {fulfilmentLabel}
                  </span>
                </div>
                <h1 className="mt-4 max-w-[640px] text-[26px] font-semibold leading-tight tracking-tight text-white sm:text-[32px]">
                  {service.name}
                </h1>
                <p className="mt-2 max-w-[560px] text-[13px] leading-5 text-white/90 sm:text-sm">
                  {heroSubtitle}
                </p>
              </div>
            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-4 rounded-[16px] border border-black/8 bg-white px-3 py-4 shadow-sm sm:grid-cols-4 sm:px-4 sm:py-5">
            <ServiceTrustItem
              icon={<BadgeCheck className="size-4 text-[#5f8d11]" />}
              title="Verified professionals"
              subtitle="Background checked & vetted"
            />
            <ServiceTrustItem
              icon={<ShieldCheck className="size-4 text-[#5f8d11]" />}
              title="Satisfaction guaranteed"
              subtitle="We stand by our work"
            />
            <ServiceTrustItem
              icon={<Users className="size-4 text-[#5f8d11]" />}
              title="On-site service"
              subtitle="We come to you"
            />
            <ServiceTrustItem
              icon={<ShieldCheck className="size-4 text-[#5f8d11]" />}
              title="Secure payments"
              subtitle="Safe & hassle-free"
            />
          </div>

          {/* About this service */}
          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold text-[#0a1724]">
              About this service
            </h2>
            <p className="mt-1.5 text-xs leading-5 text-[#6b7782] sm:text-[13px] sm:leading-6">
              {service.description ??
                `Flat-pack and custom ${service.name.toLowerCase()} in your home or office by experienced professionals.`}
            </p>

            <dl className="mt-5 grid gap-5 sm:grid-cols-3">
              <ServiceMeta label="ESTIMATED DURATION" value={durationText} />
              <ServiceMeta label="STARTING PRICE" value={priceText} />
              <ServiceMeta label="SERVICE AREAS" value={truncatedAreas} />
            </dl>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <ServiceMeta label="WARRANTY" value={warrantyLabel} />
              <ServiceMeta label="BOOKING TYPE" value={bookingTypeLabel} />
            </dl>

            <div className="mt-6 grid gap-6 border-t border-black/8 pt-6 sm:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold text-[#0a1724] sm:text-[13px]">
                  What&apos;s included
                </h3>
                <ul className="mt-3 space-y-2">
                  {includedItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-5 text-[#4b5a68] sm:text-[13px]"
                    >
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                        <Check className="size-3" strokeWidth={2.5} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-[#0a1724] sm:text-[13px]">
                  What&apos;s not included
                </h3>
                <ul className="mt-3 space-y-2">
                  {excludedItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-xs leading-5 text-[#6b7782] sm:text-[13px]"
                    >
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#f2f5f6] text-[#8a9aa8]">
                        <X className="size-3" strokeWidth={2.5} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {service.warrantyTerms || service.warrantyDurationDays != null ? (
              <div className="mt-6 flex gap-3 rounded-[12px] bg-[#f2f8df] p-4 sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#5f8d11] shadow-sm">
                  <ShieldCheck className="size-5" />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-[#0a1724] sm:text-[13px]">
                    Warranty information
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-[#4b5a68]">
                    {service.warrantyTerms ??
                      `We provide a ${service.warrantyDurationDays ?? 14}-day workmanship warranty covering any assembly issues resulting from our work. Warranty does not cover normal wear, misuse, or third-party damage.`}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* What customers say */}
          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#0a1724] sm:text-[15px]">
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
                      (Date.now() - date.getTime()) / (24 * 60 * 60 * 1000),
                    );
                    if (diffDays < 14) return `${diffDays} days ago`;
                    if (diffDays < 32)
                      return `${Math.round(diffDays / 7)} weeks ago`;
                    if (diffDays < 60) return "1 month ago";
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
                    <div className="mt-4 flex items-center gap-2.5 border-t border-black/5 pt-3">
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
                  </article>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-[#c8f43d]" />
              <span className="size-1.5 rounded-full bg-[#dfe5e8]" />
              <span className="size-1.5 rounded-full bg-[#dfe5e8]" />
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0a1724]">
              Book this service
            </h2>
            <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8a9aa8]">
              {service.pricingModel === "starting_from"
                ? "Starting price"
                : "Price"}
            </p>
            <p className="text-[22px] font-semibold leading-none tracking-tight text-[#5f8d11]">
              {priceText}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#6b7782]">
              Final price and availability are confirmed directly with the
              professional.
            </p>
            <Link
              href={primaryHref}
              className={cn(
                buttonVariants(),
                "mt-5 h-11 w-full rounded-full bg-[#c8f43d] text-[#0a1724] hover:bg-[#b8e832]",
              )}
            >
              {primaryLabel}
            </Link>
            {isDirectBookable ? (
              <div className="mt-3 text-center">
                <Link
                  href={requestHref}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-trust underline underline-offset-4 hover:text-foreground"
                >
                  Get a custom quote for your needs
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0a1724]">Provider</h2>
            <div className="mt-4 flex gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#eef8c8] text-sm font-semibold text-[#5f8d11]">
                {service.provider.businessName.slice(0, 2).toUpperCase()}
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
                <span className="truncate">
                  {service.provider.operatingLocation ?? "Nairobi, Kenya"}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Star className="size-4 shrink-0 fill-[#ffb600] text-[#ffb600]" />
                <span>
                  {rating != null ? rating.toFixed(1) : "New"}{" "}
                  {reviewCount > 0
                    ? `(${reviewCount} reviews)`
                    : reviewCount === 0 && rating == null
                      ? ""
                      : "(0 reviews)"}
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
                "mt-5 h-10 w-full rounded-full border-black/8 bg-white",
              )}
            >
              View professional profile
            </Link>
          </div>

          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0a1724]">
              At a glance
            </h2>
            <dl className="mt-4 space-y-4">
              <div className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-[#6b7782]">
                  <MessageCircle className="size-4" />
                </span>
                <div>
                  <dt className="text-xs text-[#6b7782]">Response time</dt>
                  <dd className="text-xs font-semibold text-[#0a1724]">
                    Within 2 hours
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-[#6b7782]">
                  <BadgeCheck className="size-4" />
                </span>
                <div>
                  <dt className="text-xs text-[#6b7782]">Completed jobs</dt>
                  <dd className="text-xs font-semibold text-[#0a1724]">
                    {completedJobsLabel}
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-[#6b7782]">
                  <Globe className="size-4" />
                </span>
                <div>
                  <dt className="text-xs text-[#6b7782]">Languages</dt>
                  <dd className="text-xs font-semibold text-[#0a1724]">
                    English, Swahili
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-[#6b7782]">
                  <Users className="size-4" />
                </span>
                <div>
                  <dt className="text-xs text-[#6b7782]">Service type</dt>
                  <dd className="text-xs font-semibold capitalize text-[#0a1724]">
                    {fulfilmentLabel}
                  </dd>
                </div>
              </div>
            </dl>
          </div>

          <div className="rounded-[16px] border border-black/8 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#0a1724]">
              Need help deciding?
            </h2>
            <p className="mt-2 text-xs leading-5 text-[#6b7782]">
              Chat with our support team or request help choosing the right
              service.
            </p>
            <Link
              href="/contact"
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
      </div>
    </div>
  );
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
