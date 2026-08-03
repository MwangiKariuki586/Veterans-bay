"use client";

import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, ChartNoAxesCombined,
  CircleDollarSign, Clock3, FileText, ImagePlus, MapPin, MessageSquareText,
  Plus, Star, Wrench, TriangleAlert,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useWorkspaceShell } from "@/components/workspace/authenticated-shell";
import { useProfessionalDashboard } from "@/components/workspace/professional-dashboard-context";
import { cn } from "@/lib/utils";
import type { ProfessionalDashboardData } from "@/modules/dashboards/types";

type PerformanceKey = "revenue" | "jobsCompleted" | "enquiries" | "quoteConversion";

const performanceTabs: Array<{ key: PerformanceKey; label: string }> = [
  { key: "revenue", label: "Revenue" }, { key: "jobsCompleted", label: "Jobs completed" },
  { key: "enquiries", label: "Enquiries" }, { key: "quoteConversion", label: "Quote conversion" },
];

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function ProfessionalDashboard() {
  const { workspaceLabel } = useWorkspaceShell();
  const dashboard = useProfessionalDashboard();
  const [performanceKey, setPerformanceKey] = useState<PerformanceKey>("revenue");

  if (!dashboard || (dashboard.loading && !dashboard.data)) return <StatePanel variant="loading" title="Preparing your business dashboard" description="Bringing together current enquiries, work, team, profile, and reputation data." />;
  if (!dashboard.data) return <StatePanel variant="error" title="Dashboard unavailable" description={dashboard.error ?? "Dashboard data could not be loaded."} actionLabel="Try again" onAction={dashboard.refresh} />;

  const data = dashboard.data;
  const summary = data.summary;
  const topMetrics = [
    { label: "New enquiries", value: summary.newEnquiries, detail: summary.urgentEnquiries ? `${summary.urgentEnquiries} require a quick response` : "All urgent requests handled", href: "/professional/enquiries", action: "Respond now", icon: MessageSquareText, tone: "violet" as const },
    { label: "Quotes awaiting decision", value: summary.quotationsAwaitingDecision, detail: summary.expiringQuotations ? `${summary.expiringQuotations} expire within 24 hours` : "No quotes expiring today", href: "/professional/quotations", action: "Follow up", icon: FileText, tone: "blue" as const },
    { label: "Jobs today", value: summary.jobsToday, detail: summary.jobsNeedingCheckIn ? `${summary.jobsNeedingCheckIn} need check-in` : "Today’s jobs are on track", href: "/professional/calendar", action: "View schedule", icon: CalendarDays, tone: "green" as const },
    { label: "Outstanding invoices", value: summary.outstandingInvoicesMinor === null ? "Restricted" : formatMoney(summary.outstandingInvoicesMinor), detail: summary.overdueInvoices ? `${summary.overdueInvoices} overdue` : "No overdue invoices", href: "/professional/invoices", action: "Review invoices", icon: CircleDollarSign, tone: "orange" as const },
  ];

  return (
    <div className="space-y-3 type-workspace-body">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between" aria-labelledby="dashboard-title">
        <div>
          <h1 id="dashboard-title" className="type-workspace-title">{greeting()}, {workspaceLabel}!</h1>
          <p className="mt-0.5 text-muted-foreground">Here’s what needs your attention today.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <QuickAction href="/professional/quotations/new" icon={Plus}>Create quote</QuickAction>
          <QuickAction href="/professional/availability" icon={CalendarDays}>Set availability</QuickAction>
          <QuickAction href="/professional/services/new" icon={Wrench}>Add service</QuickAction>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_336px]" aria-label="Business summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topMetrics.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>
        <ProfileVisibility data={data.profileVisibility} />
      </section>

      <div className="grid gap-3 xl:grid-cols-[0.96fr_1.08fr_0.56fr] xl:items-start">
        <div className="min-w-0 space-y-3">
          <SectionCard>
            <SectionHeading title="Action centre" href="/professional/enquiries" action="View all tasks" />
            {data.actionGroups.length ? <div className="mt-2 divide-y divide-black/8">{data.actionGroups.map((group) => <div key={group.id} className="py-2 first:pt-0"><p className={cn("type-caption font-semibold", group.id === "priority" ? "text-danger" : group.id === "today" ? "text-[#245eea]" : "text-[#5c35c9]")}>{group.label}</p>{group.items.slice(0, 2).map((item) => <ActionRow key={item.id} {...item} />)}</div>)}</div> : <CompactEmpty title="You’re all caught up" description="New enquiries, expiring quotes, today’s jobs, and overdue invoices will appear here." />}
          </SectionCard>
          <ScheduleCard schedule={data.schedule} />
        </div>

        <div className="min-w-0 space-y-3">
          <PerformanceCard data={data} active={performanceKey} onChange={setPerformanceKey} range={dashboard.range} onRangeChange={dashboard.setRange} />
          <InsightsCard insights={data.marketplaceInsights} />
        </div>

        <div className="min-w-0 space-y-3">
          <TeamCard team={data.teamToday} />
          <ReputationCard reputation={data.reputation} />
        </div>
      </div>

      <p className="type-caption text-muted-foreground">Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Transactional records remain authoritative.</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, children }: { href: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-black/8 bg-white px-4 type-control shadow-[0_4px_12px_rgba(14,30,42,0.035)] hover:bg-[#f5f7f8]"><Icon className="size-4" aria-hidden="true" />{children}</Link>;
}

function MetricCard({ label, value, detail, href, action, icon: Icon, tone }: { label: string; value: number | string; detail: string; href: string; action: string; icon: React.ComponentType<{ className?: string }>; tone: "violet" | "blue" | "green" | "orange" }) {
  const tones = { violet: "bg-[#f1eaff] text-[#6335e9]", blue: "bg-[#eaf1ff] text-[#245eea]", green: "bg-[#eaf5e5] text-[#347b1e]", orange: "bg-[#fff1df] text-[#ef7f00]" };
  return <SectionCard className="flex min-h-[140px] flex-col p-3"><div className="flex gap-2.5"><span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="size-[18px]" /></span><div className="min-w-0"><p className="type-card-label text-[#39434c]">{label}</p><p className="mt-0.5 truncate type-metric numeric-tabular">{typeof value === "number" ? value.toLocaleString() : value}</p><p className={cn("mt-0.5 truncate type-caption", detail.includes("overdue") || detail.includes("require") ? "text-danger" : "text-muted-foreground")}>{detail}</p></div></div><Link href={href} className="mt-auto flex min-h-8 items-center justify-center gap-2 rounded-md border border-black/8 bg-white px-3 type-control hover:bg-[#f5f7f8]">{action}<ArrowRight className="size-3.5" /></Link></SectionCard>;
}

function ProfileVisibility({ data }: { data: ProfessionalDashboardData["profileVisibility"] }) {
  return <SectionCard className="p-4"><div className="flex items-center justify-between"><h2 className="type-section-title">Profile visibility</h2><Badge variant={data.score >= 85 ? "success" : "neutral"}>{data.status}</Badge></div><div className="mt-3 flex items-center gap-4"><div className="relative size-24 shrink-0" role="img" aria-label={`Profile completeness ${data.score} percent`}><ResponsiveContainer width="100%" height="100%"><RadialBarChart data={[{ value: data.score, fill: "#347b1e" }]} innerRadius="76%" outerRadius="100%" startAngle={90} endAngle={-270}><PolarAngleAxis type="number" domain={[0, 100]} tick={false}/><RadialBar dataKey="value" background={{ fill: "#e4ebdf" }} cornerRadius={8}/></RadialBarChart></ResponsiveContainer><span className="pointer-events-none absolute inset-0 grid place-items-center type-metric-large numeric-tabular">{data.score}%</span></div><div><p className="text-muted-foreground">{data.description}</p><Link href={data.nextActionHref} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-md border border-primary px-3 type-control text-[#347b1e]"><ImagePlus className="size-4" />{data.nextAction}</Link></div></div></SectionCard>;
}

function ScheduleCard({ schedule }: { schedule: ProfessionalDashboardData["schedule"] }) {
  return <SectionCard><SectionHeading title="Today’s schedule" href="/professional/calendar" action="View all bookings" />{schedule.length ? <><div className="mt-3 hidden overflow-x-auto md:block"><table className="w-full text-left"><thead className="type-caption text-muted-foreground"><tr><th className="pb-2 font-medium">Time</th><th className="pb-2 font-medium">Job</th><th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Status</th><th className="pb-2 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-black/8">{schedule.slice(0, 5).map((item) => <tr key={item.id}><td className="py-2 pr-2 type-caption">{item.timeRange}</td><td className="py-2 pr-2"><p className="type-card-label">{item.serviceName}</p><p className="type-caption text-muted-foreground">{item.location}</p></td><td className="py-2 pr-2">{item.clientName}</td><td className="py-2 pr-2"><StatusBadge status={item.status} /></td><td className="py-2 text-right"><Link className={smallActionClass} href={item.href}>{item.action}</Link></td></tr>)}</tbody></table></div><div className="mt-3 space-y-2 md:hidden">{schedule.map((item) => <Link href={item.href} key={item.id} className="block rounded-lg border border-black/8 p-3"><div className="flex justify-between gap-2"><p className="type-card-label">{item.serviceName}</p><StatusBadge status={item.status} /></div><p className="mt-1 type-caption text-muted-foreground">{item.timeRange} · {item.clientName} · {item.location}</p></Link>)}</div></> : <CompactEmpty title="No jobs scheduled today" description="Confirmed work for today will appear here." />}</SectionCard>;
}

function PerformanceCard({ data, active, onChange, range, onRangeChange }: { data: ProfessionalDashboardData; active: PerformanceKey; onChange: (key: PerformanceKey) => void; range: "month" | "30-days" | "quarter"; onRangeChange: (range: "month" | "30-days" | "quarter") => void }) {
  const summary = data.summary;
  const selected = performanceTabs.find((tab) => tab.key === active)!;
  return <SectionCard><div className="flex items-center justify-between gap-3"><h2 className="type-section-title">Business performance</h2><select className="h-9 rounded-md border border-black/8 bg-white px-2 type-control" value={range} onChange={(event) => onRangeChange(event.target.value as typeof range)} aria-label="Performance date range"><option value="month">This month</option><option value="30-days">Last 30 days</option><option value="quarter">This quarter</option></select></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><PerformanceMetric label="Recorded revenue" value={summary.revenueMinor === null ? "Restricted" : formatMoney(summary.revenueMinor)} /><PerformanceMetric label="Outstanding invoices" value={summary.outstandingInvoicesMinor === null ? "Restricted" : formatMoney(summary.outstandingInvoicesMinor)} /><PerformanceMetric label="Expected payments" value={summary.expectedPaymentsMinor === null ? "Restricted" : formatMoney(summary.expectedPaymentsMinor)} /><PerformanceMetric label="Avg. job value" value={summary.averageJobValueMinor === null ? "Restricted" : formatMoney(summary.averageJobValueMinor)} /></div><div className="mt-4 h-[190px] w-full" role="img" aria-label={`${selected.label} daily chart for the selected range`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.performance.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><CartesianGrid stroke="#e7ecef" vertical={false}/><XAxis dataKey="day" tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: "#68717b" }} axisLine={false} tickLine={false}/><YAxis width={44} tick={{ fontSize: 11, fill: "#68717b" }} axisLine={false} tickLine={false}/><Tooltip formatter={(value) => active === "revenue" ? formatMoney(Number(value)) : active === "quoteConversion" ? `${value}%` : Number(value).toLocaleString()} labelFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-KE", { dateStyle: "medium" })}/><Area type="monotone" dataKey={active} stroke="#347b1e" fill="#e7f1df" strokeWidth={2} connectNulls /></AreaChart></ResponsiveContainer></div><div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-black/8 p-1 sm:grid-cols-4" role="tablist" aria-label="Performance measure">{performanceTabs.map((tab) => <button key={tab.key} role="tab" aria-selected={active === tab.key} onClick={() => onChange(tab.key)} className={cn("min-h-9 rounded-md px-2 type-control", active === tab.key ? "bg-[#edf5e7] text-[#245f14]" : "text-muted-foreground hover:bg-[#f5f7f8]")}>{tab.label}</button>)}</div></SectionCard>;
}

function TeamCard({ team }: { team: ProfessionalDashboardData["teamToday"] }) {
  return <SectionCard><SectionHeading title="Team today" href="/professional/team" action="Manage" /><div className="mt-4 flex -space-x-2">{team.members.slice(0, 5).map((member) => <span key={member.id} title={`${member.name}: ${member.status.replace("_", " ")}`} className="relative grid size-10 overflow-hidden rounded-full border-2 border-white bg-[#eaf1ff] text-[#245eea] place-items-center type-card-label">{member.imageUrl ? <Image src={member.imageUrl} alt="" fill sizes="40px" className="object-cover" /> : initials(member.name)}</span>)}{team.members.length > 5 ? <span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#f5f7f8] type-card-label">+{team.members.length - 5}</span> : null}</div><div className="mt-4 space-y-2"><StatLine value={team.available} label="Available" tone="green"/><StatLine value={team.onJobs} label="On jobs" tone="blue"/><StatLine value={team.unavailable} label="Unavailable" tone="neutral"/>{team.conflicts ? <StatLine value={team.conflicts} label="Assignment conflicts" tone="orange"/> : null}</div><Link href="/professional/team" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5 w-full")}>Manage assignments</Link></SectionCard>;
}

function InsightsCard({ insights }: { insights: ProfessionalDashboardData["marketplaceInsights"] }) {
  const icons = [ChartNoAxesCombined, MapPin, Clock3, TriangleAlert];
  return <SectionCard><SectionHeading title="Marketplace insights" href="/professional/analytics" action="View full report"/><div className="mt-2 grid gap-x-4 sm:grid-cols-2">{insights.map((insight, index) => <InsightRow key={insight.id} icon={icons[index] ?? BadgeCheck} {...insight}/>)}</div></SectionCard>;
}

function ReputationCard({ reputation }: { reputation: ProfessionalDashboardData["reputation"] }) {
  return <SectionCard><SectionHeading title="Reputation" href="/professional/reviews" action="All reviews"/><div className="mt-3 flex items-start justify-between gap-3"><div><p className="type-metric-large numeric-tabular">{reputation.averageRating ? reputation.averageRating.toFixed(1) : "—"}</p><div className="mt-1 flex gap-0.5 text-[#f5ad13]" aria-label={`${reputation.averageRating.toFixed(1)} out of 5`}>{[0,1,2,3,4].map((item) => <Star key={item} className={cn("size-4", item < Math.round(reputation.averageRating) && "fill-current")}/>)}</div><p className="mt-1 type-caption text-muted-foreground">{reputation.reviewCount} reviews</p></div><div className="border-l border-black/8 pl-3"><p className="type-card-label">{reputation.responseRate}%</p><p className="type-caption text-muted-foreground">Response rate</p><p className="mt-2 type-card-label">{reputation.newReviews}</p><p className="type-caption text-muted-foreground">New this period</p></div></div>{reputation.topStrengths.length ? <div className="mt-4 border-t border-black/8 pt-3"><p className="type-card-label">Top strengths</p><ul className="mt-2 space-y-1 type-caption">{reputation.topStrengths.map((strength) => <li key={strength} className="flex gap-2"><BadgeCheck className="size-3.5 text-[#347b1e]"/>{strength}</li>)}</ul></div> : null}{reputation.latestReview ? <blockquote className="mt-4 rounded-lg bg-[#f6f7f8] p-3 type-caption leading-5 text-[#3d4750]">“{reputation.latestReview.feedback}”<footer className="mt-1 font-semibold text-foreground">— {reputation.latestReview.clientName}</footer></blockquote> : <CompactEmpty title="No published reviews yet" description="Verified client feedback will appear here." />}</SectionCard>;
}

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) { return <Surface className={cn("rounded-xl p-4 shadow-[0_7px_18px_rgba(15,31,43,0.035)]", className)}>{children}</Surface>; }
function SectionHeading({ title, href, action }: { title: string; href: string; action: string }) { return <div className="flex items-center justify-between gap-3"><h2 className="type-section-title">{title}</h2><Link href={href} className="inline-flex min-h-8 items-center gap-1 type-control text-[#245eea]">{action}<ArrowRight className="size-3.5" /></Link></div>; }
const smallActionClass = "inline-flex min-h-8 shrink-0 items-center rounded-md border border-black/8 bg-white px-3 type-control hover:bg-[#f5f7f8]";

function ActionRow({ title, meta, href, action, tone }: ProfessionalDashboardData["actionGroups"][number]["items"][number]) { const Icon = tone === "danger" ? MessageSquareText : tone === "warning" ? Clock3 : BriefcaseBusiness; const tones = { danger: "bg-danger-soft text-danger", warning: "bg-warning-soft text-warning", info: "bg-info-soft text-info", neutral: "bg-[#eef1f3] text-[#58636c]" }; return <div className="flex items-center gap-2.5 py-2"><span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="size-4"/></span><span className="min-w-0 flex-1"><span className="block truncate type-card-label">{title}</span><span className="block truncate type-caption text-muted-foreground">{meta}</span></span><Link href={href} className={smallActionClass}>{action}</Link></div>; }
function PerformanceMetric({ label, value }: { label: string; value: string }) { return <div className="border-l border-black/8 pl-3 first:border-l-0 first:pl-0"><p className="type-caption text-muted-foreground">{label}</p><p className="mt-1 truncate type-card-label numeric-tabular">{value}</p></div>; }
function InsightRow({ icon: Icon, title, description, tone }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; tone: "green" | "blue" | "violet" | "orange" }) { const tones = { green: "bg-[#eef7e8] text-[#397d22]", blue: "bg-[#eaf1ff] text-[#245eea]", violet: "bg-[#f1eaff] text-[#6335e9]", orange: "bg-[#fff1df] text-[#ef7f00]" }; return <div className="flex gap-3 py-2.5"><span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="size-4"/></span><span className="min-w-0"><span className="block type-card-label">{title}</span><span className="mt-0.5 block type-caption text-muted-foreground">{description}</span></span></div>; }
function StatLine({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "orange" | "neutral" }) { const tones = { green: "text-[#2e7d18]", blue: "text-[#245eea]", orange: "text-[#ef7f00]", neutral: "text-[#68717b]" }; return <div className="flex items-center gap-2"><span className={cn("w-5 type-section-title numeric-tabular", tones[tone])}>{value}</span><span className="text-muted-foreground">{label}</span></div>; }
function CompactEmpty({ title, description }: { title: string; description: string }) { return <div className="mt-3 rounded-lg bg-[#f7f9fa] p-3"><p className="type-card-label">{title}</p><p className="mt-1 type-caption text-muted-foreground">{description}</p></div>; }
function StatusBadge({ status }: { status: string }) { return <Badge variant={status === "IN_PROGRESS" ? "success" : "neutral"}>{status.toLowerCase().replaceAll("_", " ")}</Badge>; }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function formatMoney(value: number) { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(value / 100).replace("KES", "KSh"); }
