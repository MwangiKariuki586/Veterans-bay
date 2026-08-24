"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

interface DashboardData {
  metrics: Record<string, number | null>;
  restrictedMetrics?: string[];
  recent: Array<{
    id: string;
    title: string;
    status?: string;
    entityType?: string;
    updatedAt: string;
    actionTarget: string;
  }>;
  generatedAt: string;
  source: string;
  range?: { from: string; to: string };
  engagementTrend?: Array<{ day: string; value: number }>;
}

const configuration = {
  client: {
    path: "/api/v1/client/dashboard",
    eyebrow: "Your current service activity",
    title: "What needs your attention",
    metrics: [
      ["active_requests", "Active requests", "/client/requests"],
      ["pending_quotations", "Pending quotations", "/client/quotations"],
      ["upcoming_bookings", "Upcoming bookings", "/client/bookings"],
      ["active_jobs", "Active jobs", "/client/jobs"],
      ["completion_confirmations", "Completion confirmations", "/client/jobs"],
      ["active_warranties", "Active warranties", "/client/warranties"],
    ],
  },
  professional: {
    path: "/api/v1/professional/dashboard",
    eyebrow: "Organisation operations",
    title: "Your business workload",
    metrics: [
      ["new_enquiries", "New enquiries", "/professional/enquiries"],
      ["quotations_awaiting_response", "Quotations awaiting response", "/professional/quotations"],
      ["upcoming_bookings", "Upcoming bookings", "/professional/bookings"],
      ["jobs_in_progress", "Jobs in progress", "/professional/jobs"],
      ["outstanding_payments", "Outstanding payments", "/professional/invoices"],
      ["warranty_claims", "Warranty claims", "/professional/warranties"],
      ["recent_reviews", "Recent reviews", "/professional/reviews"],
      ["revenue_minor", "Revenue", "/professional/payments"],
      ["completion_rate", "Completion rate", "/professional/analytics"],
    ],
  },
  admin: {
    path: "/api/v1/admin/dashboard",
    eyebrow: "Platform operations",
    title: "Marketplace health and action queues",
    metrics: [
      ["pending_professional_reviews", "Pending professional reviews", "/admin/professionals"],
      ["active_professionals", "Active professionals", "/admin/organisations"],
      ["new_requests", "New requests", "/admin/analytics"],
      ["completed_jobs", "Completed jobs", "/admin/analytics"],
      ["open_reports", "Open reports", "/admin/reports"],
      ["active_disputes", "Active disputes", "/admin/disputes"],
      ["completion_rate", "Completion rate", "/admin/analytics"],
    ],
  },
} as const;

export function LiveDashboard({
  kind,
}: {
  kind: keyof typeof configuration;
}) {
  const config = configuration[kind];
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const path = useMemo(() => {
    if (kind === "client") return config.path;
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: now.toISOString(),
    });
    return `${config.path}?${query}`;
  }, [config.path, kind]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(path, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: DashboardData;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Dashboard data could not be loaded.");
        }
        setData(body.data);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
      });
    return () => controller.abort();
  }, [path, reload]);

  if (!data && !error) {
    return <StatePanel variant="loading" title="Loading dashboard" description="Calculating a bounded summary from your current records." />;
  }
  if (!data) {
    return <StatePanel variant="error" title="Dashboard unavailable" description={error ?? "Dashboard data could not be loaded."} actionLabel="Try again" onAction={() => setReload((value) => value + 1)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-trust">{config.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title sm:text-4xl">{config.title}</h1>
        </div>
        <Badge variant="info">
          Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {config.metrics.map(([key, label, href]) => {
          const restricted = data.restrictedMetrics?.includes(key);
          const value = data.metrics[key];
          return (
            <Surface key={key} className="p-4 shadow-none">
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold">
                {restricted
                  ? "Restricted"
                  : key === "revenue_minor"
                    ? formatMoney(value ?? 0)
                    : key === "completion_rate"
                      ? `${value ?? 0}%`
                      : (value ?? 0).toLocaleString()}
              </p>
              <Link
                href={href}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "mt-2 px-0 text-trust",
                )}
              >
                {restricted ? "Permission required" : "View records"}
              </Link>
            </Surface>
          );
        })}
      </div>

      {data.engagementTrend ? (
        <Surface className="p-5 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Marketplace engagement trend</h2>
            <p className="text-xs text-muted-foreground">Event-backed · may lag briefly</p>
          </div>
          {data.engagementTrend.length ? (
            <div className="mt-5 flex h-32 items-end gap-1" role="img" aria-label="Daily marketplace engagement">
              {data.engagementTrend.map((point) => {
                const maximum = Math.max(...data.engagementTrend!.map((item) => Number(item.value)), 1);
                return <div key={point.day} className="min-w-1 flex-1 rounded-t bg-info" style={{ height: `${Math.max(8, (Number(point.value) / maximum) * 100)}%` }} title={`${point.day}: ${point.value}`} />;
              })}
            </div>
          ) : (
            <StatePanel className="mt-4" title="No engagement in range" description="No supported marketplace events were recorded during this bounded range." />
          )}
        </Surface>
      ) : null}

      <Surface className="p-5 shadow-none">
        <h2 className="font-semibold">Recent history</h2>
        {data.recent.length ? (
          <ul className="mt-3 divide-y divide-black/8">
            {data.recent.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.status ?? item.entityType ?? "Activity"} · {new Date(item.updatedAt).toLocaleString()}</p></div>
                <Link
                  href={item.actionTarget}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <StatePanel className="mt-4" title="No recent activity" description="New transactional activity will appear here." />
        )}
      </Surface>
      <p className="text-xs text-muted-foreground">Transactional records remain authoritative. Dashboard summaries are bounded and generated on demand.</p>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value / 100);
}
