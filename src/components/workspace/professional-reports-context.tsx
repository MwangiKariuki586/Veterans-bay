"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { getCachedResource, setCachedResource } from "@/lib/client-resource-cache";
import type { ProfessionalReportsData } from "@/modules/dashboards/types";

type ReportsRangeKey = "30-days" | "this-week" | "month" | "quarter";

interface ProfessionalReportsContextValue {
  data: ProfessionalReportsData | null;
  error: string | null;
  loading: boolean;
  range: ReportsRangeKey;
  setRange: (range: ReportsRangeKey) => void;
  refresh: () => void;
}

const ProfessionalReportsContext = createContext<ProfessionalReportsContextValue | null>(null);

const REPORTS_CACHE_NS = "professional-reports";
const REPORTS_CACHE_TTL_MS = 60_000;

function datesForRange(range: ReportsRangeKey) {
  const to = new Date();
  const from = new Date(to);
  if (range === "30-days") {
    from.setDate(from.getDate() - 29);
  } else if (range === "this-week") {
    const day = from.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    from.setDate(from.getDate() + diff);
  } else if (range === "month") {
    from.setDate(1);
  } else {
    from.setMonth(Math.floor(from.getMonth() / 3) * 3, 1);
  }
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function cacheKey(range: ReportsRangeKey) {
  return range;
}

export function ProfessionalReportsProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [range, setRangeState] = useState<ReportsRangeKey>("30-days");
  const initialKey = cacheKey("30-days");
  const initialCached = getCachedResource<ProfessionalReportsData>(REPORTS_CACHE_NS, initialKey, REPORTS_CACHE_TTL_MS);
  const [data, setData] = useState<ProfessionalReportsData | null>(initialCached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialCached);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const key = cacheKey(range);
    const cached = getCachedResource<ProfessionalReportsData>(REPORTS_CACHE_NS, key, REPORTS_CACHE_TTL_MS);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from cache after mount
      setData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const dates = datesForRange(range);
    void fetch(`/api/v1/professional/reports?${new URLSearchParams(dates)}`, {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | { data?: ProfessionalReportsData; error?: { message?: string } }
          | null;
        if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Reports data could not be loaded.");
        setCachedResource(REPORTS_CACHE_NS, key, body.data);
        setData(body.data);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Reports data could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, range, refreshKey]);

  const setRange = useCallback((nextRange: ReportsRangeKey) => {
    const key = cacheKey(nextRange);
    const cached = getCachedResource<ProfessionalReportsData>(REPORTS_CACHE_NS, key, REPORTS_CACHE_TTL_MS);
    if (cached) setData(cached);
    setLoading(!cached);
    setRangeState(nextRange);
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshKey((key) => key + 1);
  }, []);

  const value = useMemo(() => ({ data, error, loading, range, setRange, refresh }), [data, error, loading, range, refresh, setRange]);
  return <ProfessionalReportsContext.Provider value={value}>{children}</ProfessionalReportsContext.Provider>;
}

export function useProfessionalReports() {
  return useContext(ProfessionalReportsContext);
}
