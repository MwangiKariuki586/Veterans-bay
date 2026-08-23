"use client";

import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  Droplets,
  PaintRoller,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PublicFooter } from "@/components/public/public-footer";
import { GuestHeader } from "@/components/public/guest-header";
import { StatePanel } from "@/components/ui/state-panel";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { enterPrimaryWorkspace } from "@/lib/workspace-entry";
import type { WorkspaceSummary } from "@/modules/workspace/types";

const popularServices = [
  { label: "Plumbing", icon: Droplets, className: "bg-[#2f70e8]" },
  { label: "Electrical", icon: Bolt, className: "bg-[#ffb91e]" },
  { label: "Cleaning", icon: Sparkles, className: "bg-[#27aaa8]" },
  { label: "Painting", icon: PaintRoller, className: "bg-[#7969e8]" },
  { label: "Appliance Repair", icon: Wrench, className: "bg-[#f36b54]" },
] as const;

const statsAvatars = [
  "/images/avatar-1.png",
  "/images/avatar-2.png",
  "/images/avatar-3.png",
] as const;

const trustBarItems = [
  {
    title: "Background Verified",
    description: "We verify every professional to ensure your safety.",
    icon: Shield,
  },
  {
    title: "Rated & Reviewed",
    description: "Real reviews from real customers you can trust.",
    icon: Star,
  },
  {
    title: "Auditable Records",
    description: "Track bookings, payments and service history.",
    icon: ClipboardList,
  },
  {
    title: "Satisfaction Guaranteed",
    description: "If you're not satisfied, we'll make it right.",
    icon: BadgeCheck,
  },
] as const;

function HeroCard() {
  return (
    <section
      className="relative min-h-[560px] overflow-hidden rounded-[28px] border border-black/8 bg-[#f3f1ed] lg:col-start-1 lg:row-start-1 lg:row-span-3 lg:min-h-0"
      aria-labelledby="hero-title"
    >
      <div className="relative z-10 flex h-full min-h-[560px] w-[74%] flex-col justify-center px-6 py-7 sm:min-h-[520px] sm:w-[64%] sm:px-7 sm:py-8 lg:min-h-0 lg:w-[54%] lg:px-8 lg:py-9">
        <div>
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-black/7 bg-white px-4 py-2 text-[0.78rem] text-[#626b75]">
            <ShieldCheck
              className="size-4 fill-primary text-[#5f8d11]"
              aria-hidden="true"
            />
            Verified Professionals
          </span>
          <h1
            id="hero-title"
            className="mt-7 text-[1.75rem] leading-[1.05] font-medium tracking-title text-[#0f1b2d] min-[360px]:text-[1.95rem] sm:mt-8 sm:text-[3.2rem]"
          >
            Find Trusted
            <br />
            Home Service
            <br />
            Professionals
            <span className="text-primary" aria-hidden="true">
              .
            </span>
          </h1>
          <p className="mt-5 max-w-[22rem] text-[0.75rem] leading-5 text-[#68717b] sm:text-[0.88rem] sm:leading-6">
            Book skilled experts for repairs, maintenance, cleaning, and
            installations backed by reviews and our satisfaction guarantee.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:mt-7 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-4 lg:flex-nowrap">
            <Link
              href="/marketplace"
              className="inline-flex h-12 shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-full bg-primary py-1 pr-1 pl-5 text-[0.75rem] font-semibold text-primary-foreground shadow-[0_8px_22px_rgba(170,212,26,0.2)] sm:h-14 sm:gap-5 sm:pl-7 sm:text-[0.83rem]"
            >
              Find Services
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-white sm:size-11">
                <ArrowRight className="size-[1.15rem]" />
              </span>
            </Link>
          </div>
          <p className="mt-6 flex items-start gap-2 text-[0.7rem] leading-5 text-[#68717b] sm:mt-7 sm:items-center sm:gap-2.5 sm:text-[0.78rem]">
            <ShieldCheck className="size-[1.1rem]" aria-hidden="true" />
            Book, track, and review services with confidence.
          </p>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 right-0 w-[56%] sm:w-[58%] lg:w-[54%]">
        <Image
          src="/images/homepage-hero-professional-room.png"
          alt="Veterans Bay home service professional"
          fill
          priority
          sizes="(min-width: 1024px) 40vw, (min-width: 640px) 58vw, 62vw"
          className="object-cover object-[38%_48%] sm:object-[45%_48%] lg:object-[52%_48%]"
        />
        <div
          className="absolute inset-y-0 left-0 w-[72%] bg-[linear-gradient(90deg,#f3f1ed_0%,rgba(243,241,237,0.96)_30%,rgba(243,241,237,0.62)_68%,rgba(243,241,237,0)_100%)] sm:w-[55%] lg:w-[38%]"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

function PopularServices() {
  return (
    <section
      className="rounded-[28px] border border-black/8 bg-white p-5 lg:col-start-2 lg:row-start-1"
      aria-labelledby="popular-heading"
    >
      <div className="flex items-center justify-between">
        <h2
          id="popular-heading"
          className="text-[1rem] font-medium text-[#0f1b2d]"
        >
          Popular Services
        </h2>
        <Link
          href="/marketplace"
          className="type-caption text-muted-foreground"
        >
          View all
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {popularServices.map(({ label, icon: Icon, className }) => (
          <Link
            key={label}
            href={`/marketplace?category=${encodeURIComponent(label)}`}
            className="grid justify-items-center gap-2 text-center type-caption font-medium"
          >
            <span
              className={cn(
                "grid size-12 place-items-center rounded-full text-white shadow-[0_7px_16px_rgba(17,32,47,0.12)]",
                className,
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="max-w-[62px] leading-[1.15]">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedProfessional() {
  return (
    <Link
      href="/professionals/amina-k-electricals"
      className="relative overflow-hidden rounded-[28px] border border-black/8 bg-[#f4f6f8] p-5 lg:col-start-2 lg:row-start-2"
    >
      <Image
        src="/images/featured-amina-electrician.png"
        alt="Featured professional Amina K. Electricals"
        fill
        sizes="(min-width: 1024px) 15vw, (min-width: 640px) 38vw, 58vw"
        className="object-contain object-[88%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#f4f6f8_0%,rgba(244,246,248,.96)_42%,rgba(244,246,248,0)_72%)]" />
      <div className="relative z-10 max-w-[58%]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/25 px-2.5 py-1.5 type-caption font-semibold text-[#5f8d11]">
          <Star className="size-3 fill-current" /> Featured Pro
        </span>
        <h2 className="mt-4 text-[1.05rem] font-medium text-[#0f1b2d]">
          Amina K. Electricals
        </h2>
        <p className="mt-2 text-[0.74rem] text-muted-foreground">
          Certified Electrician
        </p>
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.74rem] font-semibold">
          <Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" /> 4.9{" "}
          <span className="font-normal text-muted-foreground">
            (210 reviews)
          </span>
        </p>
      </div>
      <span className="absolute right-4 bottom-4 z-10 flex gap-2">
        <span className="grid size-10 place-items-center rounded-full bg-white shadow-[0_8px_22px_rgba(9,22,34,0.12)]">
          <ArrowRight className="size-[1.05rem]" />
        </span>
      </span>
    </Link>
  );
}

function TrustedHomesCard() {
  return (
    <Link
      href="/marketplace"
      className="relative min-h-[180px] overflow-hidden rounded-[28px] border border-black/8 bg-white lg:col-start-2 lg:row-start-3"
    >
      <Image
        src="/images/trusted-homes.png"
        alt="Modern living room served by Veterans Bay professionals"
        fill
        sizes="30vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-3 rounded-full bg-white/95 px-4 py-2.5 type-caption shadow-[0_9px_25px_rgba(11,29,42,0.14)]">
        <span className="grid size-8 place-items-center rounded-full bg-[#2f70e8] text-white">
          <ShieldCheck className="size-4" />
        </span>
        <span>
          <span className="block text-muted-foreground">Trusted Across</span>
          <strong className="text-[0.72rem] text-[#0f1b2d]">
            25,000+ Homes
          </strong>
        </span>
      </div>
    </Link>
  );
}

function ProfessionalGrowthCard() {
  return (
    <section
      className="relative min-h-[234px] overflow-hidden rounded-[32px] border border-[#dbe4eb] bg-[linear-gradient(135deg,#f8fbfc_0%,#edf4f6_58%,#e7f1e8_100%)]"
      aria-labelledby="professional-growth-heading"
    >
      <div
        className="absolute -top-24 -right-16 size-64 rounded-full border-[44px] border-white/55"
        aria-hidden="true"
      />
      <div className="relative z-10 flex min-h-[234px] w-[70%] flex-col justify-center px-5 py-6 min-[420px]:w-[64%] sm:px-6">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[#b7c995]/55 bg-white/80 px-3 py-1.5 text-[0.66rem] font-semibold text-[#527315] shadow-[0_6px_18px_rgba(54,78,38,0.06)] sm:text-[0.72rem]">
          <BriefcaseBusiness className="size-3.5" aria-hidden="true" />
          For Professionals
        </p>
        <h2
          id="professional-growth-heading"
          className="mt-3.5 max-w-[17rem] text-[1.3rem] leading-[1.08] font-medium tracking-title text-[#071a3e] sm:text-[1.55rem]"
        >
          Run every job from one place.
        </h2>
        <p className="mt-2.5 max-w-[19rem] text-[0.68rem] leading-[1.55] text-[#627080] sm:text-[0.76rem]">
          Manage enquiries, quotes, bookings, jobs, and customers in one
          connected workspace.
        </p>
        <Link
          href="/become-a-professional"
          className="mt-4 inline-flex h-11 w-fit items-center gap-3 rounded-full bg-[#0b1c33] py-1 pr-1 pl-4 text-[0.7rem] font-semibold text-white shadow-[0_10px_24px_rgba(11,28,51,0.14)] transition-transform hover:-translate-y-0.5 sm:text-[0.76rem]"
        >
          Grow your business
          <span className="grid size-9 place-items-center rounded-full bg-primary text-[#0b1c33]">
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[45%] min-[420px]:w-[43%]">
        <div
          className="absolute right-4 bottom-2 size-32 rounded-full bg-primary/35 blur-2xl sm:size-40"
          aria-hidden="true"
        />
        <Image
          src="/images/homepage-hero-pro.png"
          alt="Veterans Bay home service professional"
          fill
          sizes="(min-width: 1024px) 20vw, (min-width: 640px) 38vw, 45vw"
          className="object-cover object-[52%_16%] drop-shadow-[0_18px_20px_rgba(15,27,45,0.13)]"
        />
        <div
          className="absolute inset-y-0 left-0 w-[32%] bg-[linear-gradient(90deg,#eff5f5_0%,rgba(239,245,245,0.72)_42%,rgba(239,245,245,0)_100%)]"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

function BookingStats() {
  return (
    <section className="rounded-[28px] border border-black/5 bg-[#eef8e6] p-5">
      <div className="flex -space-x-2">
        {statsAvatars.map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full border-2 border-white object-cover"
          />
        ))}
        <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-white type-caption font-semibold text-trust">
          +1K
        </span>
      </div>
      <p className="mt-5 text-[1.95rem] font-semibold tracking-title text-[#0f1b2d]">
        15k+
      </p>
      <p className="mt-1 text-[0.8rem] font-semibold text-[#0f1b2d]">
        Bookings Completed
      </p>
      <div className="mt-4 flex items-center gap-2 type-caption">
        <ShieldCheck className="size-4 fill-primary text-[#5f8d11]" /> 4.8{" "}
        <span className="text-muted-foreground">| 2,350 reviews</span>
      </div>
      <p className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 type-caption text-[#0f1b2d]">
        {["Verified", "Rated", "Trusted"].map((label) => (
          <span key={label} className="inline-flex items-center gap-1">
            <Check className="size-3.5 text-[#5f8d11]" aria-hidden="true" />
            {label}.
          </span>
        ))}
      </p>
    </section>
  );
}

function FastBooking() {
  return (
    <section className="relative min-h-[234px] overflow-hidden rounded-[32px] border border-black/8 bg-[#eee9e2]">
      <div className="relative z-10 flex min-h-[234px] w-[64%] flex-col justify-center px-5 py-5 pr-0 min-[360px]:w-[62%] sm:w-[60%] sm:px-6 sm:pr-3 lg:py-5">
        <p className="text-[0.64rem] leading-5 text-[#233451] min-[360px]:text-[0.7rem] sm:text-[0.78rem]">
          Why Veterans Bay?
        </p>
        <h2 className="mt-3 text-[1.05rem] font-medium leading-[1.08] tracking-title text-[#071a3e] min-[360px]:text-[1.25rem] sm:mt-3.5 sm:text-[1.45rem] lg:text-[1.35rem]">
          Fast Booking.
          <br />
          Clear Quotes.
        </h2>
        <p className="mt-2.5 text-[0.62rem] leading-[1.5] text-[#667180] min-[360px]:text-[0.68rem] sm:mt-3 sm:text-[0.78rem]">
          Transparent pricing and
          <br />
          real-time availability.
        </p>
        <div
          className="mt-4 flex h-[48px] w-fit items-center rounded-full bg-white px-3 shadow-[0_12px_26px_rgba(31,37,43,0.11)] sm:mt-5 sm:h-[54px] sm:px-4"
          aria-label="Rated 4.8 from 2,350 reviews"
        >
          <span className="inline-flex items-center gap-1.5 text-[0.78rem] font-semibold text-[#071a3e] sm:gap-2 sm:text-[0.86rem]">
            <Star
              className="size-3.5 fill-primary text-primary sm:size-4"
              aria-hidden="true"
            />
            4.8
          </span>
          <span
            className="mx-2 h-6 w-px bg-[#d4d7da] sm:mx-3 sm:h-7"
            aria-hidden="true"
          />
          <span className="max-w-[62px] text-[0.64rem] leading-[1.35] text-[#667180] sm:max-w-[76px] sm:text-[0.72rem]">
            From 2,350 reviews
          </span>
        </div>
      </div>
      <div className="absolute inset-y-0 right-0 w-[42%] overflow-hidden bg-[#eee9e2] min-[360px]:w-[47%] sm:w-[46%]">
        <Image
          src="/images/booking-phone-amina.png"
          alt="Veterans Bay booking preview on a phone"
          fill
          sizes="(min-width: 1024px) 15vw, (min-width: 640px) 45vw, 100vw"
          className="object-cover object-[48%_48%] mix-blend-multiply"
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[34%] bg-[linear-gradient(90deg,#eee9e2_0%,rgba(238,233,226,0.9)_24%,rgba(238,233,226,0.38)_62%,rgba(238,233,226,0)_100%)] sm:w-[30%]"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}

function BottomPanels() {
  return (
    <div className="grid gap-[18px] lg:col-span-2 lg:row-start-4 lg:grid-cols-[1.35fr_0.72fr_1fr]">
      <ProfessionalGrowthCard />
      <BookingStats />
      <FastBooking />
    </div>
  );
}

function TrustBar() {
  return (
    <section
      className="mt-[18px] rounded-[28px] bg-[#0b1c33] px-5 py-7 sm:px-8"
      aria-label="Trust commitments"
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {trustBarItems.map(({ title, description, icon: Icon }) => (
          <div key={title} className="flex gap-3.5">
            <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-[#d4af37]/45 text-[#d4af37]">
              <Icon
                className="size-[1.15rem]"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            </span>
            <div>
              <h3 className="text-[0.92rem] font-semibold text-white">
                {title}
              </h3>
              <p className="mt-1.5 text-[0.78rem] leading-5 text-white/70">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomepageMockup() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || !session) return;

    const controller = new AbortController();

    async function openHome() {
      try {
        const current = await fetch("/api/v1/workspaces/current", {
          credentials: "include",
          signal: controller.signal,
        });
        const body = (await current.json().catch(() => null)) as {
          data?: WorkspaceSummary;
        } | null;

        if (current.ok && body?.data?.href) {
          router.replace(body.data.href);
          return;
        }

        const workspace = await enterPrimaryWorkspace();
        router.replace(workspace.href);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        router.replace("/workspace/select");
      }
    }

    void openHome();

    return () => controller.abort();
  }, [isPending, router, session]);

  if (isPending || session) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff_0%,#eef3f6_66%,#e7edf0_100%)] px-4 py-8">
        <div className="mx-auto max-w-[1340px] p-5 lg:p-[26px]">
          <GuestHeader brandSize="large" trailing="login" />
          <div className="mx-auto mt-16 max-w-2xl rounded-[22px] border border-black/8 bg-white p-8 shadow-[0_20px_50px_rgba(13,30,43,0.08)]">
            <StatePanel
              variant="loading"
              title="Opening your workspace"
              description="Taking you to your dashboard."
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff_0%,#eef3f6_66%,#e7edf0_100%)] px-4 py-8 lg:pt-8 lg:pb-[62px]">
      <div className="mx-auto max-w-[1340px] p-5 lg:p-[26px]">
        <GuestHeader brandSize="large" trailing="login" />
        <div className="mt-5 grid gap-[18px] lg:grid-cols-[2.15fr_1fr] lg:grid-rows-[minmax(168px,auto)_minmax(200px,auto)_minmax(190px,auto)_minmax(230px,auto)]">
          <HeroCard />
          <PopularServices />
          <FeaturedProfessional />
          <TrustedHomesCard />
          <BottomPanels />
        </div>
        <TrustBar />
        <PublicFooter />
      </div>
    </main>
  );
}
