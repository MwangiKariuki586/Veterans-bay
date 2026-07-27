"use client";

import {
  BadgeCheck,
  Clock3,
  MapPin,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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
    throw new Error(body?.error?.message ?? "This listing is not currently available.");
  }
  return body.data;
}

function formatPrice(service: Pick<PublicServiceCard, "pricingModel" | "priceMinor" | "currency">) {
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

function ListingUnavailable({ message }: { message: string }) {
  return <StatePanel variant="unavailable" headingLevel={1} title="Listing unavailable" description={message} className="min-h-72" />;
}

export function PublicProfessionalPage({ slug }: { slug: string }) {
  const [profile, setProfile] = useState<PublicProfessionalProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPublicData<PublicProfessionalProfile>(`/api/v1/public/professionals/${encodeURIComponent(slug)}`)
      .then((data) => {
        setProfile(data);
        recordMarketplaceEvent({
          eventType: "professional.profile_viewed",
          targetSlug: data.slug,
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This professional is not currently available."));
  }, [slug]);

  if (error) return <ListingUnavailable message={error} />;
  if (!profile) return <StatePanel variant="loading" headingLevel={1} title="Loading professional" description="Retrieving the latest public profile." className="min-h-72" />;

  return <div className="space-y-8">
    <Surface className="overflow-hidden p-0 shadow-none">
      <div className="grid gap-6 bg-[linear-gradient(135deg,#071522_0%,#132a3a_62%,#425f29_100%)] p-6 text-white sm:p-9 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        {profile.logoUrl ? <Image src={profile.logoUrl} alt={`${profile.businessName} logo`} width={104} height={104} className="size-24 rounded-[26px] border border-white/15 bg-white object-cover" /> : <span className="grid size-24 place-items-center rounded-[26px] bg-[#b8f52a] text-3xl font-bold text-[#071522]">{profile.businessName.slice(0, 2).toUpperCase()}</span>}
        <div><div className="flex flex-wrap gap-2">{profile.verified ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[#b8f52a] px-3 py-1 text-xs font-semibold text-[#071522]"><BadgeCheck className="size-4" /> Verified professional</span> : null}{profile.primaryCategory ? <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">{profile.primaryCategory}</span> : null}</div><h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{profile.businessName}</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">{profile.description ?? "This professional has not added a public introduction yet."}</p></div>
        <div className="grid gap-2 text-sm text-white/80">{profile.operatingLocation ? <span className="inline-flex items-center gap-2"><MapPin className="size-4 text-[#b8f52a]" /> {profile.operatingLocation}</span> : null}{profile.availabilitySummary ? <span className="inline-flex items-center gap-2"><Clock3 className="size-4 text-[#b8f52a]" /> {profile.availabilitySummary}</span> : null}</div>
      </div>
    </Surface>

    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Verified rating" value={profile.rating == null ? "New" : profile.rating.toFixed(1)} description={profile.reviewCount === 0 ? "No verified reviews yet" : `${profile.reviewCount} verified reviews`} />
      <Metric label="Completed jobs" value={String(profile.completedJobs)} description="Recorded through Veterans Bay" />
      <Metric label="Response" value={profile.responseIndicator ?? "New"} description={profile.responseIndicator ? "Recent response performance" : "Not enough activity yet"} />
    </div>

    <section><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#5f8d11]">Active services</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">What you can request</h2></div></div>{profile.services.length > 0 ? <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{profile.services.map((service) => <PublicServiceCardView key={service.slug} service={service} />)}</div> : <StatePanel title="No active services" description="This professional does not currently have a published service." className="mt-5" />}</section>

    <section><p className="text-sm font-semibold text-[#5f8d11]">Portfolio</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">Recent work</h2>{profile.portfolio.length > 0 ? <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{profile.portfolio.map((item) => <Surface key={item.id} className="overflow-hidden p-0 shadow-none">{item.imageUrl ? <div className="relative aspect-[4/3]"><Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" /></div> : null}<div className="p-5"><h3 className="font-bold">{item.title}</h3>{item.description ? <p className="mt-2 text-sm leading-6 text-[#68717b]">{item.description}</p> : null}</div></Surface>)}</div> : <StatePanel title="Portfolio coming soon" description="No public portfolio work has been added yet." className="mt-5" />}</section>
  </div>;
}

export function PublicServicePage({ slug }: { slug: string }) {
  const [service, setService] = useState<PublicServiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPublicData<PublicServiceDetail>(`/api/v1/public/services/${encodeURIComponent(slug)}`)
      .then((data) => {
        setService(data);
        recordMarketplaceEvent({
          eventType: "service.viewed",
          targetSlug: data.slug,
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This service is not currently available."));
  }, [slug]);

  if (error) return <ListingUnavailable message={error} />;
  if (!service) return <StatePanel variant="loading" headingLevel={1} title="Loading service" description="Retrieving the latest published service." className="min-h-72" />;

  const heroImage = service.images[0] ?? service.imageUrl ?? "/images/home-repair-interior.png";
  return <div className="space-y-6">
    <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb"><Link href="/" className="hover:text-foreground">Home</Link><span className="mx-2">&rsaquo;</span><Link href={`/professionals/${service.provider.slug}`} className="hover:text-foreground">{service.provider.businessName}</Link><span className="mx-2">&rsaquo;</span><span className="text-foreground">{service.name}</span></nav>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
      <div className="space-y-6">
        <div className="relative min-h-[320px] overflow-hidden rounded-[26px] border border-black/8 sm:min-h-[460px]"><Image src={heroImage} alt={service.name} fill priority className="object-cover" sizes="(max-width: 1280px) 100vw, 65vw" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20 text-white sm:p-8"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#b8f52a] px-3 py-1 text-xs font-semibold text-[#071522]">{service.category}</span><span className="rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-semibold capitalize">{service.fulfilmentModel.replace("_", "-")}</span></div><h1 className="mt-4 text-4xl font-bold tracking-[-0.05em] sm:text-5xl">{service.name}</h1></div></div>
        <Surface className="p-6 shadow-none sm:p-8"><h2 className="text-xl font-bold">About this service</h2><p className="mt-3 text-sm leading-7 text-[#68717b]">{service.description}</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Detail label="Estimated duration" value={durationLabel(service.estimatedDurationMinutes)} /><Detail label="Service areas" value={service.serviceAreas.length > 0 ? service.serviceAreas.join(", ") : "Confirmed with provider"} /><Detail label="Warranty" value={service.warrantyDurationDays == null ? "Ask the provider" : `${service.warrantyDurationDays} days`} /><Detail label="Booking" value={service.directBookingEnabled ? "Direct booking available" : "Request confirmation first"} /></div>{service.requirements.length > 0 ? <div className="mt-7 border-t border-black/8 pt-6"><h3 className="font-bold">What the provider needs from you</h3><ul className="mt-3 grid gap-2 sm:grid-cols-2">{service.requirements.map((item) => <li key={item} className="flex gap-2 text-sm text-[#68717b]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5f8d11]" />{item}</li>)}</ul></div> : null}{service.warrantyTerms ? <div className="mt-7 rounded-2xl bg-[#eef8c8] p-5"><h3 className="font-bold">Warranty information</h3><p className="mt-2 text-sm leading-6 text-[#3d4a2a]">{service.warrantyTerms}</p></div> : null}</Surface>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start"><Surface className="p-6 shadow-none"><p className="text-sm text-[#68717b]">{service.pricingModel === "starting_from" ? "Starting price" : "Price"}</p><p className="mt-1 text-3xl font-bold text-[#5f8d11]">{formatPrice(service)}</p><p className="mt-3 text-xs leading-5 text-[#68717b]">Final scope and availability are confirmed directly with the professional.</p></Surface><Surface className="p-6 shadow-none"><div className="flex items-center gap-3">{service.provider.logoUrl ? <Image src={service.provider.logoUrl} alt="" width={52} height={52} className="size-13 rounded-2xl object-cover" /> : <span className="grid size-13 place-items-center rounded-2xl bg-[#eef8c8] font-bold text-[#5f8d11]">{service.provider.businessName.slice(0, 2).toUpperCase()}</span>}<div><p className="font-bold">{service.provider.businessName}</p>{service.provider.verified ? <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#5f8d11]"><BadgeCheck className="size-3.5" /> Verified professional</p> : null}</div></div>{service.provider.operatingLocation ? <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#68717b]"><MapPin className="size-4" />{service.provider.operatingLocation}</p> : null}<Link href={`/professionals/${service.provider.slug}`} className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full")}>View professional profile</Link></Surface></aside>
    </div>
  </div>;
}

function Metric({ label, value, description }: { label: string; value: string; description: string }) {
  return <Surface className="p-5 shadow-none"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#68717b]">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[#68717b]">{description}</p></Surface>;
}

function PublicServiceCardView({ service }: { service: PublicServiceCard }) {
  return <Surface className="overflow-hidden p-0 shadow-none">{service.imageUrl ? <div className="relative aspect-[16/9]"><Image src={service.imageUrl} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" /></div> : <div className="grid aspect-[16/9] place-items-center bg-[#eef8c8]"><Wrench className="size-8 text-[#5f8d11]" /></div>}<div className="p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#5f8d11]">{service.category}</span><span className="text-sm font-bold">{formatPrice(service)}</span></div><h3 className="mt-3 text-lg font-bold">{service.name}</h3><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#68717b]">{service.description}</p><Link href={`/services/${service.slug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5 w-full")}>View service</Link></div></Surface>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#68717b]">{label}</p><p className="mt-2 text-sm font-semibold">{value}</p></div>;
}
