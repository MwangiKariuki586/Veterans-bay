"use client";

/* eslint-disable react-hooks/set-state-in-effect -- mirrors professional dashboard cache pattern */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import type { ClientDashboardData } from "@/modules/dashboards/types";

type ClientDashboardRangeKey = "month" | "30-days" | "quarter";

interface ClientDashboardContextValue {
  data: ClientDashboardData | null;
  error: string | null;
  loading: boolean;
  range: ClientDashboardRangeKey;
  setRange: (range: ClientDashboardRangeKey) => void;
  refresh: () => void;
}

const ClientDashboardContext = createContext<ClientDashboardContextValue | null>(null);

const DASHBOARD_CACHE_NS = "client-dashboard";
const DASHBOARD_CACHE_TTL_MS = 60_000;

function datesForRange(range: ClientDashboardRangeKey) {
  const to = new Date();
  const from = new Date(to);
  if (range === "month") {
    from.setUTCDate(1);
    from.setUTCHours(0, 0, 0, 0);
  } else if (range === "30-days") {
    from.setUTCDate(from.getUTCDate() - 29);
    from.setUTCHours(0, 0, 0, 0);
  } else {
    const quarterMonth = Math.floor(from.getUTCMonth() / 3) * 3;
    from.setUTCMonth(quarterMonth, 1);
    from.setUTCHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ClientDashboardProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [range, setRangeState] = useState<ClientDashboardRangeKey>("month");
  const initialCached = getCachedResource<ClientDashboardData>(DASHBOARD_CACHE_NS, "month", DASHBOARD_CACHE_TTL_MS);
  const [data, setData] = useState<ClientDashboardData | null>(initialCached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialCached);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const cached = getCachedResource<ClientDashboardData>(DASHBOARD_CACHE_NS, range, DASHBOARD_CACHE_TTL_MS);
    if (cached) {
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const dates = datesForRange(range);
    void fetch(`/api/v1/client/dashboard?${new URLSearchParams(dates)}`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { data?: ClientDashboardData; error?: { message?: string } } | null;
        if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Dashboard data could not be loaded.");
        setCachedResource(DASHBOARD_CACHE_NS, range, body.data);
        setData(body.data);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, range, refreshKey]);

  const setRange = useCallback((next: ClientDashboardRangeKey) => {
    const cached = getCachedResource<ClientDashboardData>(DASHBOARD_CACHE_NS, next, DASHBOARD_CACHE_TTL_MS);
    if (cached) setData(cached);
    setLoading(!cached);
    setRangeState(next);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const value = useMemo(() => ({ data, error, loading, range, setRange, refresh }), [data, error, loading, range, setRange, refresh]);
  return <ClientDashboardContext.Provider value={value}>{children}</ClientDashboardContext.Provider>;
}

export function useClientDashboard() {
  const ctx = useContext(ClientDashboardContext);
  return ctx;
}
