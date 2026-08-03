"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bolt,
  BriefcaseBusiness,
  Camera,
  Droplets,
  PaintRoller,
  Send,
  Share2,
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
import type { WorkspaceSummary } from "@/modules/workspace/types";

const popularServices = [
  { label: "Plumbing", icon: Droplets, className: "bg-[#2f70e8]" },
  { label: "Electrical", icon: Bolt, className: "bg-[#ffb91e]" },
  { label: "Cleaning", icon: Sparkles, className: "bg-[#27aaa8]" },
  { label: "Painting", icon: PaintRoller, className: "bg-[#7969e8]" },
  { label: "Appliance Repair", icon: Wrench, className: "bg-[#f36b54]" },
] as const;

const categoryCards = [
  { label: "Plumbing", image: "/images/category-plumbing.png" },
  { label: "Electrical", image: "/images/category-electrical.png" },
  { label: "Cleaning", image: "/images/category-cleaning.png" },
  { label: "Painting", image: "/images/category-painting.png" },
] as const;

function HeroCard() {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-black/8 bg-white lg:col-start-1 lg:row-start-1 lg:row-span-3" aria-labelledby="hero-title">
      <Image src="/images/homepage-hero.png" alt="Veterans Bay home service professional with trade tools" fill priority sizes="(max-width: 1024px) 100vw, 68vw" className="object-cover object-center" />
      <div className="relative z-10 flex h-full min-h-[650px] w-full flex-col items-start bg-white/72 px-7 py-8 sm:min-h-[570px] lg:min-h-0 lg:w-[54%] lg:bg-transparent">
        <span className="inline-flex items-center gap-2 rounded-full border border-black/7 bg-white/92 px-4 py-2 text-[0.78rem] text-[#626b75]">
          <ShieldCheck className="size-4 fill-primary text-[#5f8d11]" aria-hidden="true" />
          Verified Professionals
        </span>
        <h1 id="hero-title" className="mt-9 text-[2.65rem] leading-[1.04] font-bold tracking-[-0.055em] sm:text-[3.55rem]">Find Trusted<br />Home Service<br />Professionals.</h1>
        <p className="mt-6 max-w-[22rem] text-[0.88rem] leading-6 text-[#68717b]">Hire verified experts for repairs, maintenance, cleaning, and installations—backed by quality work and real reviews.</p>
        <div className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-5">
          <Link href="/marketplace" className="inline-flex h-14 items-center gap-5 rounded-full bg-primary py-1 pr-1 pl-7 text-[0.83rem] font-semibold text-primary-foreground shadow-[0_8px_22px_rgba(170,212,26,0.2)]">Find Services <span className="grid size-11 place-items-center rounded-full bg-secondary text-white"><ArrowRight className="size-[1.15rem]" /></span></Link>
          <Link href="/become-a-professional" className="inline-flex h-14 items-center rounded-full border border-black/8 bg-white px-7 text-[0.83rem] font-semibold">Become a Professional</Link>
        </div>
        <p className="mt-7 flex items-center gap-2.5 text-[0.78rem] text-[#68717b]"><ShieldCheck className="size-[1.1rem]" /> Book, track, and review services with confidence.</p>
        <div className="mt-5 flex items-center gap-2.5 text-[0.72rem] text-[#68717b]">
          <span className="mr-1">Follow us on:</span>
          {[Share2, Camera, Send, BriefcaseBusiness].map((Icon, index) => <span key={index} className="grid size-8 place-items-center rounded-full border border-black/8 bg-white"><Icon className="size-3.5" /></span>)}
        </div>
      </div>
      <div className="absolute right-6 bottom-7 z-20 flex overflow-hidden rounded-full border border-black/8 bg-white lg:right-auto lg:left-[74%]">
        <button type="button" className="grid size-10 place-items-center" aria-label="Previous professional"><ArrowLeft className="size-4" /></button>
        <button type="button" className="grid size-10 place-items-center" aria-label="Next professional"><ArrowRight className="size-4" /></button>
      </div>
    </section>
  );
}

function PopularServices() {
  return (
    <section className="rounded-[22px] border border-black/8 bg-white p-5 lg:col-start-2 lg:row-start-1" aria-labelledby="popular-heading">
      <div className="flex items-center justify-between"><h2 id="popular-heading" className="text-[1rem] font-semibold">Popular Services</h2><Link href="/marketplace" className="text-[0.68rem] text-muted-foreground">View all</Link></div>
      <div className="mt-5 grid grid-cols-5 gap-2">
        {popularServices.map(({ label, icon: Icon, className }) => (
          <Link key={label} href={`/marketplace?category=${encodeURIComponent(label)}`} className="grid justify-items-center gap-2 text-center text-[0.65rem] font-medium">
            <span className={cn("grid size-12 place-items-center rounded-full text-white shadow-[0_7px_16px_rgba(17,32,47,0.12)]", className)}><Icon className="size-5" /></span>
            <span className="max-w-[62px] leading-[1.15]">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeaturedProfessional() {
  return (
    <Link href="/marketplace" className="relative overflow-hidden rounded-[22px] border border-black/8 bg-white p-5 lg:col-start-2 lg:row-start-2">
      <Image src="/images/featured-professional.png" alt="Featured plumbing professional" fill sizes="30vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,white_0%,rgba(255,255,255,.97)_48%,rgba(255,255,255,0)_75%)]" />
      <div className="relative z-10 max-w-[58%]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold text-[#718f13]"><Star className="size-3 fill-current" /> Featured Pro</span>
        <h2 className="mt-4 text-[1.05rem] font-semibold">Mark D. Plumbing</h2>
        <p className="mt-2 text-[0.74rem] text-muted-foreground">24+ years of experience</p>
        <p className="mt-2.5 flex items-center gap-1.5 text-[0.74rem] font-semibold"><Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" /> 4.9 <span className="font-normal text-muted-foreground">(320 reviews)</span></p>
      </div>
      <span className="absolute right-4 bottom-4 z-10 grid size-11 place-items-center rounded-full bg-white shadow-[0_8px_22px_rgba(9,22,34,0.12)]"><ArrowRight className="size-[1.1rem]" /></span>
    </Link>
  );
}

function HomeExperts() {
  return (
    <Link href="/marketplace" className="group relative overflow-hidden rounded-[22px] border border-black/8 bg-white lg:col-start-2 lg:row-start-3 lg:row-span-2">
      <div className="relative h-[66%]"><Image src="/images/home-repair-interior.png" alt="Bright living room after home repairs" fill sizes="30vw" className="object-cover" /></div>
      <div className="absolute top-[48%] left-4 flex items-center gap-3 rounded-full bg-white/94 px-4 py-2.5 text-[0.64rem] shadow-[0_9px_25px_rgba(11,29,42,0.14)]"><span className="grid size-8 place-items-center rounded-full bg-[#2f70e8] text-white"><ShieldCheck className="size-4" /></span><span><span className="block text-muted-foreground">Trusted Across</span><strong className="text-[0.72rem]">25,000+ Homes</strong></span></div>
      <div className="p-5"><h2 className="text-[1.05rem] font-semibold">Home Repair Experts</h2><p className="mt-2 max-w-[16rem] text-[0.8rem] leading-5 text-muted-foreground">From quick fixes to full upgrades,<br />we’ve got you covered.</p><span className="absolute right-5 bottom-5 grid size-12 place-items-center rounded-full bg-primary"><ArrowRight className="size-[1.15rem] transition-transform group-hover:translate-x-1" /></span></div>
    </Link>
  );
}

function CategoryPanel() {
  return (
    <section className="rounded-[22px] border border-black/8 bg-white p-4.5" aria-labelledby="categories-heading">
      <div className="flex items-center justify-between"><h2 id="categories-heading" className="text-[0.95rem] font-semibold">Popular Categories</h2><Link href="/marketplace" className="text-[0.66rem] text-muted-foreground">View all</Link></div>
      <div className="mt-5 grid grid-cols-4 gap-3">
        {categoryCards.map((category) => <Link key={category.label} href={`/marketplace?category=${category.label.toLowerCase()}`} className="text-[0.67rem] font-medium"><Image src={category.image} alt="" width={130} height={105} className="aspect-[0.9] w-full rounded-[15px] object-cover" /><span className="mt-2.5 block text-center">{category.label}</span></Link>)}
      </div>
    </section>
  );
}

function BookingStats() {
  return (
    <section className="rounded-[22px] border border-black/5 bg-[#e9f5f5] p-5">
      <div className="flex -space-x-2">{[0, 1, 2, 3].map((item) => <Image key={item} src="/images/header-avatar.png" alt="" width={32} height={32} className="size-8 rounded-full border-2 border-white object-cover" />)}<span className="grid size-8 place-items-center rounded-full border-2 border-white bg-white text-[0.63rem] font-semibold text-trust">+1K</span></div>
      <p className="mt-5 text-[1.95rem] font-semibold tracking-[-0.04em] text-[#165365]">15k+</p>
      <p className="mt-1 text-[0.8rem] font-semibold">Bookings Completed</p>
      <div className="mt-4 flex items-center gap-2 text-[0.68rem]"><ShieldCheck className="size-4 fill-primary text-[#5f8d11]" /> 4.8 <span className="text-muted-foreground">| 2,350 reviews</span></div>
      <p className="mt-3.5 flex items-center gap-2 text-[0.67rem]"><ShieldCheck className="size-4 text-trust" /> Verified. Rated. Trusted.</p>
    </section>
  );
}

function FastBooking() {
  return (
    <section className="relative overflow-hidden rounded-[22px] border border-black/8 bg-white p-5">
      <Image src="/images/booking-phone.png" alt="Veterans Bay booking preview on a phone" fill sizes="25vw" className="object-cover object-center" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.98)_0%,rgba(255,255,255,.93)_48%,rgba(255,255,255,0)_73%)]" />
      <div className="relative z-10 max-w-[55%]"><p className="text-[0.6rem] text-muted-foreground">Why Veterans Bay?</p><h2 className="mt-5 text-[1.12rem] font-semibold leading-tight">Fast Booking,<br />Clear Quotes.</h2><p className="mt-2.5 text-[0.62rem] leading-4 text-muted-foreground">Transparent pricing and<br />real-time availability.</p><p className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[0.72rem] font-semibold shadow-[0_7px_18px_rgba(10,24,35,0.1)]"><Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" /> 4.9</p></div>
    </section>
  );
}

function BottomPanels() {
  return (
    <div className="grid gap-[18px] lg:col-start-1 lg:row-start-4 lg:grid-cols-[1.28fr_0.69fr_0.96fr]">
      <CategoryPanel />
      <BookingStats />
      <FastBooking />
    </div>
  );
}

export function HomepageMockup() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending || !session) return;

    const controller = new AbortController();
    void fetch("/api/v1/workspaces/current", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: WorkspaceSummary;
        } | null;

        if (!response.ok || !body?.data?.href) {
          router.replace("/workspace/select");
          return;
        }

        router.replace(body.data.href);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        router.replace("/workspace/select");
      });

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
              description="Taking you to the homepage for your selected role."
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
        <div className="mt-5 grid gap-[18px] lg:grid-cols-[2.15fr_1fr] lg:grid-rows-[176px_207px_161px_234px]">
          <HeroCard />
          <PopularServices />
          <FeaturedProfessional />
          <HomeExperts />
          <BottomPanels />
        </div>
        <PublicFooter />
      </div>
    </main>
  );
}
