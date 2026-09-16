"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Download,
  Info,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { ProfessionalReportsSkeleton } from "@/components/ui/workspace-skeletons";
import { useProfessionalReports } from "@/components/workspace/professional-reports-context";
import { cn } from "@/lib/utils";
import type { ProfessionalReportsData } from "@/modules/dashboards/types";

type RevenueTab = "revenue" | "paid" | "outstanding";

const revenueTabs: Array<{ key: RevenueTab; label: string }> = [
  { key: "revenue", label: "Revenue" },
  { key: "paid", label: "Payments received" },
  { key: "outstanding", label: "Outstanding" },
];

export function ProfessionalReports() {
  const reports = useProfessionalReports();
  const [activeTab, setActiveTab] = useState<RevenueTab>("revenue");

  if (!reports || (reports.loading && !reports.data))
    return <ProfessionalReportsSkeleton />;
  if (!reports.data)
    return (
      <StatePanel
        variant="error"
        title="Reports unavailable"
        description={reports.error ?? "Reports data could not be loaded."}
        actionLabel="Try again"
        onAction={reports.refresh}
      />
    );

  const data = reports.data;
  const restricted = data.restrictedMetrics.length > 0;

  return (
    <div className="space-y-3 type-workspace-body">
      <ReportsHeader reports={reports} />

      {restricted ? (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 type-caption text-amber-900"
          role="status"
        >
          Financial metrics are restricted for your role. Revenue and average
          job value show as Restricted.
        </div>
      ) : null}

      <ReportsKpiStrip data={data} />

      <div className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <RevenuePerformanceCard
          data={data}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
        <BusinessPipelineCard data={data} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <ServicePerformanceCard data={data} />
        <CustomerTrendsCard data={data} />
        <DemandPatternsCard data={data} />
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <TeamPerformanceCard data={data} />
        <ReputationCard data={data} />
        <BusinessInsightsCard data={data} />
      </div>

      <p className="type-caption text-muted-foreground">
        Updated{" "}
        {new Date(data.generatedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · Transactional records remain authoritative.
      </p>
    </div>
  );
}

function ReportsHeader({
  reports,
}: {
  reports: NonNullable<ReturnType<typeof useProfessionalReports>>;
}) {
  return (
    <section
      className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"
      aria-labelledby="reports-title"
    >
      <div>
        <h1 id="reports-title" className="type-workspace-title">
          Reports
        </h1>
        <p className="mt-0.5 max-w-[560px] text-muted-foreground">
          Understand revenue, demand, service performance and customer trends.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-black/8 bg-white px-3 shadow-[0_4px_12px_rgba(14,30,42,0.035)]">
          <CalendarDays
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <select
            value={reports.range}
            onChange={(event) =>
              reports.setRange(event.target.value as typeof reports.range)
            }
            className="bg-transparent pr-1 text-[0.8rem] font-medium text-foreground outline-none"
            aria-label="Reports date range"
          >
            <option value="30-days">Last 30 days</option>
            <option value="this-week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
          </select>
        </label>

        <Button
          type="button"
          onClick={() => {
            // Placeholder: export would generate CSV/PDF from current range
          }}
          className="rounded-xl"
          aria-label="Export report"
        >
          <Download className="size-4" aria-hidden="true" />
          Export report
        </Button>
      </div>
    </section>
  );
}

function ReportsKpiStrip({ data }: { data: ProfessionalReportsData }) {
  const k = data.kpis;
  const items = [
    {
      label: "Revenue",
      value:
        k.revenueMinor == null ? "Restricted" : formatMoney(k.revenueMinor),
      change: k.revenueChangePercent,
      icon: CircleDollarSign,
      tone: "green" as const,
    },
    {
      label: "Jobs completed",
      value: String(k.jobsCompleted),
      change: k.jobsCompletedChangePercent,
      icon: ClipboardList,
      tone: "blue" as const,
    },
    {
      label: "Quote conversion",
      value: `${k.quoteConversionPercent}%`,
      change: k.quoteConversionChangePercent,
      icon: BarChart3,
      tone: "violet" as const,
    },
    {
      label: "Avg. job value",
      value:
        k.avgJobValueMinor == null
          ? "Restricted"
          : formatMoney(k.avgJobValueMinor),
      change: k.avgJobValueChangePercent,
      icon: TrendingUp,
      tone: "amber" as const,
    },
  ];

  return (
    <section
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Key metrics"
    >
      {items.map((item) => (
        <Surface
          key={item.label}
          className="rounded-xl p-3 shadow-[0_7px_18px_rgba(15,31,43,0.035)]"
        >
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                toneBg(item.tone),
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-card-label leading-3.5 text-[#39434c]">
                {item.label}
              </p>
              <p className="mt-0.5 truncate type-metric font-semibold numeric-tabular text-foreground">
                {item.value}
              </p>
              <p
                className={cn(
                  "mt-0.5 flex items-center gap-1 type-caption",
                  changeTone(item.change),
                )}
              >
                {item.change == null ? (
                  <span className="text-muted-foreground">
                    vs previous period
                  </span>
                ) : (
                  <>
                    {item.change > 0 ? "↑" : item.change < 0 ? "↓" : "→"}{" "}
                    {Math.abs(item.change)}%{" "}
                    <span className="text-muted-foreground">
                      vs previous period
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </Surface>
      ))}
    </section>
  );
}

function RevenuePerformanceCard({
  data,
  activeTab,
  onTabChange,
}: {
  data: ProfessionalReportsData;
  activeTab: RevenueTab;
  onTabChange: (tab: RevenueTab) => void;
}) {
  const rp = data.revenuePerformance;
  const isFinancial = rp.totalRevenueMinor != null;
  const totalLabel = isFinancial
    ? formatMoney(rp.totalRevenueMinor!)
    : "Restricted";
  const change = rp.totalChangePercent;
  const changeLabel =
    change == null
      ? "vs previous period"
      : `${change > 0 ? "↑" : change < 0 ? "↓" : "→"} ${Math.abs(change)}% vs previous period`;
  const changeToneClass =
    change == null
      ? "text-muted-foreground"
      : change > 0
        ? "text-[#2e7d18]"
        : change < 0
          ? "text-danger"
          : "text-muted-foreground";
  const dataKey = activeTab === "revenue" ? "revenue" : activeTab;
  const series = rp.series;

  // Find a representative tooltip example (mid point)
  const hasSeries =
    series.length > 0 &&
    series.some((d) => (d.revenue ?? 0) > 0 || (d.paid ?? 0) > 0);

  return (
    <Surface className="flex min-h-[360px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-section-title">Revenue performance</h2>
          <p className="type-caption text-muted-foreground">
            Total revenue and payment status over time.
          </p>
        </div>
        <div
          className="flex rounded-full border border-black/8 bg-muted p-1"
          role="tablist"
          aria-label="Revenue measure"
        >
          {revenueTabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.72rem] font-medium",
                activeTab === tab.key
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mt-3 min-h-[190px] flex-1"
        role="img"
        aria-label="Revenue daily trend"
      >
        {hasSeries ? (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart
              data={series}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#cfe8b8" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#e7f1df" stopOpacity={0.2} />
                </linearGradient>
              </defs>
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
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                width={36}
                tickFormatter={(value) => {
                  const display = Number(value) / 100;
                  if (Math.abs(display) >= 1000)
                    return `${Math.round(display / 1000)}K`;
                  return String(Math.round(display));
                }}
                tick={{ fontSize: 11, fill: "#68717b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) =>
                  isFinancial ? formatMoney(Number(value)) : "Restricted"
                }
                labelFormatter={(value) =>
                  new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", {
                    dateStyle: "medium",
                  })
                }
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="#2e7d18"
                fill="url(#revFill)"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#2e7d18",
                  stroke: "#fff",
                  strokeWidth: 2,
                }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-[190px] place-items-center rounded-lg bg-[#f7f9fa] type-caption text-muted-foreground">
            No revenue in this period.
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-black/8 pt-3">
        <div>
          <p className="flex items-center gap-1.5 type-caption text-muted-foreground">
            <span
              className="size-2 rounded-full bg-[#2e7d18]"
              aria-hidden="true"
            />{" "}
            Paid
          </p>
          <p className="type-card-label font-semibold numeric-tabular">
            {isFinancial && rp.paidMinor != null
              ? formatMoney(rp.paidMinor)
              : "—"}
          </p>
          <p className="type-caption text-muted-foreground">
            {rp.paidPercent}% of total
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 type-caption text-muted-foreground">
            <span
              className="size-2 rounded-full bg-[#c8e8b0]"
              aria-hidden="true"
            />{" "}
            Outstanding
          </p>
          <p className="type-card-label font-semibold numeric-tabular">
            {isFinancial && rp.outstandingMinor != null
              ? formatMoney(rp.outstandingMinor)
              : "—"}
          </p>
          <p className="type-caption text-muted-foreground">
            {rp.outstandingPercent}% of total
          </p>
        </div>
      </div>
    </Surface>
  );
}

function BusinessPipelineCard({ data }: { data: ProfessionalReportsData }) {
  const p = data.pipeline;
  const steps: Array<{
    label: string;
    value: number;
    change: number | null;
    bg: string;
    text: string;
  }> = [
    {
      label: "Enquiries",
      value: p.enquiries,
      change: p.trends.enquiries,
      bg: "bg-[#EAF1FF]",
      text: "text-[#2B5CE6]",
    },
    {
      label: "Qualified",
      value: p.qualified,
      change: p.trends.qualified,
      bg: "bg-[#F0E9FF]",
      text: "text-[#6B4EFF]",
    },
    {
      label: "Quotes sent",
      value: p.quotesSent,
      change: p.trends.quotesSent,
      bg: "bg-[#EAF6FF]",
      text: "text-[#2B7FFF]",
    },
    {
      label: "Accepted",
      value: p.accepted,
      change: p.trends.accepted,
      bg: "bg-[#DFF5E1]",
      text: "text-[#1A7A2E]",
    },
    {
      label: "Jobs completed",
      value: p.jobsCompleted,
      change: p.trends.jobsCompleted,
      bg: "bg-[#E6F9E6]",
      text: "text-[#1A7A2E]",
    },
  ];
  const acceptanceTrend = p.trends.accepted;
  const acceptanceDown = acceptanceTrend != null && acceptanceTrend < 0;
  const acceptanceUp = acceptanceTrend != null && acceptanceTrend > 0;

  return (
    <Surface className="flex min-h-[360px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="flex items-center gap-1.5 type-section-title">
          Business pipeline
          <span
            className="grid size-4 place-items-center rounded-full border border-black/10 text-[10px] leading-none text-muted-foreground"
            aria-hidden="true"
          >
            <Info className="size-3" />
          </span>
        </h2>
        <p className="type-caption text-muted-foreground">
          From enquiries to completed jobs.
        </p>
      </div>

      <div
        className="mt-4 flex gap-1.5 overflow-hidden"
        aria-label="Pipeline funnel"
      >
        {steps.map((step, idx) => (
          <div
            key={step.label}
            className={cn("flex-1 py-3 text-center", step.bg, step.text)}
            style={{
              clipPath:
                idx === 0
                  ? "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%)"
                  : idx === steps.length - 1
                    ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 8% 50%)"
                    : "polygon(0 0, 92% 0, 100% 50%, 92% 100%, 0 100%, 8% 50%)",
              borderRadius:
                idx === 0
                  ? "10px 0 0 10px"
                  : idx === steps.length - 1
                    ? "0 10px 10px 0"
                    : "0",
            }}
          >
            <p className="text-[1.05rem] font-semibold leading-none tracking-tight numeric-tabular">
              {step.value}
            </p>
            <p className="mt-1 text-[0.62rem] font-medium leading-none opacity-90">
              {step.label}
            </p>
            <p
              className={cn(
                "mt-1.5 inline-flex items-center gap-0.5 text-[0.62rem] font-semibold",
                step.change != null && step.change < 0
                  ? "text-[#DC2626]"
                  : "text-[#16A34A]",
              )}
            >
              {step.change == null
                ? "—"
                : step.change === 0
                  ? "→ 0%"
                  : `${step.change > 0 ? "↑" : "↓"} ${Math.abs(step.change)}%`}
            </p>
          </div>
        ))}
      </div>

      <div
        className="mt-6 flex items-center gap-4 rounded-md bg-[#F3F4F6] px-5 py-4"
        role="status"
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full",
            acceptanceDown
              ? "bg-white text-[#DC2626] ring-1 ring-[#FECACA]"
              : "bg-white text-[#16A34A] ring-1 ring-[#BBF7D0]",
          )}
        >
          <Info className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 text-[0.82rem] leading-5">
          {acceptanceDown ? (
            <>
              <p className="font-medium text-foreground">
                Quote acceptance decreased {Math.abs(acceptanceTrend ?? 0)}%
                compared with the previous period.
              </p>
              <p className="text-muted-foreground">
                Consider reviewing your pricing or response time.
              </p>
            </>
          ) : acceptanceUp ? (
            <>
              <p className="font-medium text-foreground">
                Quote acceptance increased {acceptanceTrend}% compared with the
                previous period.
              </p>
              <p className="text-muted-foreground">
                Keep up the strong follow-up.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">
                Pipeline steady compared with the previous period.
              </p>
              <p className="text-muted-foreground">
                Performance is holding consistent. Maintain quick responses to
                protect conversion.
              </p>
            </>
          )}
        </div>
      </div>
    </Surface>
  );
}

function ServicePerformanceCard({ data }: { data: ProfessionalReportsData }) {
  const [sort, setSort] = useState<"revenue" | "jobs" | "conversion">(
    "revenue",
  );
  const services = useMemo(() => {
    const copy = [...data.servicePerformance];
    if (sort === "jobs") copy.sort((a, b) => b.jobs - a.jobs);
    else if (sort === "conversion")
      copy.sort((a, b) => b.conversionPercent - a.conversionPercent);
    else copy.sort((a, b) => (b.revenueMinor ?? 0) - (a.revenueMinor ?? 0));
    return copy.slice(0, 5);
  }, [data.servicePerformance, sort]);

  const maxRevenue = Math.max(1, ...services.map((s) => s.revenueMinor ?? 0));

  return (
    <Surface className="flex min-h-[420px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="type-section-title">Service performance</h2>
          <p className="type-caption text-muted-foreground">
            Top performing services by revenue.
          </p>
        </div>
        <label className="flex items-center gap-1.5">
          <span className="text-[0.68rem] text-muted-foreground">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-7 rounded-full border border-black/8 bg-white px-2.5 text-[0.7rem] font-medium"
            aria-label="Sort services"
          >
            <option value="revenue">Revenue</option>
            <option value="jobs">Jobs</option>
            <option value="conversion">Conversion</option>
          </select>
        </label>
      </div>

      {services.length === 0 ||
      services.every((s) => s.jobs === 0 && (s.revenueMinor ?? 0) === 0) ? (
        <div className="mt-6 flex-1 rounded-lg bg-[#f7f9fa] p-4 type-caption text-muted-foreground">
          No completed jobs for services in this period.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {services.map((service) => (
            <div key={service.id} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#f5f7f8] text-muted-foreground">
                <Image
                  src={
                    service.imageUrl && !service.imageUrl.includes("/demo/")
                      ? service.imageUrl
                      : serviceImageFallback(service.category)
                  }
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate type-card-label leading-tight">
                  {service.name}
                </p>
                <p className="truncate text-[0.68rem] leading-tight text-muted-foreground">
                  {service.jobs} jobs{" "}
                  {service.revenueMinor != null
                    ? `· ${formatMoney(service.revenueMinor)}`
                    : "· Restricted"}{" "}
                  · {service.conversionPercent}% conversion
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-[#2e7d18]"
                      style={{
                        width: `${Math.max(4, Math.round(((service.revenueMinor ?? 0) / maxRevenue) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[0.68rem] font-medium text-muted-foreground">
                    {service.sharePercent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/professional/services"
        className="mt-auto inline-flex items-center gap-1 pt-4 type-control text-[#245eea] hover:underline"
      >
        View all services <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Surface>
  );
}

function CustomerTrendsCard({ data }: { data: ProfessionalReportsData }) {
  const series = data.customerTrends.series;
  const hasData = series.some((d) => d.newClients > 0 || d.repeatClients > 0);
  const ct = data.customerTrends;

  return (
    <Surface className="flex min-h-[420px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="type-section-title">Customer trends</h2>
        <p className="type-caption text-muted-foreground">
          New vs repeat clients over time.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[0.68rem]">
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-[#1f4b8a]"
            aria-hidden="true"
          />{" "}
          New clients
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-[#8ec0f0]"
            aria-hidden="true"
          />{" "}
          Repeat clients
        </span>
      </div>

      <div
        className="mt-2 h-[150px]"
        role="img"
        aria-label="New vs repeat clients bar chart"
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} barGap={6}>
              <CartesianGrid stroke="#eef2f3" vertical={false} />
              <XAxis
                dataKey="day"
                tickFormatter={(v) =>
                  new Date(`${v}T00:00:00`).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                  })
                }
                tick={{ fontSize: 10, fill: "#68717b" }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                width={24}
                tick={{ fontSize: 10, fill: "#68717b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => String(value)}
                labelFormatter={(v) =>
                  new Date(`${v}T00:00:00`).toLocaleDateString("en-KE", {
                    dateStyle: "medium",
                  })
                }
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              />
              <Bar
                dataKey="newClients"
                fill="#1f4b8a"
                radius={[4, 4, 0, 0]}
                barSize={10}
              />
              <Bar
                dataKey="repeatClients"
                fill="#8ec0f0"
                radius={[4, 4, 0, 0]}
                barSize={10}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-lg bg-[#f7f9fa] type-caption text-muted-foreground">
            No client activity in this period.
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-y border-black/8 py-3">
        <div>
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {ct.newClients}
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            New clients
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[0.62rem] font-semibold",
              trendTone(percentChange(ct.newClients, ct.previousNewClients)),
            )}
          >
            {trendArrow(percentChange(ct.newClients, ct.previousNewClients))} vs
            prev
          </p>
        </div>
        <div>
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {ct.repeatClients}
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            Repeat clients
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[0.62rem] font-semibold",
              trendTone(
                percentChange(ct.repeatClients, ct.previousRepeatClients),
              ),
            )}
          >
            {trendArrow(
              percentChange(ct.repeatClients, ct.previousRepeatClients),
            )}{" "}
            vs prev
          </p>
        </div>
        <div>
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {ct.repeatRatePercent}%
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            Repeat rate
          </p>
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[0.62rem] font-semibold",
              trendTone(
                percentChange(
                  ct.repeatRatePercent,
                  ct.previousRepeatRatePercent,
                ),
              ),
            )}
          >
            {trendArrow(
              percentChange(ct.repeatRatePercent, ct.previousRepeatRatePercent),
            )}{" "}
            vs prev
          </p>
        </div>
      </div>

      <div className="mt-3">
        <p className="type-card-label">Top returning customers</p>
        {data.topReturningCustomers.length === 0 ? (
          <p className="mt-2 type-caption text-muted-foreground">
            No repeat customers in this period.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.topReturningCustomers.map((customer) => (
              <li key={customer.id} className="flex items-center gap-2">
                <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf1ff] text-[0.68rem] font-semibold text-[#245eea]">
                  {customer.avatarUrl ? (
                    <Image
                      src={customer.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="size-8 object-cover"
                    />
                  ) : (
                    customer.initials
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-card-label leading-tight">
                    {customer.name}
                  </span>
                  <span className="block truncate text-[0.68rem] leading-tight text-muted-foreground">
                    {customer.jobs} jobs · {formatMoney(customer.revenueMinor)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/professional/customers"
        className="mt-3 inline-flex items-center gap-1 type-control text-[#245eea] hover:underline"
      >
        View customers <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Surface>
  );
}

function DemandPatternsCard({ data }: { data: ProfessionalReportsData }) {
  const dp = data.demandPatterns;
  const maxWeekday = Math.max(1, ...dp.byWeekday.map((d) => d.percent));

  const morning = dp.byDaypart.morning;
  const afternoon = dp.byDaypart.afternoon;
  const evening = dp.byDaypart.evening;
  const hasWeekday = dp.byWeekday.some((d) => d.percent > 0);
  const hasDaypart = morning + afternoon + evening > 0;

  const pieData = [
    { name: "Morning (6AM – 12PM)", value: morning, color: "#1f6b2e" },
    { name: "Afternoon (12PM – 6PM)", value: afternoon, color: "#5aa146" },
    { name: "Evening (6PM – 10PM)", value: evening, color: "#c8e8b0" },
  ];

  return (
    <Surface className="flex min-h-[420px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="type-section-title">Demand patterns</h2>
        <p className="type-caption text-muted-foreground">
          When clients book and what days are busiest.
        </p>
      </div>

      <div className="mt-3">
        <p className="type-card-label">Busiest days</p>
        {hasWeekday ? (
          <div className="mt-2 space-y-1.5">
            {dp.byWeekday.map((day) => (
              <div
                key={day.day}
                className="grid grid-cols-[28px_1fr_34px] items-center gap-2"
              >
                <span className="text-[0.68rem] text-muted-foreground">
                  {day.shortLabel}
                </span>
                <div className="h-2.5 rounded-full bg-muted">
                  <div
                    className="h-2.5 rounded-full bg-[#2e7d18]"
                    style={{
                      width: `${Math.min(100, Math.max(0, (day.percent / maxWeekday) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-right text-[0.68rem] font-medium text-muted-foreground">
                  {day.percent}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 type-caption text-muted-foreground">
            No bookings in this period.
          </p>
        )}
      </div>

      <div className="mt-4">
        <p className="type-card-label">Peak booking times</p>
        {hasDaypart ? (
          <div className="mt-2 flex items-center gap-4">
            <div
              className="size-[110px] shrink-0"
              role="img"
              aria-label="Booking times by daypart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={34}
                    outerRadius={52}
                    strokeWidth={0}
                    paddingAngle={2}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => `${value}%`}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5 text-[0.68rem]">
              <li className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-[#1f6b2e]"
                  aria-hidden="true"
                />{" "}
                {morning}% Morning (6AM – 12PM)
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-[#5aa146]"
                  aria-hidden="true"
                />{" "}
                {afternoon}% Afternoon (12PM – 6PM)
              </li>
              <li className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full bg-[#c8e8b0]"
                  aria-hidden="true"
                />{" "}
                {evening}% Evening (6PM – 10PM)
              </li>
            </ul>
          </div>
        ) : (
          <p className="mt-2 type-caption text-muted-foreground">
            No time-of-day data in this period.
          </p>
        )}
      </div>
    </Surface>
  );
}

function TeamPerformanceCard({ data }: { data: ProfessionalReportsData }) {
  const team = data.teamPerformance;

  return (
    <Surface className="flex min-h-[320px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="type-section-title">Team performance</h2>
        <p className="type-caption text-muted-foreground">
          Job completion and client satisfaction by team member.
        </p>
      </div>

      {team.length === 0 ? (
        <div className="mt-4 flex-1 rounded-lg bg-[#f7f9fa] p-4 type-caption text-muted-foreground">
          No team members found. Invite your team to track performance.
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-black/8 text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Team member</th>
                <th className="whitespace-nowrap pb-2 pr-2 font-medium">
                  Jobs completed
                </th>
                <th className="whitespace-nowrap pb-2 pr-2 font-medium">
                  Completion rate
                </th>
                <th className="whitespace-nowrap pb-2 pr-2 font-medium">
                  Avg. rating
                </th>
                <th className="whitespace-nowrap pb-2 font-medium">
                  Cancellations
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/8">
              {team.map((member) => (
                <tr key={member.id}>
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-2">
                      <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#eaf1ff] text-[0.62rem] font-semibold text-[#245eea]">
                        {member.imageUrl ? (
                          <Image
                            src={member.imageUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 object-cover"
                          />
                        ) : (
                          member.initials
                        )}
                      </span>
                      <span className="truncate text-[0.78rem] font-medium leading-none">
                        {member.name}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-[0.78rem] numeric-tabular">
                    {member.jobsCompleted}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2 text-[0.78rem] numeric-tabular">
                    {member.completionRate}%
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-2">
                    <span className="inline-flex items-center gap-1 text-[0.78rem] numeric-tabular">
                      <Star
                        className="size-3 fill-[#f5ad13] text-[#f5ad13]"
                        aria-hidden="true"
                      />{" "}
                      {member.avgRating ? member.avgRating.toFixed(1) : "—"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2.5 text-[0.78rem] numeric-tabular">
                    {member.cancellationsPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href="/professional/team"
        className="mt-auto inline-flex items-center gap-1 pt-4 type-control text-[#245eea] hover:underline"
      >
        View team <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Surface>
  );
}

function ReputationCard({ data }: { data: ProfessionalReportsData }) {
  const rep = data.reputation;
  const maxCount = Math.max(1, ...rep.distribution.map((d) => d.count));
  const delta =
    rep.previousAverageRating != null
      ? Math.round((rep.averageRating - rep.previousAverageRating) * 10) / 10
      : null;

  return (
    <Surface className="flex min-h-[320px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="type-section-title">Reputation</h2>
        <p className="type-caption text-muted-foreground">
          Your public review performance.
        </p>
      </div>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 type-metric-large leading-none numeric-tabular">
            {rep.averageRating ? rep.averageRating.toFixed(1) : "—"}{" "}
            <Star
              className="size-5 fill-[#f5ad13] text-[#f5ad13]"
              aria-hidden="true"
            />
          </p>
          <p className="mt-1 type-caption text-muted-foreground">
            {rep.reviewCount} verified reviews
          </p>
        </div>
        {delta != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold",
              delta >= 0
                ? "bg-success-soft text-success"
                : "bg-danger-soft text-danger",
            )}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}{" "}
            <span className="font-normal text-muted-foreground">
              vs previous
            </span>
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-1.5">
        {rep.distribution.map((row) => (
          <div
            key={row.stars}
            className="grid grid-cols-[34px_1fr_24px] items-center gap-2"
          >
            <span className="flex items-center gap-1 text-[0.68rem] text-muted-foreground">
              {row.stars}{" "}
              <Star className="size-3 text-[#f5ad13]" aria-hidden="true" />
            </span>
            <div className="h-2.5 rounded-full bg-muted">
              <div
                className="h-2.5 rounded-full bg-[#2e7d18]"
                style={{
                  width: `${Math.round((row.count / maxCount) * 100)}%`,
                }}
              />
            </div>
            <span className="text-right text-[0.68rem] numeric-tabular text-muted-foreground">
              {row.count}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-black/8 pt-3 text-center">
        <div>
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {rep.responseRate}%
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            Response rate
          </p>
        </div>
        <div className="border-l border-black/8">
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {rep.completionRate}%
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            Completion rate
          </p>
        </div>
        <div className="border-l border-black/8">
          <p className="type-card-label font-semibold leading-none numeric-tabular">
            {rep.repeatClientRate}%
          </p>
          <p className="text-[0.62rem] leading-tight text-muted-foreground">
            Repeat client rate
          </p>
        </div>
      </div>

      <Link
        href="/professional/reviews"
        className="mt-auto inline-flex items-center gap-1 pt-4 type-control text-[#245eea] hover:underline"
      >
        View public profile{" "}
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </Surface>
  );
}

function BusinessInsightsCard({ data }: { data: ProfessionalReportsData }) {
  return (
    <Surface className="flex min-h-[320px] flex-col rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]">
      <div>
        <h2 className="type-section-title">Business insights</h2>
        <p className="type-caption text-muted-foreground">
          Key takeaways from your performance.
        </p>
      </div>

      <ul className="mt-3 space-y-3">
        {data.businessInsights.map((insight) => (
          <li key={insight.id} className="flex gap-2.5">
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full",
                insight.tone === "success"
                  ? "bg-success-soft text-success"
                  : insight.tone === "danger"
                    ? "bg-danger-soft text-danger"
                    : insight.tone === "warning"
                      ? "bg-warning-soft text-warning"
                      : "bg-info-soft text-info",
              )}
            >
              {insight.tone === "success" ? (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              ) : insight.tone === "danger" ? (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              ) : insight.tone === "warning" ? (
                <Info className="size-3.5" aria-hidden="true" />
              ) : (
                <Users className="size-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.78rem] font-medium leading-tight">
                {insight.title}
              </span>
              <span className="block text-[0.68rem] leading-tight text-muted-foreground">
                {insight.description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

// helpers
function toneBg(tone: "green" | "blue" | "violet" | "amber") {
  if (tone === "green") return "bg-[#eaf5e5] text-[#2e7d18]";
  if (tone === "blue") return "bg-[#eaf1ff] text-[#245eea]";
  if (tone === "violet") return "bg-[#f1eaff] text-[#6335e9]";
  return "bg-[#fff6e0] text-[#7a4b00]";
}
function changeTone(change: number | null) {
  if (change == null) return "text-muted-foreground";
  if (change > 0) return "text-[#2e7d18]";
  if (change < 0) return "text-danger";
  return "text-muted-foreground";
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
function serviceImageFallback(category: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("drain") || c.includes("plumb"))
    return "/images/category-plumbing.png";
  if (c.includes("bath")) return "/images/cat-plumbing.png";
  if (c.includes("water") || c.includes("heater") || c.includes("appliance"))
    return "/images/category-appliance.png";
  if (c.includes("electric")) return "/images/category-electrical.png";
  if (c.includes("clean")) return "/images/category-cleaning.png";
  if (c.includes("paint")) return "/images/category-painting.png";
  return "/images/category-plumbing.png";
}
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
function trendTone(change: number | null) {
  if (change == null) return "text-muted-foreground";
  if (change > 0) return "text-[#2e7d18]";
  if (change < 0) return "text-danger";
  return "text-muted-foreground";
}
function trendArrow(change: number | null) {
  if (change == null) return "→";
  if (change > 0) return `↑ ${change}%`;
  if (change < 0) return `↓ ${Math.abs(change)}%`;
  return "→ 0%";
}
