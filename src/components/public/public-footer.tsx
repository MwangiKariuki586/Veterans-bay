import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
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
  { label: "Secure Payments", icon: ShieldCheck },
  { label: "Satisfaction Guaranteed", icon: ShieldCheck },
];

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 overflow-hidden rounded-[22px] border border-black/8 bg-white">
      <div className="grid gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[1.15fr_1.35fr_0.9fr]">
        <div className="max-w-sm">
          <Brand />
          <p className="mt-5 text-sm leading-6 text-[#68717b]">
            Connecting you with verified home service professionals you can trust,
            from start to finish.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {socialLinks.map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="grid size-10 place-items-center rounded-full border border-black/8 text-[#68717b]"
                aria-label={label}
                role="img"
              >
                <Icon className="size-4" aria-hidden="true" />
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {publicFooterColumns.map((column) => (
            <div key={column.title}>
              <h2 className="text-sm font-bold">{column.title}</h2>
              <nav
                className="mt-4 grid gap-3 text-sm text-[#68717b]"
                aria-label={`Footer ${column.title} links`}
              >
                {column.links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="w-fit hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <aside className="rounded-[22px] bg-[#eef8c8] p-6">
          <span className="grid size-11 place-items-center rounded-full bg-white text-[#5f8d11]">
            <Headphones className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-4 text-sm leading-6 text-[#3d4a2a]">
            Need help? Our support team is here for you 24/7 to make things right.
          </p>
          <Link
            href="/contact"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-5 h-12 gap-4 rounded-full border-transparent bg-white py-1 pr-1 pl-5 text-[0.8rem]",
            )}
          >
            Contact Support
            <span className="grid size-10 place-items-center rounded-full bg-secondary text-white">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </aside>
      </div>

      <div className="mx-6 grid gap-4 rounded-[18px] border border-black/6 bg-[#f7f9fa] px-5 py-4 sm:mx-8 sm:grid-cols-2 lg:grid-cols-4">
        {trustItems.map(({ label, icon: Icon }) => (
          <p
            key={label}
            className="flex items-center gap-2.5 text-sm font-medium text-[#3d4a2a]"
          >
            <Icon className="size-4 shrink-0 text-[#5f8d11]" aria-hidden="true" />
            {label}
          </p>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-black/8 px-6 py-5 text-xs text-[#68717b] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>© {year} Veterans Bay. All rights reserved.</p>
        <nav className="flex flex-wrap gap-4" aria-label="Legal">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
