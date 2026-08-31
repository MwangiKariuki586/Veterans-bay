"use client";

import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Circle,
  FileCheck2,
  Headphones,
  Play,
  Send,
  Share2,
  ShieldCheck,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { Brand } from "@/components/public/brand";
import { buttonVariants } from "@/components/ui/button";
import { AuthenticatedFooter } from "@/components/workspace/authenticated-footer";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type FooterLink = { href: string; label: string };

export const publicFooterColumns: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<FooterLink>;
}> = [
  {
    title: "Explore",
    links: [
      { href: "/marketplace", label: "Find Services" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/become-a-professional", label: "Become a Professional" },
      { href: "/for-businesses", label: "For Businesses" },
      { href: "/categories", label: "Service Categories" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/help", label: "Help Center" },
      { href: "/safety", label: "Safety & Trust" },
      { href: "/pricing", label: "Pricing & Fees" },
      { href: "/cancellation", label: "Cancellation Policy" },
      { href: "/contact", label: "Contact Us" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About Veterans Bay" },
      { href: "/mission", label: "Our Mission" },
      { href: "/careers", label: "Careers" },
      { href: "/press", label: "Press & Media" },
      { href: "/partners", label: "Partners" },
    ],
  },
];

const socialLinks: ReadonlyArray<{
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  { label: "Facebook", icon: Share2 },
  { label: "Instagram", icon: Camera },
  { label: "X", icon: Send },
  { label: "LinkedIn", icon: BriefcaseBusiness },
  { label: "YouTube", icon: Play },
];

const trustItems: ReadonlyArray<{
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = [
  { label: "Background Verified", icon: BadgeCheck },
  { label: "Rated & Reviewed", icon: Star },
  { label: "Auditable Records", icon: FileCheck2 },
  { label: "Satisfaction Guaranteed", icon: ShieldCheck },
];

export function PublicFooter({ marketplace = false }: { marketplace?: boolean } = {}) {
  const { data: session, isPending } = authClient.useSession();
  const year = new Date().getFullYear();

  if (marketplace && isPending) {
    return (
      <div
        className="mt-6 h-[78px] animate-pulse rounded-[22px] border border-black/8 bg-white sm:mt-10"
        data-testid="marketplace-footer-loading"
        aria-hidden="true"
      />
    );
  }

  if (marketplace && session?.user) {
    return <AuthenticatedFooter className="mt-6 sm:mt-10" />;
  }

  return (
    <footer className={cn("overflow-hidden border border-white/80 bg-white/95", marketplace ? "mt-6 rounded-2xl shadow-none sm:mt-10" : "mt-16 rounded-[28px] shadow-[0_22px_55px_rgba(20,42,57,0.12)]")}>
      <div className={cn("grid gap-10 px-6 pt-10 pb-8 sm:px-8 lg:grid-cols-[1.3fr_1.75fr_0.95fr] lg:gap-12 lg:px-12 lg:pt-10 lg:pb-4", marketplace && "grid-cols-[1fr_auto] items-center gap-4 py-5 sm:grid-cols-1 sm:items-start sm:gap-8 sm:py-8 lg:grid-cols-[1.3fr_1.75fr_0.95fr]")}>
        <div className="max-w-sm">
          <Brand size="large" compact={marketplace} />
          <p className={cn("mt-6 max-w-[360px] text-sm leading-6 text-[#263b57] sm:text-[0.95rem] sm:leading-7", marketplace && "hidden sm:block")}>
            Connecting you with verified home service professionals you can
            trust, from start to finish.
          </p>
          <div className={cn("mt-7 flex flex-wrap gap-3", marketplace && "hidden sm:flex")}>
            {socialLinks.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="grid size-11 place-items-center rounded-full border border-black/8 bg-white text-[#0f2947] shadow-[0_7px_18px_rgba(19,39,54,0.07)]"
                aria-label={label}
                role="img"
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>

        {marketplace ? (
          <div className="flex items-center justify-end gap-2 sm:hidden" aria-label="Social channels">
            {socialLinks.slice(0, 4).map(({ label, icon: Icon }) => (
              <span key={label} className="grid size-9 place-items-center rounded-full border border-black/8 bg-white text-[#0f2947]" aria-label={label} role="img">
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
            ))}
          </div>
        ) : null}

        <div className={cn("grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:gap-x-10", marketplace && "hidden sm:grid")}>
          {publicFooterColumns.map((column) => (
            <div key={column.title}>
              <h2 className="w-fit border-b-[3px] border-[#9ccc36] pb-2 text-[0.95rem] font-medium text-[#0b2545]">
                {column.title}
              </h2>
              <nav
                className="mt-5 grid gap-4 text-sm leading-5 text-[#314660]"
                aria-label={`Footer ${column.title} links`}
              >
                {column.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="w-fit rounded-sm transition-colors hover:text-[#5f8d11] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <aside className={cn("self-start rounded-[24px] border border-[#e8e9c8] bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.68)_0%,rgba(255,255,255,0.28)_38%,rgba(255,255,255,0)_68%),linear-gradient(145deg,#faf9ef_0%,#f5f7dc_56%,#f0f4d2_100%)] p-6 shadow-[0_15px_35px_rgba(91,115,28,0.08)]", marketplace && "hidden sm:block")}>
          <span className="grid size-11 place-items-center rounded-full bg-white text-[#5f8d11] shadow-[0_8px_22px_rgba(60,87,27,0.08)]">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm leading-6 text-[#0b2545] sm:text-[0.95rem]">
            Need help? Our support team is here for you 24/7 to make things
            right.
          </p>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-4 h-12 w-full justify-between gap-4 rounded-full border-white bg-white py-1 pr-1 pl-5 text-[0.82rem] font-semibold text-[#0b2545] shadow-[0_8px_22px_rgba(19,39,54,0.08)] hover:bg-white/90",
            )}
          >
            Contact Support
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-white">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </aside>
      </div>

      <div className={cn("mx-6 grid gap-4 rounded-[18px] bg-[#fbfaf6] px-5 py-5 sm:mx-8 sm:grid-cols-2 lg:mx-10 lg:grid-cols-4 lg:px-7 lg:py-6", marketplace && "hidden sm:grid")}>
        {trustItems.map(({ label, icon: Icon }) => (
          <p
            key={label}
            className="flex items-center gap-3 text-sm font-medium text-[#16304d] lg:justify-center lg:border-l lg:border-[#dedccf] lg:first:border-l-0"
          >
            <Icon
              className="size-6 shrink-0 text-[#5f7f25]"
              aria-hidden="true"
            />
            {label}
          </p>
        ))}
      </div>

      <div className="mx-6 mt-4 flex flex-col gap-3 border-t border-black/8 px-1 py-5 text-xs text-[#4d6076] sm:mx-8 sm:flex-row sm:items-center sm:justify-between lg:mx-10 lg:px-0 lg:py-6">
        <p>© {year} Veterans Bay. All rights reserved.</p>
        <nav className="flex flex-wrap items-center gap-4" aria-label="Legal">
          <Link
            href="/privacy"
            className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Privacy Policy
          </Link>
          <Circle
            className="size-1.5 fill-primary text-primary"
            aria-hidden="true"
          />
          <Link
            href="/terms"
            className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
