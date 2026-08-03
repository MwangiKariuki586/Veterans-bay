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
  Star,
  Wrench,
  TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { ProfessionalDashboardSkeleton } from "@/components/ui/workspace-skeletons";
import { useWorkspaceShell } from "@/components/workspace/authenticated-shell";
import { useProfessionalDashboard } from "@/components/workspace/professional-dashboard-context";
import { cn } from "@/lib/utils";
import type { ProfessionalDashboardData } from "@/modules/dashboards/types";

type PerformanceKey =
  | "revenue"
  | "jobsCompleted"
  | "enquiries"
  | "quoteConversion";

const performanceTabs: Array<{ key: PerformanceKey; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "jobsCompleted", label: "Jobs Completed" },
  { key: "enquiries", label: "Enquiries" },
  { key: "quoteConversion", label: "Quote Conversion" },
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}

export function ProfessionalDashboard() {
  const { workspaceLabel } = useWorkspaceShell();
  const dashboard = useProfessionalDashboard();
  const [performanceKey, setPerformanceKey] =
    useState<PerformanceKey>("revenue");

  if (!dashboard || (dashboard.loading && !dashboard.data))
    return <ProfessionalDashboardSkeleton />;
  if (!dashboard.data)
    return (
      <StatePanel
        variant="error"
        title="Dashboard unavailable"
        description={dashboard.error ?? "Dashboard data could not be loaded."}
        actionLabel="Try again"
        onAction={dashboard.refresh}
      />
    );

  const data = dashboard.data;
  const summary = data.summary;
  const topMetrics = [
    {
      label: "New enquiries",
      value: summary.newEnquiries,
      detail: summary.urgentEnquiries
        ? `${summary.urgentEnquiries} require a quick response`
        : "All urgent requests handled",
      href: "/professional/enquiries",
      action: "Respond now",
      icon: MessageSquareText,
      tone: "violet" as const,
    },
    {
      label: "Quotes awaiting decision",
      value: summary.quotationsAwaitingDecision,
      detail: summary.expiringQuotations
        ? `${summary.expiringQuotations} expire within 24 hours`
        : "No quotes expiring today",
      href: "/professional/quotations",
      action: "Follow up",
      icon: FileText,
      tone: "blue" as const,
    },
    {
      label: "Jobs today",
      value: summary.jobsToday,
      detail: summary.jobsNeedingCheckIn
        ? `${summary.jobsNeedingCheckIn} need check-in`
        : "Today’s jobs are on track",
      href: "/professional/calendar",
      action: "View schedule",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      label: "Outstanding invoices",
      value:
        summary.outstandingInvoicesMinor === null
          ? "Restricted"
          : formatMoney(summary.outstandingInvoicesMinor),
      detail: summary.overdueInvoices
        ? `${summary.overdueInvoices} overdue`
        : "No overdue invoices",
      href: "/professional/invoices",
      action: "Review invoices",
      icon: CircleDollarSign,
      tone: "orange" as const,
    },
  ];

  return (
    <div className="space-y-3 type-workspace-body">
      <section
        className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"
        aria-labelledby="dashboard-title"
      >
        <div>
          <h1 id="dashboard-title" className="type-workspace-title">
            {greeting()}, {workspaceLabel}!
          </h1>
          <p className="mt-0.5 text-muted-foreground">
            Here’s what needs your attention today.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <QuickAction href="/professional/quotations/new" icon={Plus}>
            Create quote
          </QuickAction>
          <QuickAction href="/professional/availability" icon={CalendarDays}>
            Set availability
          </QuickAction>
          <QuickAction href="/professional/services/new" icon={Wrench}>
            Add service
          </QuickAction>
        </div>
      </section>

      <section
        className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_336px]"
        aria-label="Business summary"
      >
        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((item) => (
            <MetricCard key={item.label} {...item} />
          ))}
        </div>
        <ProfileVisibility data={data.profileVisibility} />
      </section>

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(260px,1fr)_minmax(0,0.55fr)] xl:grid-rows-[auto_auto]">
        <div className="min-w-0 h-full xl:col-start-1 xl:row-start-1">
          <ActionCentreCard groups={data.actionGroups} />
        </div>
        <div className="min-w-0 h-full xl:col-span-2 xl:col-start-2 xl:row-start-1">
          <PerformanceCard
            data={data}
            active={performanceKey}
            onChange={setPerformanceKey}
            range={dashboard.range}
            onRangeChange={dashboard.setRange}
          />
        </div>
        <div className="flex flex-col gap-3 xl:col-start-4 xl:row-span-2 xl:row-start-1">
          <TeamCard team={data.teamToday} />
          <ReputationCard reputation={data.reputation} />
        </div>
        <div className="min-w-0 xl:col-span-2 xl:col-start-1 xl:row-start-2">
          <ScheduleCard
            schedule={data.schedule}
            summary={data.scheduleSummary}
          />
        </div>
        <div className="min-w-0 xl:col-start-3 xl:row-start-2">
          <InsightsCard insights={data.marketplaceInsights} />
        </div>
      </div>

      <p className="type-caption text-muted-foreground">
        Updated{" "}
        {new Date(data.generatedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        . Transactional records remain authoritative.
      </p>
    </div>
  );
}

function ActionCentreCard({
  groups,
}: {
  groups: ProfessionalDashboardData["actionGroups"];
}) {
  return (
    <SectionCard className="flex h-full min-h-0 flex-col">
      <SectionHeading
        title="Action centre"
        href="/professional/enquiries"
        action="View all tasks"
      />
      {groups.length ? (
        <div className="mt-2 min-h-0 flex-1 divide-y divide-black/8 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.id} className="py-2 first:pt-0">
              <p
                className={cn(
                  "type-caption font-medium",
                  group.id === "priority"
                    ? "text-danger"
                    : group.id === "today"
                      ? "text-[#245eea]"
                      : "text-[#5c35c9]",
                )}
              >
                {group.label}
              </p>
              {group.items.slice(0, 2).map((item) => (
                <ActionRow key={item.id} {...item} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <CompactEmpty
          title="You’re all caught up"
          description="New enquiries, expiring quotes, today’s jobs, and overdue invoices will appear here."
        />
      )}
    </SectionCard>
  );
}

function QuickAction({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/8 bg-white px-4 type-control shadow-[0_4px_12px_rgba(14,30,42,0.035)] hover:bg-[#f5f7f8]"
    >
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </Link>
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
  value: number | string;
  detail: string;
  href: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "violet" | "blue" | "green" | "orange";
}) {
  const tones = {
    violet: "bg-[#f1eaff] text-[#6335e9]",
    blue: "bg-[#eaf1ff] text-[#245eea]",
    green: "bg-[#eaf5e5] text-[#347b1e]",
    orange: "bg-[#fff1df] text-[#ef7f00]",
  };
  const detailTone =
    detail.includes("overdue") || detail.includes("require")
      ? "text-danger"
      : detail.includes("expire") || detail.includes("check-in")
        ? "text-[#ef7f00]"
        : "text-muted-foreground";

  return (
    <SectionCard className="flex h-full min-h-[168px] flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg",
            tones[tone],
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="min-h-[2.5rem] type-card-label leading-snug text-[#39434c]">
            {label}
          </p>
          <p className="truncate type-metric font-semibold numeric-tabular text-foreground">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className={cn("mt-0.5 truncate type-caption", detailTone)}>
            {detail}
          </p>
        </div>
      </div>
      <Link
        href={href}
        className="mt-auto flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-black/8 bg-white px-3 type-control hover:bg-[#f5f7f8]"
      >
        {action}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </SectionCard>
  );
}

function ProfileVisibility({
  data,
}: {
  data: ProfessionalDashboardData["profileVisibility"];
}) {
  const headline =
    data.score >= 85 ? `Great job! ${data.description}` : data.description;

  return (
    <SectionCard className="flex h-full flex-col p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="type-section-title">Profile visibility</h2>
        <Badge
          variant={
            data.score >= 85
              ? "success"
              : data.score >= 65
                ? "success"
                : "neutral"
          }
        >
          {data.status}
        </Badge>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 items-center gap-3">
        <div
          className="relative size-24 shrink-0"
          role="img"
          aria-label={`Profile completeness ${data.score} percent`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ value: data.score, fill: "#347b1e" }]}
              innerRadius="82%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                background={{ fill: "#e4ebdf" }}
                cornerRadius={8}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <span className="pointer-events-none absolute inset-[20%] grid place-items-center type-metric font-semibold numeric-tabular leading-none">
            {data.score}%
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="type-workspace-body leading-snug text-[#39434c]">
            {headline}
          </p>
          <Link
            href={data.nextActionHref}
            className="mt-3 inline-flex min-h-9 max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#9fc86a] bg-white py-2 pl-3 pr-4 type-control text-[#347b1e] hover:bg-[#f4f9ef]"
          >
            <ImagePlus className="size-4 shrink-0" aria-hidden="true" />
            {data.nextAction}
          </Link>
        </div>
      </div>
    </SectionCard>
  );
}

function ScheduleCard({
  schedule,
  summary,
}: {
  schedule: ProfessionalDashboardData["schedule"];
  summary: ProfessionalDashboardData["scheduleSummary"];
}) {
  return (
    <SectionCard>
      <SectionHeading
        title="Today’s schedule"
        href="/professional/calendar"
        action="View all bookings"
      />
      {schedule.length ? (
        <>
          <div className="mt-3 hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-2 font-medium">Time</th>
                  <th className="pb-2 pr-2 font-medium">Job</th>
                  <th className="pb-2 pr-2 font-medium">Customer</th>
                  <th className="pb-2 pr-2 font-medium">Location</th>
                  <th className="pb-2 pr-2 font-medium">Status</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/8">
                {schedule.slice(0, 5).map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap py-3 pr-2 align-middle type-caption text-[#39434c]">
                      {item.timeRange}
                    </td>
                    <td className="max-w-[9rem] py-3 pr-2 align-middle">
                      <p className="truncate type-card-label text-foreground">
                        {item.serviceName}
                      </p>
                      <p className="truncate type-caption text-muted-foreground">
                        {item.reference}
                      </p>
                    </td>
                    <td className="max-w-[7rem] py-3 pr-2 align-middle type-caption text-[#39434c]">
                      <span className="line-clamp-2">{item.clientName}</span>
                    </td>
                    <td className="max-w-[8rem] py-3 pr-2 align-middle type-caption text-muted-foreground">
                      <span className="line-clamp-2">{item.location}</span>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-2 align-middle">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap py-3 pl-1 text-right align-middle">
                      <ScheduleAction href={item.href} action={item.action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-2 md:hidden">
            {schedule.map((item) => (
              <Link
                href={item.href}
                key={item.id}
                className="block rounded-lg border border-black/8 p-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="type-card-label">{item.serviceName}</p>
                  <StatusBadge status={item.status} />
                </div>
                <p className="mt-1 type-caption text-muted-foreground">
                  {item.timeRange} · {item.clientName} · {item.location}
                </p>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <CompactEmpty
          title="No jobs scheduled today"
          description="Confirmed work for today will appear here."
        />
      )}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <ScheduleSummaryChip
          icon={CalendarDays}
          label={`Tomorrow: ${summary.tomorrowJobs} ${summary.tomorrowJobs === 1 ? "job" : "jobs"}`}
          tone="neutral"
        />
        <ScheduleSummaryChip
          icon={CalendarDays}
          label={`This week: ${summary.weekJobs} ${summary.weekJobs === 1 ? "job" : "jobs"}`}
          tone="neutral"
        />
        <ScheduleSummaryChip
          icon={TriangleAlert}
          label={`Unassigned: ${summary.unassignedToday}`}
          tone={summary.unassignedToday > 0 ? "warning" : "neutral"}
        />
      </div>
    </SectionCard>
  );
}

function PerformanceCard({
  data,
  active,
  onChange,
  range,
  onRangeChange,
}: {
  data: ProfessionalDashboardData;
  active: PerformanceKey;
  onChange: (key: PerformanceKey) => void;
  range: "month" | "30-days" | "quarter";
  onRangeChange: (range: "month" | "30-days" | "quarter") => void;
}) {
  const summary = data.summary;
  const selected = performanceTabs.find((tab) => tab.key === active)!;
  const series = data.performance.series;
  const priorLabel =
    range === "month"
      ? "last month"
      : range === "30-days"
        ? "prior 30 days"
        : "last quarter";
  const revenueLabel =
    range === "month"
      ? "Revenue this month"
      : range === "30-days"
        ? "Revenue last 30 days"
        : "Revenue this quarter";
  const revenueTrend = trendDetail(
    summary.revenueMinor,
    summary.previousRevenueMinor,
    priorLabel,
  );
  const avgJobTrend = trendDetail(
    summary.averageJobValueMinor,
    summary.previousAverageJobValueMinor,
    priorLabel,
  );
  const payoutDetail = payoutDueDetail(
    summary.expectedPaymentsMinor,
    summary.nextInvoiceDueAt,
  );
  const invoiceDetail =
    summary.outstandingInvoicesMinor === null
      ? { detail: "Financial access restricted", tone: "muted" as const }
      : summary.overdueInvoices > 0
        ? {
            detail: `${summary.overdueInvoices} overdue`,
            tone: "danger" as const,
          }
        : { detail: "No overdue invoices", tone: "success" as const };

  const formatAxisTick = (value: number) => {
    if (active === "quoteConversion") return `${value}%`;
    const display = active === "revenue" ? value / 100 : value;
    if (Math.abs(display) >= 1000) {
      return `${Math.round(display / 1000)}K`;
    }
    return String(Math.round(display));
  };

  return (
    <SectionCard className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-section-title">Business performance</h2>
        <select
          className="h-9 rounded-lg border border-black/8 bg-white px-3 type-control"
          value={range}
          onChange={(event) =>
            onRangeChange(event.target.value as typeof range)
          }
          aria-label="Performance date range"
        >
          <option value="month">This month</option>
          <option value="30-days">Last 30 days</option>
          <option value="quarter">This quarter</option>
        </select>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4 sm:gap-x-0 sm:divide-x sm:divide-black/8">
        <PerformanceMetric
          label={revenueLabel}
          value={
            summary.revenueMinor === null
              ? "Restricted"
              : formatMoney(summary.revenueMinor)
          }
          detail={revenueTrend.detail}
          detailTone={revenueTrend.tone}
        />
        <PerformanceMetric
          label="Outstanding invoices"
          value={
            summary.outstandingInvoicesMinor === null
              ? "Restricted"
              : formatMoney(summary.outstandingInvoicesMinor)
          }
          detail={invoiceDetail.detail}
          detailTone={invoiceDetail.tone}
        />
        <PerformanceMetric
          label="Upcoming payout"
          value={
            summary.expectedPaymentsMinor === null
              ? "Restricted"
              : formatMoney(summary.expectedPaymentsMinor)
          }
          detail={payoutDetail.detail}
          detailTone={payoutDetail.tone}
        />
        <PerformanceMetric
          label="Avg. job value"
          value={
            summary.averageJobValueMinor === null
              ? "Restricted"
              : formatMoney(summary.averageJobValueMinor)
          }
          detail={avgJobTrend.detail}
          detailTone={avgJobTrend.tone}
        />
      </div>

      <div
        className="mt-5 min-h-[180px] flex-1 w-full"
        role="img"
        aria-label={`${selected.label} daily chart for the selected range`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={series}
            margin={{ top: 12, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="#e7ecef" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={(value) =>
                new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "short",
                })
              }
              tick={{ fontSize: 11, fill: "#68717b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={40}
              tickFormatter={formatAxisTick}
              tick={{ fontSize: 11, fill: "#68717b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) =>
                active === "revenue"
                  ? formatMoney(Number(value))
                  : active === "quoteConversion"
                    ? `${value}%`
                    : Number(value).toLocaleString()
              }
              labelFormatter={(value) =>
                new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
                  dateStyle: "medium",
                })
              }
            />
            <Area
              type="monotone"
              dataKey={active}
              stroke="#347b1e"
              fill="#e7f1df"
              strokeWidth={2.5}
              connectNulls
              dot={(props) => {
                const { cx, cy, index } = props;
                if (
                  cx == null ||
                  cy == null ||
                  index !== series.length - 1
                ) {
                  return <g key={`dot-${index}`} />;
                }
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill="#347b1e"
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5, fill: "#347b1e" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Performance measure"
      >
        {performanceTabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "min-h-10 flex-1 basis-[calc(50%-0.25rem)] whitespace-nowrap rounded-full border px-3 type-control sm:basis-0",
              active === tab.key
                ? "border-[#9fc86a] bg-[#edf5e7] text-[#245f14]"
                : "border-black/10 bg-white text-[#27313a] hover:bg-[#f5f7f8]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Link
        href="/professional/invoices"
        className="mt-auto inline-flex min-h-9 w-full items-center justify-center gap-1.5 pt-4 type-control text-[#347b1e] hover:underline"
      >
        View earnings & payouts
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </SectionCard>
  );
}

function TeamCard({ team }: { team: ProfessionalDashboardData["teamToday"] }) {
  return (
    <SectionCard>
      <h2 className="type-section-title">Team today</h2>
      <div className="mt-4 flex items-center gap-2">
        <div className="flex -space-x-1">
          {team.members.slice(0, 4).map((member) => (
            <span
              key={member.id}
              title={`${member.name}: ${member.status.replace("_", " ")}`}
              className="relative grid size-10 overflow-hidden rounded-full border-2 border-white bg-[#eaf1ff] text-[#245eea] place-items-center type-card-label"
            >
              {member.imageUrl ? (
                <Image
                  src={member.imageUrl}
                  alt=""
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              ) : (
                initials(member.name)
              )}
            </span>
          ))}
          {team.members.length > 4 ? (
            <span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#f5f7f8] type-card-label text-[#68717b]">
              +{team.members.length - 4}
            </span>
          ) : null}
        </div>
        <Link
          href="/professional/team"
          aria-label="Add team member"
          className="relative z-10 grid size-10 place-items-center rounded-full border border-dashed border-black/15 bg-white text-[#68717b] hover:bg-[#f5f7f8]"
        >
          <Plus className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-4 space-y-2 pl-2">
        <StatLine value={team.available} label="Available" tone="green" />
        <StatLine value={team.onJobs} label="On jobs" tone="blue" />
        <StatLine value={team.unavailable} label="Unavailable" tone="neutral" />
        {team.conflicts > 0 ? (
          <StatLine
            value={team.conflicts}
            label={team.conflicts === 1 ? "Assignment conflict" : "Assignment conflicts"}
            tone="orange"
          />
        ) : null}
      </div>
      <Link
        href="/professional/team"
        className="mt-5 flex min-h-10 w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 type-control text-foreground hover:bg-[#f5f7f8]"
      >
        Manage team
      </Link>
    </SectionCard>
  );
}

function InsightsCard({
  insights,
}: {
  insights: ProfessionalDashboardData["marketplaceInsights"];
}) {
  const icons = [ChartNoAxesCombined, MapPin, Clock3, TriangleAlert];
  return (
    <SectionCard>
      <SectionHeading
        title="Marketplace insights"
        href="/professional/analytics"
        action="Full report"
      />
      <div className="mt-2 grid gap-y-1">
        {insights.map((insight, index) => (
          <InsightRow
            key={insight.id}
            icon={icons[index] ?? BadgeCheck}
            {...insight}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function ReputationCard({
  reputation,
}: {
  reputation: ProfessionalDashboardData["reputation"];
}) {
  return (
    <SectionCard>
      <SectionHeading
        title="Reputation"
        href="/professional/reviews"
        action="All reviews"
      />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="type-metric-large numeric-tabular">
            {reputation.averageRating
              ? reputation.averageRating.toFixed(1)
              : "—"}
          </p>
          <div
            className="mt-1 flex gap-0.5 text-[#f5ad13]"
            aria-label={`${reputation.averageRating.toFixed(1)} out of 5`}
          >
            {[0, 1, 2, 3, 4].map((item) => (
              <Star
                key={item}
                className={cn(
                  "size-4",
                  item < Math.round(reputation.averageRating) && "fill-current",
                )}
              />
            ))}
          </div>
          <p className="mt-1 type-caption text-muted-foreground">
            {reputation.reviewCount} reviews
          </p>
        </div>
        <div className="border-l border-black/8 pl-3">
          <p className="type-card-label">{reputation.responseRate}%</p>
          <p className="type-caption text-muted-foreground">Response rate</p>
          <p className="mt-2 type-card-label">{reputation.newReviews}</p>
          <p className="type-caption text-muted-foreground">New this period</p>
        </div>
      </div>
      {reputation.topStrengths.length ? (
        <div className="mt-4 border-t border-black/8 pt-3">
          <p className="type-card-label">Top strengths</p>
          <ul className="mt-2 space-y-1 type-caption">
            {reputation.topStrengths.map((strength) => (
              <li key={strength} className="flex gap-2">
                <BadgeCheck className="size-3.5 text-[#347b1e]" />
                {strength}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reputation.latestReview ? (
        <blockquote className="mt-4 rounded-lg bg-[#f6f7f8] p-3 type-caption leading-5 text-[#3d4750]">
          “{reputation.latestReview.feedback}”
          <footer className="mt-1 font-semibold text-foreground">
            — {reputation.latestReview.clientName}
          </footer>
        </blockquote>
      ) : (
        <CompactEmpty
          title="No published reviews yet"
          description="Verified client feedback will appear here."
        />
      )}
    </SectionCard>
  );
}

function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Surface
      className={cn(
        "rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]",
        className,
      )}
    >
      {children}
    </Surface>
  );
}
function SectionHeading({
  title,
  href,
  action,
}: {
  title: string;
  href: string;
  action: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 className="min-w-0 type-section-title">{title}</h2>
      <Link
        href={href}
        className="inline-flex min-h-8 shrink-0 items-center gap-1 whitespace-nowrap type-control text-[#245eea]"
      >
        {action}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
const smallActionClass =
  "inline-flex min-h-8 shrink-0 items-center rounded-md border border-black/8 bg-white px-3 type-control hover:bg-[#f5f7f8]";

function ActionRow({
  title,
  meta,
  href,
  action,
  tone,
}: ProfessionalDashboardData["actionGroups"][number]["items"][number]) {
  const Icon =
    tone === "danger"
      ? MessageSquareText
      : tone === "warning"
        ? Clock3
        : BriefcaseBusiness;
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
    neutral: "bg-[#eef1f3] text-[#58636c]",
  };
  return (
    <div className="flex items-center gap-2.5 py-2">
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          tones[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate type-card-label">{title}</span>
        <span className="block truncate type-caption text-muted-foreground">
          {meta}
        </span>
      </span>
      <Link href={href} className={smallActionClass}>
        {action}
      </Link>
    </div>
  );
}
function PerformanceMetric({
  label,
  value,
  detail,
  detailTone = "muted",
}: {
  label: string;
  value: string;
  detail?: string;
  detailTone?: "muted" | "danger" | "success" | "warning";
}) {
  const tones = {
    muted: "text-muted-foreground",
    danger: "text-danger",
    success: "text-[#2e7d18]",
    warning: "text-[#ef7f00]",
  };

  return (
    <div className="min-w-0 sm:px-3 sm:first:pl-0 sm:last:pr-0">
      <p className="min-h-8 text-[0.625rem] font-medium leading-snug text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-words type-card-label font-semibold numeric-tabular leading-snug text-foreground">
        {value}
      </p>
      <p className={cn("mt-1 min-h-4 type-caption leading-snug", tones[detailTone])}>
        {detail ?? "\u00a0"}
      </p>
    </div>
  );
}

function trendDetail(
  current: number | null,
  previous: number | null,
  priorLabel: string,
): { detail: string; tone: "muted" | "danger" | "success" | "warning" } {
  if (current === null || previous === null) {
    return { detail: "Financial access restricted", tone: "muted" };
  }
  if (previous === 0) {
    if (current === 0) return { detail: `No change vs ${priorLabel}`, tone: "muted" };
    return { detail: `↑ New vs ${priorLabel}`, tone: "success" };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change > 0) return { detail: `↑ ${change}% vs ${priorLabel}`, tone: "success" };
  if (change < 0) return { detail: `↓ ${Math.abs(change)}% vs ${priorLabel}`, tone: "danger" };
  return { detail: `No change vs ${priorLabel}`, tone: "muted" };
}

function payoutDueDetail(
  amountMinor: number | null,
  nextInvoiceDueAt: string | null,
): { detail: string; tone: "muted" | "danger" | "success" | "warning" } {
  if (amountMinor === null) {
    return { detail: "Financial access restricted", tone: "muted" };
  }
  if (amountMinor <= 0) {
    return { detail: "Nothing outstanding", tone: "success" };
  }
  if (!nextInvoiceDueAt) {
    return { detail: "From open invoices", tone: "muted" };
  }
  const due = new Date(nextInvoiceDueAt);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { detail: "Past due", tone: "danger" };
  if (days === 0) return { detail: "Due today", tone: "warning" };
  if (days === 1) return { detail: "Due tomorrow", tone: "warning" };
  return { detail: `Due in ${days} days`, tone: "muted" };
}
function InsightRow({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  tone: "green" | "blue" | "violet" | "orange";
}) {
  const tones = {
    green: "bg-[#eef7e8] text-[#397d22]",
    blue: "bg-[#eaf1ff] text-[#245eea]",
    violet: "bg-[#f1eaff] text-[#6335e9]",
    orange: "bg-[#fff1df] text-[#ef7f00]",
  };
  return (
    <div className="flex gap-3 py-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          tones[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block type-card-label">{title}</span>
        <span className="mt-0.5 block type-caption text-muted-foreground">
          {description}
        </span>
      </span>
    </div>
  );
}
function StatLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "orange" | "neutral";
}) {
  const tones = {
    green: "text-[#2e7d18]",
    blue: "text-[#245eea]",
    orange: "text-[#ef7f00]",
    neutral: "text-[#68717b]",
  };
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn("w-5 type-section-title numeric-tabular", tones[tone])}
      >
        {value}
      </span>
      <span className="text-[0.6875rem] leading-snug text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
function CompactEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-3 rounded-lg bg-[#f7f9fa] p-3">
      <p className="type-card-label">{title}</p>
      <p className="mt-1 type-caption text-muted-foreground">{description}</p>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const variant =
    normalized === "IN_PROGRESS"
      ? "success"
      : normalized === "SCHEDULED" ||
          normalized === "CONFIRMED" ||
          normalized === "PENDING_CONFIRMATION" ||
          normalized === "TEAM_ASSIGNED" ||
          normalized === "EN_ROUTE"
        ? "info"
        : normalized === "ON_HOLD" || normalized === "RETURN_VISIT_REQUIRED"
          ? "warning"
          : "neutral";

  const label =
    normalized === "TEAM_ASSIGNED"
      ? "Assigned"
      : status.toLowerCase().replaceAll("_", " ");

  return (
    <Badge variant={variant} className="whitespace-nowrap capitalize">
      {label}
    </Badge>
  );
}

function ScheduleAction({ href, action }: { href: string; action: string }) {
  const tone =
    action === "Check in"
      ? "border-[#9fc86a] text-[#347b1e] hover:bg-[#f4f9ef]"
      : action === "Assign"
        ? "border-[#9bb6f0] text-[#245eea] hover:bg-[#f3f6ff]"
        : "border-black/10 text-foreground hover:bg-[#f5f7f8]";

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-lg border bg-white px-3 type-control",
        tone,
      )}
    >
      {action}
    </Link>
  );
}

function ScheduleSummaryChip({
  icon: Icon,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "neutral" | "warning";
}) {
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2 rounded-xl px-3 type-caption",
        tone === "warning" ? "bg-[#fff7e8] text-[#7a4b00]" : "bg-[#f5f7f8] text-[#39434c]",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          tone === "warning" ? "text-[#ef7f00]" : "text-[#68717b]",
        )}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(value / 100)
    .replace("KES", "KSh");
}
