"use client";

import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  Clock3,
  FileText,
  ImagePlus,
  MapPin,
  MessageSquareText,
  Plus,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useWorkspaceShell } from "@/components/workspace/authenticated-shell";
import { cn } from "@/lib/utils";
import type { ManagedProfessionalProfile } from "@/modules/professional-services/types";
import type { TeamOverview } from "@/modules/professional-team/types";
import type { ReviewItem } from "@/modules/reviews/types";
import type { CalendarEntry } from "@/modules/bookings/types";

interface DashboardData {
  metrics: Record<string, number | null>;
  restrictedMetrics?: string[];
  recent: Array<{
    id: string;
    title: string;
    status?: string;
    updatedAt: string;
    actionTarget: string;
  }>;
  generatedAt: string;
}

interface ProfessionalDashboardState {
  dashboard: DashboardData;
  profile: ManagedProfessionalProfile | null;
  team: TeamOverview | null;
  reviews: ReviewItem[];
  schedule: CalendarEntry[];
}

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    signal,
  });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!response.ok || body?.data === undefined) {
    throw new Error(body?.error?.message ?? "Dashboard data could not be loaded.");
  }
  return body.data;
}

function dashboardPath() {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);
  return `/api/v1/professional/dashboard?${new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
  })}`;
}

function calendarPath() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return `/api/v1/professional/calendar?${new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  })}`;
}

function profileStrength(profile: ManagedProfessionalProfile | null) {
  if (!profile) return null;
  const checks = [
    profile.businessName,
    profile.description,
    profile.primaryCategory,
    profile.operatingLocation,
    profile.serviceAreas.length > 0,
    profile.availabilitySummary,
    profile.logoUrl,
    profile.portfolio.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function ProfessionalDashboard() {
  const { workspaceLabel } = useWorkspaceShell();
  const [state, setState] = useState<ProfessionalDashboardState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const [dashboardResult, profileResult, teamResult, reviewsResult, scheduleResult] =
          await Promise.allSettled([
          request<DashboardData>(dashboardPath(), controller.signal),
          request<ManagedProfessionalProfile>(
            "/api/v1/professional/profile",
            controller.signal,
          ),
          request<TeamOverview>("/api/v1/professional/team", controller.signal),
          request<ReviewItem[]>("/api/v1/professional/reviews", controller.signal),
          request<CalendarEntry[]>(calendarPath(), controller.signal),
        ]);

        if (dashboardResult.status === "rejected") {
          throw dashboardResult.reason;
        }

        setState({
          dashboard: dashboardResult.value,
          profile: profileResult.status === "fulfilled" ? profileResult.value : null,
          team: teamResult.status === "fulfilled" ? teamResult.value : null,
          reviews: reviewsResult.status === "fulfilled" ? reviewsResult.value : [],
          schedule: scheduleResult.status === "fulfilled" ? scheduleResult.value : [],
        });
        setError(null);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(
          cause instanceof Error ? cause.message : "Dashboard data could not be loaded.",
        );
      }
    })();
    return () => controller.abort();
  }, [reload]);

  if (!state && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Preparing your business dashboard"
        description="Bringing together current enquiries, work, team, profile, and reputation data."
      />
    );
  }

  if (!state) {
    return (
      <StatePanel
        variant="error"
        title="Dashboard unavailable"
        description={error ?? "Dashboard data could not be loaded."}
        actionLabel="Try again"
        onAction={() => setReload((value) => value + 1)}
      />
    );
  }

  const { dashboard, profile, team, reviews } = state;
  const schedule = state.schedule ?? [];
  const metrics = dashboard.metrics;
  const businessName = profile?.businessName || workspaceLabel;
  const strength = profileStrength(profile);
  const activeMembers = team?.members.filter((member) => member.status === "active") ?? [];
  const publishedReviews = reviews.filter((review) => review.status === "PUBLISHED");
  const averageRating = publishedReviews.length
    ? publishedReviews.reduce((total, review) => total + review.overallRating, 0) /
      publishedReviews.length
    : (metrics.average_rating ?? 0);
  const recentReview = publishedReviews[0] ?? null;

  const topMetrics = [
    {
      key: "new_enquiries",
      label: "New enquiries",
      value: number(metrics.new_enquiries),
      detail: number(metrics.new_enquiries) ? "Waiting for a response" : "All caught up",
      href: "/professional/enquiries",
      action: "Respond now",
      icon: MessageSquareText,
      tone: "violet",
    },
    {
      key: "quotations_awaiting_response",
      label: "Quotes awaiting decision",
      value: number(metrics.quotations_awaiting_response),
      detail: number(metrics.quotations_awaiting_response)
        ? "Follow up with clients"
        : "No pending decisions",
      href: "/professional/quotations",
      action: "Follow up",
      icon: FileText,
      tone: "blue",
    },
    {
      key: "jobs_in_progress",
      label: "Jobs in progress",
      value: number(metrics.jobs_in_progress),
      detail: `${number(metrics.upcoming_bookings)} upcoming booking${number(metrics.upcoming_bookings) === 1 ? "" : "s"}`,
      href: "/professional/jobs",
      action: "View jobs",
      icon: BriefcaseBusiness,
      tone: "green",
    },
    {
      key: "outstanding_payments",
      label: "Outstanding invoices",
      value: number(metrics.outstanding_payments),
      detail: number(metrics.outstanding_payments) ? "Needs follow-up" : "Nothing overdue",
      href: "/professional/invoices",
      action: "Review invoices",
      icon: CircleDollarSign,
      tone: "orange",
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-[-0.04em] sm:text-[1.75rem]">
            {greeting()}, {businessName}!
            <Sparkles className="size-6 text-[#f6b51b]" aria-hidden="true" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here&apos;s what needs your attention today.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link href="/professional/quotations/new" className={quickActionClass}>
            <Plus className="size-4 text-[#4f961e]" /> Create quote
          </Link>
          <Link href="/professional/availability" className={quickActionClass}>
            <CalendarDays className="size-4" /> Set availability
          </Link>
          <Link href="/professional/services/new" className={quickActionClass}>
            <Wrench className="size-4" /> Add service
          </Link>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map(({ key, ...item }) => (
            <MetricCard key={key} {...item} />
          ))}
        </div>
        <SectionCard className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Profile visibility</h2>
            <Badge variant={strength === 100 ? "success" : "neutral"}>
              {strength === 100 ? "Excellent" : "Improve"}
            </Badge>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="grid size-20 shrink-0 place-items-center rounded-full border-[8px] border-[#dfeecf] text-xl font-bold text-[#287313]">
              {strength === null ? "—" : `${strength}%`}
            </div>
            <div className="min-w-0 text-xs leading-5 text-muted-foreground">
              <p>
                {strength === 100
                  ? "Your marketplace profile is complete."
                  : "Complete your profile to improve client confidence."}
              </p>
              <Link
                href="/professional/profile"
                className="mt-2 inline-flex items-center gap-1 font-bold text-[#2e7d18]"
              >
                <ImagePlus className="size-3.5" /> Improve profile
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1.1fr_0.62fr] xl:items-start">
        <div className="space-y-4">
          <SectionCard>
            <SectionHeading
              title="Action centre"
              href="/professional/enquiries"
              action="View all tasks"
            />
            <div className="mt-3 space-y-1">
              <ActionRow
                icon={MessageSquareText}
                title={`${number(metrics.new_enquiries)} new enquiries need review`}
                meta="Respond quickly to improve conversion."
                href="/professional/enquiries"
                action="Respond"
                tone="danger"
              />
              <ActionRow
                icon={Clock3}
                title={`${number(metrics.quotations_awaiting_response)} quotes await a client decision`}
                meta="Follow up while the request is still active."
                href="/professional/quotations"
                action="Follow up"
                tone="warning"
              />
              <ActionRow
                icon={CalendarDays}
                title={`${number(metrics.upcoming_bookings)} upcoming bookings`}
                meta="Review availability and team assignments."
                href="/professional/bookings"
                action="Schedule"
                tone="info"
              />
              <ActionRow
                icon={CircleDollarSign}
                title={`${number(metrics.outstanding_payments)} outstanding invoices`}
                meta="Keep payment records and balances current."
                href="/professional/invoices"
                action="Review"
                tone="neutral"
              />
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeading
              title="Today’s schedule"
              href="/professional/calendar"
              action="View calendar"
            />
            {schedule.length ? (
              <ul className="mt-3 divide-y divide-black/8">
                {schedule.slice(0, 4).map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#eef3ff] text-[#285ee8]">
                      <BriefcaseBusiness className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{item.serviceName}</span>
                      <span className="mt-1 block text-[0.68rem] text-muted-foreground">
                        {formatSchedule(item.startsAt)} · {item.clientName} · {item.assignmentName}
                      </span>
                    </span>
                    <Link href={`/professional/bookings/${item.id}`} className={smallActionClass}>
                      {item.status === "CONFIRMED" ? "View" : item.status}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <CompactEmpty
                title="No bookings scheduled today"
                description="Confirmed work for today will appear here."
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard>
            <SectionHeading
              title="Business performance"
              href="/professional/analytics"
              action="Full report"
            />
            <div className="mt-5 grid grid-cols-2 gap-y-5 sm:grid-cols-4">
              <PerformanceMetric
                label="Revenue this month"
                value={
                  dashboard.restrictedMetrics?.includes("revenue_minor")
                    ? "Restricted"
                    : formatMoney(number(metrics.revenue_minor))
                }
                hint="Recorded payments"
              />
              <PerformanceMetric
                label="Completed jobs"
                value={number(metrics.completed_jobs).toLocaleString()}
                hint="This month"
              />
              <PerformanceMetric
                label="Completion rate"
                value={`${number(metrics.completion_rate)}%`}
                hint="Current month"
              />
              <PerformanceMetric
                label="Recent reviews"
                value={number(metrics.recent_reviews).toLocaleString()}
                hint="This month"
              />
            </div>
            <div className="mt-6 rounded-2xl bg-[#f5f8f2] p-4">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold">Job completion</span>
                <span className="font-bold text-[#2e7d18]">
                  {number(metrics.completion_rate)}%
                </span>
              </div>
              <progress
                className="mt-3 h-2 w-full overflow-hidden rounded-full accent-[#3d8b20]"
                max={100}
                value={number(metrics.completion_rate)}
              />
              <p className="mt-3 text-[0.68rem] leading-5 text-muted-foreground">
                Based on jobs created and completed during the current reporting period.
              </p>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeading
              title="Marketplace insights"
              href="/professional/analytics"
              action="View report"
            />
            <div className="mt-3 space-y-1">
              <InsightRow
                icon={ChartNoAxesCombined}
                title={`${number(metrics.new_enquiries)} current marketplace enquiries`}
                description="Keep response times short to convert more requests."
                tone="green"
              />
              <InsightRow
                icon={MapPin}
                title={profile?.operatingLocation || "Set your operating location"}
                description={
                  profile?.serviceAreas.length
                    ? `Serving ${profile.serviceAreas.join(", ")}`
                    : "Add service areas so nearby clients can find you."
                }
                tone="blue"
              />
              <InsightRow
                icon={BadgeCheck}
                title={`${number(metrics.completion_rate)}% job completion rate`}
                description="Reliable delivery strengthens marketplace trust."
                tone="violet"
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard>
            <SectionHeading
              title="Team today"
              href="/professional/team"
              action="Manage team"
            />
            <div className="mt-5 flex -space-x-2">
              {activeMembers.slice(0, 4).map((member) => (
                <span
                  key={member.id}
                  className="relative grid size-10 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#eef3ff] text-[#285ee8]"
                  title={member.name}
                >
                  <Image
                    src="/images/header-avatar.png"
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
              ))}
              <span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#f5f7f8] text-xs font-bold">
                {activeMembers.length || "—"}
              </span>
            </div>
            <div className="mt-5 space-y-3 text-xs">
              <StatLine label="Active members" value={activeMembers.length} tone="green" />
              <StatLine
                label="Pending invitations"
                value={team?.invitations.filter((item) => item.status === "pending").length ?? 0}
                tone="blue"
              />
              <StatLine
                label="Jobs in progress"
                value={number(metrics.jobs_in_progress)}
                tone="orange"
              />
            </div>
            <Link
              href="/professional/team"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5 w-full")}
            >
              Manage assignments
            </Link>
          </SectionCard>

          <SectionCard>
            <SectionHeading
              title="Reputation"
              href="/professional/reviews"
              action="All reviews"
            />
            <div className="mt-4 flex items-end gap-3">
              <span className="text-4xl font-bold tracking-[-0.06em]">
                {averageRating ? averageRating.toFixed(1) : "—"}
              </span>
              <span className="pb-1 text-xs text-muted-foreground">
                {publishedReviews.length} review{publishedReviews.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-2 flex gap-0.5 text-[#f5ad13]" aria-label={`${averageRating.toFixed(1)} out of 5`}>
              {[0, 1, 2, 3, 4].map((item) => (
                <Star
                  key={item}
                  className={cn("size-4", item < Math.round(averageRating) && "fill-current")}
                />
              ))}
            </div>
            <div className="mt-5 border-t border-black/8 pt-4">
              {recentReview ? (
                <blockquote className="rounded-2xl bg-[#f6f7f8] p-4 text-xs leading-5 text-[#3d4750]">
                  “{recentReview.feedback}”
                  <footer className="mt-2 font-bold text-foreground">
                    — {recentReview.clientName}
                  </footer>
                </blockquote>
              ) : (
                <CompactEmpty
                  title="No published reviews yet"
                  description="Verified client feedback will appear here."
                />
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <p className="text-[0.68rem] text-muted-foreground">
        Updated {new Date(dashboard.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Transactional records remain authoritative.
      </p>
    </div>
  );
}

const quickActionClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-black/8 bg-white px-4 text-xs font-bold shadow-[0_5px_14px_rgba(14,30,42,0.04)] transition-colors hover:bg-[#f5f7f8]";
const smallActionClass =
  "inline-flex min-h-8 shrink-0 items-center rounded-lg border border-black/8 bg-white px-3 text-[0.68rem] font-bold hover:bg-[#f5f7f8]";

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Surface className={cn("rounded-[16px] p-4 shadow-[0_8px_22px_rgba(15,31,43,0.04)]", className)}>
      {children}
    </Surface>
  );
}

function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold">{title}</h2>
      <Link href={href} className="inline-flex items-center gap-1 text-[0.68rem] font-bold text-[#285ee8]">
        {action} <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
  action,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "violet" | "blue" | "green" | "orange";
}) {
  const toneClass = {
    violet: "bg-[#f1eaff] text-[#6335e9]",
    blue: "bg-[#eaf1ff] text-[#245eea]",
    green: "bg-[#eaf5e5] text-[#347b1e]",
    orange: "bg-[#fff1df] text-[#ef7f00]",
  }[tone];
  return (
    <SectionCard className="flex min-h-36 flex-col p-3.5">
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", toneClass)}>
          <Icon className="size-[1.1rem]" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.7rem] font-bold text-[#39434c]">{label}</p>
          <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
          <p className="mt-1 truncate text-[0.65rem] text-muted-foreground">{detail}</p>
        </div>
      </div>
      <Link href={href} className={cn(smallActionClass, "mt-auto w-full justify-between") }>
        {action} <ArrowRight className="size-3.5" />
      </Link>
    </SectionCard>
  );
}

function ActionRow({ icon: Icon, title, meta, href, action, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; meta: string; href: string; action: string; tone: "danger" | "warning" | "info" | "neutral" }) {
  const toneClass = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    neutral: "bg-[#eef1f3] text-[#58636c]",
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5 hover:bg-[#f8fafb]">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneClass)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold">{title}</span>
        <span className="mt-1 block truncate text-[0.66rem] text-muted-foreground">{meta}</span>
      </span>
      <Link href={href} className={smallActionClass}>{action}</Link>
    </div>
  );
}

function PerformanceMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-l border-black/8 pl-3 first:border-l-0 first:pl-0">
      <p className="text-[0.65rem] text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-base font-bold">{value}</p>
      <p className="mt-1 text-[0.62rem] text-[#397b24]">{hint}</p>
    </div>
  );
}

function InsightRow({ icon: Icon, title, description, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; tone: "green" | "blue" | "violet" }) {
  const toneClass = {
    green: "bg-[#eef7e8] text-[#397d22]",
    blue: "bg-[#eaf1ff] text-[#245eea]",
    violet: "bg-[#f1eaff] text-[#6335e9]",
  }[tone];
  return (
    <div className="flex gap-3 rounded-xl py-2.5">
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", toneClass)}><Icon className="size-4" /></span>
      <span className="min-w-0"><span className="block text-xs font-bold">{title}</span><span className="mt-1 block text-[0.66rem] leading-4 text-muted-foreground">{description}</span></span>
    </div>
  );
}

function StatLine({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "orange" }) {
  const toneClass = { green: "text-[#2e7d18]", blue: "text-[#245eea]", orange: "text-[#ef7f00]" }[tone];
  return <div className="flex items-center gap-3"><span className={cn("w-5 text-base font-bold", toneClass)}>{value}</span><span className="text-muted-foreground">{label}</span></div>;
}

function CompactEmpty({ title, description }: { title: string; description: string }) {
  return <div className="mt-4 rounded-2xl bg-[#f7f9fa] p-4"><p className="text-xs font-bold">{title}</p><p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground">{description}</p></div>;
}

function number(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value / 100);
}

function formatSchedule(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
