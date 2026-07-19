"use client";

import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Lock,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { MarketplaceService } from "@/components/marketplace/fixtures";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const tabs = [
  "Overview",
  "What's Included",
  "Reviews",
  "Provider Info",
  "FAQs",
] as const;

export function ServiceDetailPage({ service }: { service: MarketplaceService }) {
  const [activeImage, setActiveImage] = useState(service.gallery[0] ?? service.image);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const extraPhotos = Math.max(service.gallery.length - 3, 0);

  const tabLabel = useMemo(() => {
    if (tab === "Reviews") {
      return `Reviews (${service.reviews})`;
    }
    return tab;
  }, [service.reviews, tab]);

  return (
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <Link href="/marketplace" className="hover:text-foreground">
          Browse Services
        </Link>
        <span className="mx-2">›</span>
        <span>{service.category}</span>
        <span className="mx-2">›</span>
        <span className="text-foreground">{service.serviceName}</span>
      </nav>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.7fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="flex gap-2 lg:flex-col">
              {service.gallery.slice(0, 3).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveImage(src)}
                  className={cn(
                    "relative aspect-square w-20 overflow-hidden rounded-2xl border",
                    activeImage === src ? "border-primary" : "border-black/8",
                  )}
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="80px" />
                </button>
              ))}
              {extraPhotos > 0 ? (
                <div className="relative aspect-square w-20 overflow-hidden rounded-2xl border border-black/8">
                  <Image
                    src={service.gallery[3] ?? service.image}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-bold text-white">
                    +{extraPhotos}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="relative min-h-[280px] overflow-hidden rounded-[22px] border border-black/8 lg:min-h-[360px]">
              <Image
                src={activeImage}
                alt={service.serviceName}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 40vw"
                priority
              />
            </div>

            <Surface className="p-5 shadow-none sm:p-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-semibold text-info">
                  {service.category}
                </span>
                <span className="rounded-full bg-[#eef8c8] px-3 py-1 text-xs font-semibold text-[#5f8d11]">
                  {service.tag}
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em]">
                {service.serviceName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" />
                  {service.rating}{" "}
                  <span className="font-normal text-[#68717b]">
                    ({service.reviews} reviews)
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5f8d11]">
                  <BadgeCheck className="size-3.5" /> Verified
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#68717b]">
                {service.description}
              </p>
              <ul className="mt-5 space-y-2">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-[#5f8d11]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Quality Guaranteed", icon: ShieldCheck },
                  { label: "On-Time Service", icon: Clock3 },
                  { label: "Secure Payments", icon: Lock },
                ].map(({ label, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-black/8 px-3 py-3 text-center"
                  >
                    <Icon className="mx-auto size-4 text-[#5f8d11]" />
                    <p className="mt-2 text-[0.68rem] font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </Surface>
          </div>

          <Surface className="overflow-hidden p-0 shadow-none">
            <div className="flex flex-wrap gap-4 border-b border-black/8 px-5">
              {tabs.map((item) => {
                const label =
                  item === "Reviews" ? `Reviews (${service.reviews})` : item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={cn(
                      "border-b-2 py-4 text-sm font-semibold",
                      tab === item
                        ? "border-[#5f8d11] text-foreground"
                        : "border-transparent text-[#68717b]",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(240px,0.8fr)]">
              {tab === "Overview" || tab === "What's Included" ? (
                <>
                  <div>
                    <h2 className="text-lg font-bold">
                      {tab === "Overview" ? "Service Overview" : "What's Included"}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#68717b]">
                      {service.overview}
                    </p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-bold">Ideal For</p>
                        <ul className="mt-2 space-y-1 text-sm text-[#68717b]">
                          {service.idealFor.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-bold">Service Duration</p>
                        <p className="mt-2 inline-flex items-center gap-2 text-sm text-[#68717b]">
                          <Clock3 className="size-4 text-[#5f8d11]" />
                          {service.duration}
                        </p>
                      </div>
                    </div>
                  </div>
                  <aside className="rounded-[22px] bg-[#eef8c8] p-5">
                    <h3 className="font-bold">You&apos;ll Receive</h3>
                    <ul className="mt-4 space-y-3">
                      {service.youReceive.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-[#3d4a2a]">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#5f8d11]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </aside>
                </>
              ) : null}

              {tab === "Reviews" ? (
                <div className="lg:col-span-2">
                  <h2 className="text-lg font-bold">{tabLabel}</h2>
                  <p className="mt-3 text-sm text-[#68717b]">
                    Fixture reviews will connect when the review phase is
                    implemented. Current rating: {service.rating} from{" "}
                    {service.reviews} reviews.
                  </p>
                </div>
              ) : null}

              {tab === "Provider Info" ? (
                <div className="lg:col-span-2">
                  <h2 className="text-lg font-bold">Provider Info</h2>
                  <p className="mt-3 text-sm text-[#68717b]">
                    {service.provider.name} · {service.provider.experience} ·{" "}
                    {service.provider.location}
                  </p>
                </div>
              ) : null}

              {tab === "FAQs" ? (
                <div className="lg:col-span-2 space-y-3">
                  <h2 className="text-lg font-bold">FAQs</h2>
                  <details className="rounded-2xl border border-black/8 px-4 py-3">
                    <summary className="cursor-pointer font-semibold">
                      Do I need to be home during the visit?
                    </summary>
                    <p className="mt-2 text-sm text-[#68717b]">
                      Someone 18+ should be available to provide access and
                      approve any additional work.
                    </p>
                  </details>
                  <details className="rounded-2xl border border-black/8 px-4 py-3">
                    <summary className="cursor-pointer font-semibold">
                      Are parts included in the starting price?
                    </summary>
                    <p className="mt-2 text-sm text-[#68717b]">
                      Starting prices cover labour for the listed scope. Parts
                      are quoted separately when needed.
                    </p>
                  </details>
                </div>
              ) : null}
            </div>
          </Surface>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Book this service</h2>
            <p className="mt-3 text-sm text-[#68717b]">Starting from</p>
            <p className="text-3xl font-bold text-[#5f8d11]">
              KSh {service.priceFrom.toLocaleString()}
            </p>
            <label className="mt-5 block text-xs font-semibold text-[#68717b]">
              Service Location
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-black/8 px-3 text-sm font-medium text-foreground">
                <MapPin className="size-4 text-[#5f8d11]" />
                Nairobi, Kenya
              </span>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[#68717b]">
              Preferred Date
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-black/8 px-3 text-sm font-medium text-foreground">
                <CalendarDays className="size-4" /> Select date
              </span>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[#68717b]">
              Preferred Time
              <span className="mt-2 flex h-11 items-center gap-2 rounded-xl border border-black/8 px-3 text-sm font-medium text-foreground">
                <Clock3 className="size-4" /> Select time
              </span>
            </label>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "mt-5 h-12 w-full justify-between rounded-full pr-1.5 pl-5",
              )}
            >
              Book Now
              <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
                <ArrowRight className="size-4" />
              </span>
            </Link>
            <Link
              href="/messages"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-3 h-11 w-full rounded-full border-black/8",
              )}
            >
              <MessageCircle className="size-4" /> Chat with Provider
            </Link>
            <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#68717b]">
              <Lock className="size-3.5" /> Safe and secure payments
            </p>
          </Surface>

          <Surface className="p-5 shadow-none">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">About the Provider</h2>
              <span className="rounded-full bg-[#eef8c8] px-2 py-0.5 text-[0.62rem] font-semibold text-[#5f8d11]">
                Verified Professional
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Image
                src={service.provider.image}
                alt=""
                width={48}
                height={48}
                className="size-12 rounded-full object-cover"
              />
              <div>
                <p className="font-semibold">{service.provider.name}</p>
                <p className="inline-flex items-center gap-1 text-xs font-semibold">
                  <Star className="size-3 fill-[#ffb81c] text-[#ffb81c]" />
                  {service.provider.rating}
                </p>
                <p className="text-xs text-[#68717b]">
                  {service.provider.experience}
                </p>
                <p className="text-xs text-[#68717b]">
                  {service.provider.location}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#f7f9fa] px-2 py-3">
                <dt className="text-[0.62rem] text-[#68717b]">Jobs</dt>
                <dd className="mt-1 text-sm font-bold">
                  {service.provider.jobsCompleted}
                </dd>
              </div>
              <div className="rounded-2xl bg-[#f7f9fa] px-2 py-3">
                <dt className="text-[0.62rem] text-[#68717b]">On-time</dt>
                <dd className="mt-1 text-sm font-bold">
                  {service.provider.onTimeRate}
                </dd>
              </div>
              <div className="rounded-2xl bg-[#f7f9fa] px-2 py-3">
                <dt className="text-[0.62rem] text-[#68717b]">Rating</dt>
                <dd className="mt-1 text-sm font-bold">
                  {service.provider.rating}
                </dd>
              </div>
            </dl>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
