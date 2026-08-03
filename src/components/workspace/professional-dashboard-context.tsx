"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { ProfessionalDashboardData } from "@/modules/dashboards/types";

type DashboardRangeKey = "month" | "30-days" | "quarter";

interface ProfessionalDashboardContextValue {
  data: ProfessionalDashboardData | null;
  error: string | null;
  loading: boolean;
  range: DashboardRangeKey;
  setRange: (range: DashboardRangeKey) => void;
  refresh: () => void;
}

const ProfessionalDashboardContext = createContext<ProfessionalDashboardContextValue | null>(null);

function datesForRange(range: DashboardRangeKey) {
  const to = new Date();
  const from = new Date(to);
  if (range === "month") {
    from.setDate(1);
  } else if (range === "30-days") {
    from.setDate(from.getDate() - 29);
  } else {
    from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
  }
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ProfessionalDashboardProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [data, setData] = useState<ProfessionalDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DashboardRangeKey>("month");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const dates = datesForRange(range);
    void fetch(`/api/v1/professional/dashboard?${new URLSearchParams(dates)}`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { data?: ProfessionalDashboardData; error?: { message?: string } } | null;
        if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Dashboard data could not be loaded.");
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

  const changeRange = useCallback((nextRange: DashboardRangeKey) => { setLoading(true); setRange(nextRange); }, []);
  const refresh = useCallback(() => { setLoading(true); setRefreshKey((key) => key + 1); }, []);
  const value = useMemo(() => ({ data, error, loading, range, setRange: changeRange, refresh }), [changeRange, data, error, loading, range, refresh]);
  return <ProfessionalDashboardContext.Provider value={value}>{children}</ProfessionalDashboardContext.Provider>;
}

export function useProfessionalDashboard() {
  return useContext(ProfessionalDashboardContext);
}
