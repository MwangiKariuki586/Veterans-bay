"use client";

import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  TriangleAlert,
  User,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

const recentHelpItems = [
  {
    bookingLabel: "BOOKING",
    title: "Plumbing Repair",
    subtitle: "Local Flow Plumbing",
    meta: "Sep 8, 2026 · 10:00 AM",
    badge: "CONFIRMED",
    href: "/client/bookings",
    action: "Get help with this booking",
  },
  {
    warrantyLabel: "WARRANTY CLAIM",
    title: "AC Maintenance",
    subtitle: "FixAir Services",
    status: "Currently under review",
    href: "/client/warranties",
    action: "Get help with this claim",
  },
] as const;

const browseTopics = [
  {
    label: "Bookings & scheduling",
    icon: CalendarDays,
    href: "/help#bookings",
  },
  {
    label: "Requests & quotations",
    icon: ClipboardList,
    href: "/help#requests",
  },
  {
    label: "Professionals & completed jobs",
    icon: User,
    href: "/help#professionals",
  },
  { label: "Payments & invoices", icon: CreditCard, href: "/help#payments" },
  { label: "Warranties & claims", icon: ShieldCheck, href: "/help#warranties" },
  { label: "Account, privacy & security", icon: Lock, href: "/help#account" },
] as const;

const recentCases = [
  {
    title: "Payment not reflected",
    status: "IN PROGRESS",
    time: "2h ago",
    href: "#",
  },
  {
    title: "Professional didn’t arrive",
    status: "OPEN",
    time: "Yesterday",
    href: "#",
  },
  {
    title: "Warranty claim assistance",
    status: "RESOLVED",
    time: "May 12",
    href: "#",
  },
] as const;

const helpfulArticles = [
  { title: "How booking confirmation works", href: "#" },
  { title: "What happens if a professional doesn’t arrive?", href: "#" },
  { title: "How manual payments are recorded", href: "#" },
  { title: "Filing a warranty claim", href: "#" },
] as const;

function CaseBadge({ status }: { status: string }) {
  const tone =
    status === "IN PROGRESS"
      ? "bg-info-soft text-info"
      : status === "OPEN"
        ? "bg-success-soft text-success"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide",
        tone,
      )}
    >
      {status}
    </span>
  );
}

export function SupportPage() {
  const [query, setQuery] = useState("");

  const normalized = query.trim().toLowerCase();
  const filteredTopics = normalized
    ? browseTopics.filter((t) => t.label.toLowerCase().includes(normalized))
    : browseTopics;
  const filteredHelpful = normalized
    ? helpfulArticles.filter((a) => a.title.toLowerCase().includes(normalized))
    : helpfulArticles;

  return (
    <div className="w-full space-y-7 type-workspace-body">
      {/* Header */}
      <section className="space-y-5">
        <div>
          <p className="text-[0.8rem] font-semibold tracking-wide text-[#6d9f16]">
            Support
          </p>
          <h1 className="mt-1.5 type-workspace-title text-foreground">
            How can we help?
          </h1>
          <p className="mt-2 max-w-[560px] text-sm leading-6 text-muted-foreground">
            Find answers, get help with a recent service, or speak with our
            support team.
          </p>
        </div>

        <form
          role="search"
          aria-label="Help center"
          className="relative max-w-[640px]"
          onSubmit={(e) => e.preventDefault()}
        >
          <label htmlFor="support-search" className="sr-only">
            Search help articles
          </label>
          <input
            id="support-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search help articles, payments, bookings, warranties, account help..."
            className="h-[52px] w-full rounded-full border border-black/10 bg-white pl-5 pr-12 text-sm placeholder:text-[#8a94a0] outline-none transition-colors focus:border-black/20 focus-visible:ring-0"
          />
          <button
            type="submit"
            aria-label="Search"
            className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[#071522] transition-colors hover:bg-black/5"
          >
            <Search className="size-[1.05rem]" aria-hidden="true" />
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-y-3 divide-black/10 text-sm sm:divide-x">
          <Link
            href="#chat"
            className="inline-flex items-center gap-2 pr-0 font-semibold text-foreground transition-colors hover:text-[#2f7d18] sm:pr-7"
          >
            <MessageCircle
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Chat with us
          </Link>
          <Link
            href="#report"
            className="inline-flex items-center gap-2 px-0 font-semibold text-foreground transition-colors hover:text-[#2f7d18] sm:px-7"
          >
            <TriangleAlert
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Report an issue
          </Link>
          <Link
            href="#cases"
            className="inline-flex items-center gap-2 pl-0 font-semibold text-foreground transition-colors hover:text-[#2f7d18] sm:pl-7"
          >
            <ClipboardList
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            Track a case
          </Link>
        </div>
      </section>

      {/* Need help with something recent */}
      <section aria-labelledby="recent-help-heading">
        <h2 id="recent-help-heading" className="type-section-title">
          Need help with something recent?
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Booking card */}
          <div className="flex flex-col rounded-[16px] border border-black/[0.06] bg-[#f3f8e9] p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e6f3d9] text-[#2f7d18]">
                <CalendarDays className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-[#eaf6dc] px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-wide text-[#2f7d18]">
                  {recentHelpItems[0].bookingLabel}
                </span>
                <h3 className="mt-1.5 truncate text-[0.95rem] font-semibold leading-tight">
                  {recentHelpItems[0].title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {recentHelpItems[0].subtitle}
                </p>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {recentHelpItems[0].meta}
                  </span>
                  <span className="inline-flex rounded-full bg-white px-2 py-0.5 text-[0.62rem] font-semibold tracking-wide text-[#2f7d18] ring-1 ring-black/5">
                    {recentHelpItems[0].badge}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
              <Link
                href={recentHelpItems[0].href}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:underline"
              >
                {recentHelpItems[0].action}
              </Link>
              <Link
                href={recentHelpItems[0].href}
                aria-label={recentHelpItems[0].action}
                className="grid size-7 place-items-center text-muted-foreground"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Warranty claim card */}
          <div className="flex flex-col rounded-[16px] border border-black/[0.06] bg-[#fef6e9] p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <div className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf1ff] text-[#245eea]">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-[#e8efff] px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-wide text-[#245eea]">
                  {recentHelpItems[1].warrantyLabel}
                </span>
                <h3 className="mt-1.5 truncate text-[0.95rem] font-semibold leading-tight">
                  {recentHelpItems[1].title}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {recentHelpItems[1].subtitle}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="size-2 rounded-full bg-[#a0aec0]"
                    aria-hidden="true"
                  />
                  {recentHelpItems[1].status}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-3">
              <Link
                href={recentHelpItems[1].href}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:underline"
              >
                {recentHelpItems[1].action}
              </Link>
              <Link
                href={recentHelpItems[1].href}
                aria-label={recentHelpItems[1].action}
                className="grid size-7 place-items-center text-muted-foreground"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Browse help by topic */}
      <section aria-labelledby="browse-heading">
        <h2 id="browse-heading" className="type-section-title">
          Browse help by topic
        </h2>
        <div className="mt-4 grid gap-0 rounded-[16px] border border-black/8 bg-white p-1 shadow-[0_4px_16px_rgba(15,31,43,0.04)] sm:p-0 sm:shadow-none lg:grid-cols-2 lg:rounded-none lg:border-0 lg:bg-transparent">
          {/* Mobile: single column divided; Desktop: two columns with vertical divider */}
          <div className="grid gap-0 divide-y divide-black/8 lg:hidden">
            {filteredTopics.length ? (
              filteredTopics.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-black/[0.02]"
                  >
                    <Icon
                      className="size-[1.05rem] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No topics match “{query}”.
              </p>
            )}
          </div>

          {/* Desktop two-column */}
          <div className="hidden lg:contents">
            <div className="divide-y divide-black/8 border-r border-black/8 pr-6">
              {(filteredTopics.slice(0, 3).length
                ? filteredTopics.slice(0, 3)
                : [{ label: "No results", icon: Search, href: "#" } as const]
              ).map((item) => {
                if (item.label === "No results") {
                  return (
                    <p
                      key="no-left"
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      No topics match “{query}”.
                    </p>
                  );
                }
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 py-4 transition-colors hover:text-foreground/80"
                  >
                    <Icon
                      className="size-[1.05rem] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm font-medium">
                      {item.label}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </div>
            <div className="divide-y divide-black/8 pl-6">
              {(filteredTopics.slice(3).length
                ? filteredTopics.slice(3)
                : filteredTopics.length === 0
                  ? []
                  : filteredTopics.slice(3)
              ).map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-3 py-4 transition-colors hover:text-foreground/80"
                  >
                    <Icon
                      className="size-[1.05rem] shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm font-medium">
                      {item.label}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
              {filteredTopics.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No topics match “{query}”.
                </p>
              ) : null}
              {filteredTopics.length > 0 && filteredTopics.length <= 3 ? (
                // balance empty right column when filtered
                <div className="py-4" aria-hidden="true" />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Still need a hand */}
      <section
        aria-labelledby="need-hand-heading"
        className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0a1931] shadow-[0_12px_30px_rgba(15,31,43,0.18)]"
      >
        <div className="flex flex-col lg:flex-row">
          <div className="flex gap-3 p-5 sm:p-6 lg:w-[320px] lg:shrink-0">
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white">
              <Headphones className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="need-hand-heading"
                className="type-section-title text-white"
              >
                Still need a hand?
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-white/70">
                Our support team is here when an answer in the Help Center isn’t
                enough.
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3 sm:divide-x sm:divide-white/15">
              <div className="flex gap-3 sm:px-4 sm:first:pl-0">
                <MessageCircle
                  className="mt-0.5 size-4 shrink-0 text-white/70"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">
                    Chat with support
                  </p>
                  <p className="mt-1 text-xs leading-4 text-white/60">
                    Usually the quickest option.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 sm:px-4">
                <Mail
                  className="mt-0.5 size-4 shrink-0 text-white/70"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Email us</p>
                  <p className="mt-1 text-xs leading-4 text-white/60">
                    For questions that aren’t urgent.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 sm:px-4">
                <Phone
                  className="mt-0.5 size-4 shrink-0 text-white/70"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">Call us</p>
                  <p className="mt-1 text-xs leading-4 text-white/60">
                    Mon – Fri
                    <br />8 AM – 6 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-center pb-6">
          <Link
            href="#chat"
            className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-control transition-colors hover:bg-primary-hover"
          >
            Start a conversation
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Recent cases + Helpful right now */}
      <div
        id="cases"
        className="grid gap-6 lg:grid-cols-[1.15fr_0.95fr] lg:gap-0"
      >
        <section aria-labelledby="cases-heading" className="min-w-0 lg:pr-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="cases-heading" className="type-section-title">
              Your recent support cases
            </h2>
            <Link
              href="#"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#2f7d18] hover:underline"
            >
              View all
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-black/8 border-y border-black/8">
            {recentCases.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {item.title}
                  </span>
                  <CaseBadge status={item.status} />
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {item.time}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="helpful-heading"
          className="min-w-0 lg:border-l lg:border-black/8 lg:pl-6"
        >
          <h2 id="helpful-heading" className="type-section-title">
            Helpful right now
          </h2>
          <ul className="mt-4 divide-y divide-black/8 border-y border-black/8">
            {filteredHelpful.map((item) => (
              <li key={item.title}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-black/[0.02]"
                >
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {item.title}
                  </span>
                  <ArrowRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
            {filteredHelpful.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No articles match “{query}”.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
