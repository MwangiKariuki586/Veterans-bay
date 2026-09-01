"use client";

import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  FileText,
  Heart,
  Plus,
  Search,
  ShieldCheck,
  Shield,
  Star,
  Wrench,
  CircleDollarSign,
  ClipboardList,
  Hammer,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useWorkspaceShell } from "@/components/workspace/authenticated-shell";
import { useClientDashboard } from "@/components/workspace/client-dashboard-context";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { cn } from "@/lib/utils";
import type { ClientDashboardData } from "@/modules/dashboards/types";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(minor / 100)
    .replace("KES", "KSh");
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isTomorrow =
    d.getDate() === now.getDate() + 1 &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isTomorrow) {
    return `Tomorrow, ${d.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  }
  return d.toLocaleString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatChartTick(value: string) {
  try {
    const d = new Date(`${value}T00:00:00`);
    return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  } catch {
    return value;
  }
}

export function ClientDashboard() {
  const { workspaceLabel } = useWorkspaceShell();
  const dashboard = useClientDashboard();

  if (!dashboard || (dashboard.loading && !dashboard.data)) {
    return <ClientDashboardSkeleton />;
  }
  if (!dashboard.data) {
    return (
      <StatePanel
        variant="error"
        title="Dashboard unavailable"
        description={dashboard.error ?? "Dashboard data could not be loaded."}
        actionLabel="Try again"
        onAction={dashboard.refresh}
      />
    );
  }

  const data = dashboard.data;
  const displayName = workspaceLabel !== "Workspace" ? workspaceLabel : "Alex";
  const firstName = displayName.split(/\s+/)[0] ?? "there";

  return (
    <div className="space-y-3 type-workspace-body">
      {/* Top header */}
      <section
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="client-greeting"
      >
        <div className="min-w-0">
          <h1
            id="client-greeting"
            className="text-[1.65rem] font-semibold tracking-title text-foreground sm:text-[1.75rem]"
          >
            {greeting()}, {firstName}!
          </h1>
          <p className="text-[0.76] mt-2 type-body text-muted-foreground ">
            Here&apos;s what&apos;s happening with your services today.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
          <Link
            href="/marketplace"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 type-control font-semibold text-primary-foreground shadow-control hover:bg-primary-hover"
          >
            <Search className="size-4" aria-hidden="true" />
            Find service
          </Link>
          <Link
            href="/client/requests/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-secondary px-5 type-control font-semibold text-secondary-foreground shadow-control hover:bg-secondary/90"
          >
            <Plus className="size-4" aria-hidden="true" />
            Post request
          </Link>
        </div>
      </section>

      {/* Top metrics + protection */}
      <section
        className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_300px]"
        aria-label="Service overview"
      >
        <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <WorkspaceMetricCard
            icon={ClipboardList}
            tone="purple"
            label="Open requests"
            value={data.summary.openRequests}
            hint={
              data.summary.openRequests
                ? "Awaiting responses"
                : "No open requests"
            }
            href="/client/requests"
            action="View requests"
          />
          <WorkspaceMetricCard
            icon={FileText}
            tone="blue"
            label="Quotes to review"
            value={data.summary.quotesToReview}
            hint={
              data.summary.quotesToReview
                ? "From professionals"
                : "No new quotes"
            }
            href="/client/quotations"
            action="Review quotes"
          />
          <WorkspaceMetricCard
            icon={CalendarDays}
            tone="green"
            label="Upcoming bookings"
            value={data.summary.upcomingBookings}
            hint={
              data.summary.nextBookingAt
                ? `Next: ${relativeNext(data.summary.nextBookingAt)}`
                : "No upcoming bookings"
            }
            href="/client/bookings"
            action="View bookings"
          />
          <WorkspaceMetricCard
            icon={Wrench}
            tone="orange"
            label="Active jobs"
            value={data.summary.activeJobs}
            hint={data.summary.activeJobs ? "In progress" : "No active jobs"}
            href="/client/bookings?stage=active"
            action="View jobs"
          />
          <WorkspaceMetricCard
            icon={CircleDollarSign}
            tone="yellow"
            label="Outstanding payments"
            value={data.summary.outstandingPaymentsCount}
            hint={
              data.summary.outstandingPaymentsCount
                ? formatMoney(data.summary.outstandingPaymentsMinor)
                : "All paid"
            }
            hintTone={
              data.summary.outstandingPaymentsCount ? "danger" : "muted"
            }
            href="/client/invoices"
            action="Pay now"
          />
        </div>
        <ServiceProtectionCard data={data.serviceProtection} />
      </section>

      {/* Second row: Action centre + Spending + Professionals */}
      <div className="grid items-stretch gap-3 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        <ActionCentreCard items={data.actionCentre} />
        <SpendingCard
          data={data}
          range={dashboard.range}
          onRangeChange={dashboard.setRange}
        />
        <ProfessionalsCard professionals={data.professionals} />
      </div>

      {/* Third row: Upcoming bookings + Protection & payments */}
      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <UpcomingBookingsCard bookings={data.upcomingBookings} />
        <ProtectionPaymentsCard data={data.protectionPayments} />
      </div>

      {/* Fourth row: Recommended */}
      <RecommendedCard items={data.recommended} />
    </div>
  );
}

function relativeNext(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-KE", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function ServiceProtectionCard({
  data,
}: {
  data: ClientDashboardData["serviceProtection"];
}) {
  return (
    <Surface className="flex h-[128px] flex-col overflow-hidden rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-card-label font-semibold">Service protection</h2>
        <Badge
          variant="success"
          className="h-5 min-h-0 rounded-full px-2 py-0 text-[0.62rem] font-semibold"
        >
          {data.status}
        </Badge>
      </div>
      <div className="mt-1 flex flex-1 items-center gap-2.5">
        <div
          className="relative size-[72px] shrink-0"
          role="img"
          aria-label={`Service protection ${data.score} percent`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ value: data.score, fill: "#2f7d18" }]}
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar
                dataKey="value"
                background={{ fill: "#e8efdf" }}
                cornerRadius={10}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <span className="pointer-events-none absolute inset-0 grid place-items-center text-[1.1rem] font-semibold tracking-title">
            {data.score}%
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ul className="grid gap-0.5 text-[0.62rem] leading-3.5">
            <li className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded-full bg-success-soft text-success">
                <ShieldCheck className="size-2.5" />
              </span>
              <span className="truncate font-medium text-foreground">
                {data.activeWarranties} active warranties
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded-full bg-warning-soft text-warning">
                <CircleDollarSign className="size-2.5" />
              </span>
              <span
                className={cn(
                  "truncate",
                  data.paymentsDue > 0
                    ? "font-medium text-danger"
                    : "text-muted-foreground",
                )}
              >
                {data.paymentsDue} payment due
              </span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="grid size-4 place-items-center rounded-full bg-info-soft text-info">
                <Heart className="size-2.5" />
              </span>
              <span className="truncate text-foreground">
                {data.savedProfessionals} saved professionals
              </span>
            </li>
          </ul>
          <Link
            href="/client/warranties"
            className="inline-flex w-fit items-center gap-1 py-0.5 text-[0.62rem] font-semibold text-trust underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            View protection
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </Surface>
  );
}

function ActionCentreCard({
  items,
}: {
  items: ClientDashboardData["actionCentre"];
}) {
  return (
    <Surface className="flex h-full min-h-[236px] flex-col rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="type-section-title">Action centre</h2>
        <Link
          href="/client/bookings?stage=active"
          className="type-caption font-medium text-info hover:underline"
        >
          View all
        </Link>
      </div>
      {items.length ? (
        <ul className="mt-2 grid gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex min-h-[42px] items-center gap-2 rounded-xl border border-black/5 bg-[#fcfcfd] px-2 py-1.5"
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-[8px]",
                  item.tone === "purple"
                    ? "bg-[#f1eaff] text-[#6335e9]"
                    : item.tone === "blue"
                      ? "bg-[#eaf1ff] text-[#245eea]"
                      : item.tone === "green"
                        ? "bg-[#eaf5e5] text-[#2f7d18]"
                        : "bg-[#fff1df] text-[#d9730d]",
                )}
              >
                {item.tone === "purple" ? (
                  <FileText className="size-4" />
                ) : item.tone === "blue" ? (
                  <FileText className="size-4" />
                ) : item.tone === "green" ? (
                  <Wrench className="size-4" />
                ) : (
                  <Shield className="size-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-semibold leading-4">
                  {item.title}
                </span>
                <span className="block truncate text-[0.62rem] leading-3.5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <Link
                href={item.href}
                className="shrink-0 rounded-full border border-black/8 bg-white px-2.5 py-1 text-[0.64rem] font-medium hover:bg-muted"
              >
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 grid place-items-center rounded-xl bg-[#f7f9fa] p-6 text-center">
          <p className="type-card-label">You&apos;re all caught up</p>
          <p className="mt-1 type-caption text-muted-foreground">
            New actions will appear here when you need attention.
          </p>
        </div>
      )}
    </Surface>
  );
}

function SpendingCard({
  data,
  range,
  onRangeChange,
}: {
  data: ClientDashboardData;
  range: "month" | "30-days" | "quarter";
  onRangeChange: (r: "month" | "30-days" | "quarter") => void;
}) {
  const s = data.spending;
  const currentVsPrev =
    s.previousMonthMinor === 0
      ? s.currentMonthMinor > 0
        ? 100
        : 0
      : Math.round(
          ((s.currentMonthMinor - s.previousMonthMinor) /
            s.previousMonthMinor) *
            100,
        );
  const avgVsPrev =
    s.previousAvgServiceCostMinor === 0
      ? s.avgServiceCostMinor > 0
        ? 100
        : 0
      : Math.round(
          ((s.avgServiceCostMinor - s.previousAvgServiceCostMinor) /
            s.previousAvgServiceCostMinor) *
            100,
        );
  return (
    <Surface className="flex h-full min-h-[236px] flex-col rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-section-title">Spending & service activity</h2>
        <select
          value={range}
          onChange={(e) => onRangeChange(e.target.value as typeof range)}
          aria-label="Spending period"
          className="h-8 rounded-full border border-black/8 bg-white px-3 type-caption font-medium"
        >
          <option value="month">This month</option>
          <option value="30-days">Last 30 days</option>
          <option value="quarter">This quarter</option>
        </select>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-3 border-b border-black/5 pb-2.5 sm:grid-cols-4">
        <SpendingMetric
          label="Spend this month"
          value={formatMoney(s.currentMonthMinor)}
          detail={
            currentVsPrev === 0
              ? "No change"
              : `${currentVsPrev > 0 ? "▲" : "▼"} ${Math.abs(currentVsPrev)}% vs last month`
          }
          detailTone={
            currentVsPrev > 0
              ? "success"
              : currentVsPrev < 0
                ? "danger"
                : "muted"
          }
        />
        <SpendingMetric
          label="Outstanding"
          value={formatMoney(s.outstandingMinor)}
          detail={s.outstandingCount ? "Due payment" : "All paid"}
          detailTone={s.outstandingCount ? "danger" : "success"}
        />
        <SpendingMetric
          label="Upcoming booking"
          value={String(s.upcomingBookings)}
          detail={s.nextBookingAt ? "Next: Tomorrow" : "No upcoming"}
        />
        <SpendingMetric
          label="Avg. service cost"
          value={formatMoney(s.avgServiceCostMinor || 0)}
          detail={`${avgVsPrev === 0 ? "—" : `${avgVsPrev > 0 ? "▲" : "▼"} ${Math.abs(avgVsPrev)}%`} vs last month`}
        />
      </div>
      <div
        className="mt-1.5 h-[118px] w-full"
        role="img"
        aria-label="Spending daily trend"
      >
        {s.series.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={s.series}
              margin={{ left: 0, right: 6, top: 8, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#eef2f3"
                vertical={false}
                strokeDasharray="3 3"
              />
              <XAxis
                dataKey="day"
                tickFormatter={formatChartTick}
                tick={{ fontSize: 11, fill: "#68717b" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                width={36}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}K` : String(v / 100)
                }
                tick={{ fontSize: 11, fill: "#68717b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: unknown) =>
                  [formatMoney(Number(value) * 100), "Spend"] as [
                    string,
                    string,
                  ]
                }
                labelFormatter={(label: unknown) =>
                  new Date(`${String(label)}T00:00:00`).toLocaleDateString(
                    "en-KE",
                    { dateStyle: "medium" },
                  )
                }
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2f7d18"
                fill="#eaf5e5"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#2f7d18",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center type-caption text-muted-foreground">
            No spending in range
          </div>
        )}
      </div>
    </Surface>
  );
}

function SpendingMetric({
  label,
  value,
  detail,
  detailTone = "muted",
}: {
  label: string;
  value: string;
  detail?: string;
  detailTone?: "muted" | "danger" | "success";
}) {
  const tone =
    detailTone === "danger"
      ? "text-danger"
      : detailTone === "success"
        ? "text-success"
        : "text-muted-foreground";
  return (
    <div className="min-w-0">
      <p className="type-caption font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate type-card-label font-semibold numeric-tabular">
        {value}
      </p>
      <p className={cn("mt-0.5 truncate text-[0.68rem] font-medium", tone)}>
        {detail}
      </p>
    </div>
  );
}

function ProfessionalsCard({
  professionals,
}: {
  professionals: ClientDashboardData["professionals"];
}) {
  const placeholders: ClientDashboardData["professionals"] = [
    {
      id: "ph1",
      name: "David Mwangi",
      specialty: "Plumbing Specialist",
      rating: 4.8,
      reviewCount: 124,
      imageUrl: null,
      organisationSlug: "david-mwangi",
      href: "/professionals/david-mwangi",
      verifiedJobs: 42,
    },
    {
      id: "ph2",
      name: "Brian Otieno",
      specialty: "Electrician",
      rating: 4.9,
      reviewCount: 98,
      imageUrl: null,
      organisationSlug: "brian-otieno",
      href: "/professionals/brian-otieno",
      verifiedJobs: 35,
    },
    {
      id: "ph3",
      name: "Grace Achieng'",
      specialty: "Cleaning Expert",
      rating: 4.7,
      reviewCount: 76,
      imageUrl: null,
      organisationSlug: "grace-achieng",
      href: "/professionals/grace-achieng",
      verifiedJobs: 28,
    },
  ];
  const list = professionals.length ? professionals : placeholders;
  return (
    <Surface className="flex h-full min-h-[236px] flex-col rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="type-section-title">Your professionals</h2>
        <Link
          href="/client/saved"
          className="type-caption font-medium text-info hover:underline"
        >
          View all
        </Link>
      </div>
      <ul className="mt-2 grid gap-2.5">
        {list.slice(0, 3).map((pro, index) => (
          <li key={pro.id} className="flex items-center gap-3">
            <span className="relative size-9 shrink-0 overflow-hidden rounded-full bg-muted">
              <Image
                src={pro.imageUrl ?? `/images/avatar-${(index % 3) + 1}.png`}
                alt=""
                fill
                sizes="36px"
                className="object-cover"
                unoptimized
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate type-card-label font-semibold">
                {pro.name}
              </span>
              <span className="block truncate type-caption text-muted-foreground">
                {pro.specialty}
              </span>
              <span className="flex items-center gap-1 type-caption">
                <Star className="size-3 fill-[#f5a623] text-[#f5a623]" />
                <span className="font-medium text-foreground">
                  {pro.rating ? pro.rating.toFixed(1) : "—"}
                </span>
                <span className="text-muted-foreground">
                  ({pro.reviewCount})
                </span>
              </span>
            </span>
            <span className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  toast.info("Messages are coming soon", {
                    description: `Chat with ${pro.name} will be available soon.`,
                  })
                }
                className="inline-flex min-h-8 items-center px-1.5 text-[0.64rem] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-trust hover:underline"
              >
                Message
              </button>
              <Link
                href={pro.href}
                className="inline-flex min-h-8 items-center rounded-full bg-primary px-3 text-[0.64rem] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                Book again
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

function UpcomingBookingsCard({
  bookings,
}: {
  bookings: ClientDashboardData["upcomingBookings"];
}) {
  return (
    <Surface className="overflow-hidden rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
      <div className="flex items-center justify-between">
        <h2 className="type-section-title">Upcoming bookings</h2>
        <Link
          href="/client/bookings"
          className="type-caption font-medium text-info hover:underline"
        >
          View all
        </Link>
      </div>
      {bookings.length === 0 ? (
        <div className="mt-2 flex min-h-[112px] flex-col items-center justify-center rounded-xl bg-muted/35 px-4 py-4 text-center">
          <CalendarDays className="size-5 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">No upcoming bookings</p>
          <p className="mt-0.5 type-caption text-muted-foreground">
            Confirmed bookings will appear here.
          </p>
          <Link
            href="/marketplace"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-trust hover:underline"
          >
            Find a service
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
      {bookings.length > 0 ? (
        <div className="mt-2 hidden overflow-x-auto md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/5 text-[0.64rem] font-medium text-muted-foreground">
                <th className="pb-2 pr-3 font-semibold">Booking #</th>
                <th className="pb-2 pr-3 font-semibold">Professional</th>
                <th className="pb-2 pr-3 font-semibold">Service</th>
                <th className="pb-2 pr-3 font-semibold">Date & time</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {bookings.map((b) => (
                <tr
                  key={b.id}
                  className="group text-[0.68rem] leading-4 transition-colors hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap py-1.5 pr-3 font-mono font-medium">
                    <Link
                      href={b.href}
                      className="inline-flex min-h-9 items-center text-trust hover:underline"
                    >
                      {b.bookingNumber}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="relative size-6 shrink-0 overflow-hidden rounded-full bg-muted">
                        {b.professionalImageUrl ? (
                          <Image
                            src={b.professionalImageUrl}
                            alt=""
                            fill
                            sizes="24px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="grid size-full place-items-center text-[0.6rem] font-semibold">
                            {b.professionalName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="truncate font-medium">
                        {b.professionalName}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3 text-muted-foreground">
                    {b.serviceName}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {formatDateTime(b.scheduledAt)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Link
                      href={b.href}
                      aria-label={`View details for ${b.bookingNumber}`}
                      className="inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap px-1 text-xs font-semibold text-trust hover:underline"
                    >
                      View details
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {bookings.length > 0 ? (
        <ul className="mt-3 grid gap-2 md:hidden">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-black/5 bg-[#fcfcfd] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">
                  {b.bookingNumber}
                </span>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-1 font-medium">
                {b.serviceName} · {b.professionalName}
              </p>
              <p className="type-caption text-muted-foreground">
                {formatDateTime(b.scheduledAt)}
              </p>
              <Link
                href={b.href}
                aria-label={`View details for ${b.bookingNumber}`}
                className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-trust hover:underline"
              >
                View details
                <ArrowRight className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Surface>
  );
}

function ProtectionPaymentsCard({
  data,
}: {
  data: ClientDashboardData["protectionPayments"];
}) {
  return (
    <Surface className="grid rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)] sm:grid-cols-[minmax(0,1fr)_174px] sm:gap-x-3">
      <h2 className="type-section-title sm:col-span-2">
        Protection & payments
      </h2>
      <div className="mt-2 grid content-center gap-3">
        <div className="flex items-start gap-2">
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            <CreditCard className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[0.66rem] text-muted-foreground">
              Total spent (YTD)
            </span>
            <span className="mt-0.5 block text-[0.72rem] font-medium numeric-tabular">
              {formatMoney(data.totalSpentYtdMinor)}
            </span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            <CircleDollarSign className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.66rem] text-muted-foreground">
              Outstanding
            </span>
            <span
              className={cn(
                "mt-0.5 block text-[0.7rem] font-semibold numeric-tabular",
                data.outstandingMinor > 0 ? "text-danger" : "text-foreground",
              )}
            >
              {formatMoney(data.outstandingMinor)}
            </span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
            <CreditCard className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.66rem] text-muted-foreground">
              Payment methods
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] font-medium">
              {data.paymentMethodLast4 ? (
                <>
                  <CreditCard className="size-3 text-muted-foreground" />
                  <span className="numeric-tabular">
                    •••• {data.paymentMethodLast4}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">No method saved</span>
              )}
            </span>
          </span>
        </div>
      </div>
      <div className="mt-1.5 flex min-h-[146px] flex-col rounded-[12px] bg-[#0a1931] p-3 text-white">
        <p className="text-[0.66rem] text-white/70">Active warranties</p>
        <p className="mt-2 text-[1.6rem] font-semibold leading-none">
          {data.activeWarranties}
        </p>
        <p className="mt-1 text-[0.66rem] text-white/70">
          {data.activeWarranties > 0
            ? "Your services are protected"
            : "No active coverage"}
        </p>{" "}
        <Link
          href="/client/warranties"
          className="mt-auto inline-flex min-h-8 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-[0.66rem] font-semibold hover:bg-white/10"
        >
          View warranties
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </Surface>
  );
}

function RecommendedCard({
  items,
}: {
  items: ClientDashboardData["recommended"];
}) {
  return (
    <Surface className="overflow-hidden rounded-[18px] p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)] sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-title sm:text-xl">
            Recommended for you
          </h2>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            Popular services from trusted professionals, selected for your home.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-xs font-semibold text-trust hover:underline sm:text-sm"
        >
          View more
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {items.length > 0 ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              aria-label={`View ${item.name}`}
              className="group flex min-w-0 flex-col overflow-hidden rounded-[18px] border border-black/8 bg-white shadow-[0_6px_18px_rgba(15,31,43,0.05)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_24px_rgba(15,31,43,0.09)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <Image
                  src={item.imageUrl ?? recommendationImage(item.category)}
                  alt={`${item.name} by ${item.organisationName}`}
                  fill
                  sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="flex flex-1 flex-col p-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-trust">
                    <RecommendationCategoryIcon category={item.category} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">
                      {item.name}
                    </h3>
                    <span className="mt-0.5 flex items-center gap-1 text-[0.68rem] text-muted-foreground">
                      <span className="truncate">{item.organisationName}</span>
                      <ShieldCheck className="size-3.5 shrink-0 fill-success/15 text-success" />
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-3 border-b border-black/5 pb-3 text-xs">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Star className="size-4 fill-warning text-warning" />
                    {item.rating != null ? item.rating.toFixed(1) : "New"}
                  </span>
                  {item.reviewCount > 0 ? (
                    <span className="text-muted-foreground">
                      ({item.reviewCount})
                    </span>
                  ) : null}
                  <span className="h-4 w-px bg-black/10" aria-hidden="true" />
                  <span className="truncate font-semibold text-muted-foreground">
                    {item.priceMinor != null
                      ? `From ${formatMoney(item.priceMinor)}`
                      : "Custom quote"}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-[0.62rem] font-medium text-trust">
                    <TrendingUp className="size-3.5 shrink-0" />
                    <span className="truncate">Popular with homeowners</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-[0.68rem] font-semibold text-primary-foreground shadow-control transition-colors group-hover:bg-primary-hover"
                  >
                    View service
                    <ArrowRight className="size-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-[16px] bg-muted/35 px-4 text-center">
          <p className="text-sm font-semibold">No recommendations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Explore the marketplace to find trusted home services.
          </p>
          <Link
            href="/marketplace"
            className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-trust hover:underline"
          >
            Explore services
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </Surface>
  );
}

function recommendationImage(category: string | null) {
  const value = category?.toLowerCase() ?? "";
  if (value.includes("plumb")) return "/images/category-plumbing.png";
  if (value.includes("elect")) return "/images/category-electrical.png";
  if (value.includes("clean")) return "/images/category-cleaning.png";
  if (value.includes("paint")) return "/images/category-painting.png";
  return "/images/category-appliance.png";
}

function RecommendationCategoryIcon({ category }: { category: string | null }) {
  const value = category?.toLowerCase() ?? "";
  if (value.includes("elect")) return <Zap className="size-4" />;
  if (value.includes("clean")) return <Sparkles className="size-4" />;
  if (value.includes("furniture") || value.includes("carpentry")) {
    return <Hammer className="size-4" />;
  }
  return <Wrench className="size-4" />;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const variant: "success" | "info" | "warning" | "neutral" =
    normalized === "CONFIRMED"
      ? "success"
      : normalized === "SCHEDULED"
        ? "info"
        : normalized === "IN_PROGRESS"
          ? "warning"
          : normalized === "PENDING_CONFIRMATION" ||
              normalized === "PENDING_DEPOSIT"
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

function ClientDashboardSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-20 rounded-[16px] bg-white" />
      <div className="grid gap-3 xl:grid-cols-[1fr_300px]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[128px] rounded-[16px] bg-white" />
          ))}
        </div>
        <div className="h-[128px] rounded-[16px] bg-white" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
        <div className="h-[236px] rounded-[16px] bg-white" />
        <div className="h-[236px] rounded-[16px] bg-white" />
        <div className="h-[236px] rounded-[16px] bg-white" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_340px]">
        <div className="h-[170px] rounded-[16px] bg-white" />
        <div className="h-[170px] rounded-[16px] bg-white" />
      </div>
      <div className="h-[118px] rounded-[16px] bg-white" />
    </div>
  );
}
