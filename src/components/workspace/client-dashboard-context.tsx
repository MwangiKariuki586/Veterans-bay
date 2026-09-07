"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import { CLIENT_OVERVIEW_GC_MS, CLIENT_OVERVIEW_STALE_MS, clientOverviewKeys } from "@/lib/client-overview";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";
import { authClient } from "@/lib/auth-client";
import type { ClientDashboardData } from "@/modules/dashboards/types";

function useOptionalQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}

type ClientDashboardRangeKey = "month" | "30-days" | "quarter";

interface ClientDashboardContextValue {
  data: ClientDashboardData | null;
  error: string | null;
  loading: boolean;
  isFetching: boolean;
  range: ClientDashboardRangeKey;
  setRange: (range: ClientDashboardRangeKey) => void;
  refresh: () => void;
}

const ClientDashboardContext = createContext<ClientDashboardContextValue | null>(null);

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

async function fetchDashboard(range: ClientDashboardRangeKey, signal?: AbortSignal): Promise<ClientDashboardData> {
  const dates = datesForRange(range);
  const response = await fetch(`/api/v1/client/dashboard?${new URLSearchParams(dates)}`, {
    cache: "no-store",
    credentials: "include",
    signal,
  });
  const body = (await response.json().catch(() => null)) as { data?: ClientDashboardData; error?: { message?: string } } | null;
  if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Dashboard data could not be loaded.");
  return body.data;
}

export function ClientDashboardProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [range, setRangeState] = useState<ClientDashboardRangeKey>("month");
  const { workspaceId } = useWorkspaceShell();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const scope = useMemo(() => (userId && workspaceId ? { userId, workspaceId } : null), [userId, workspaceId]);
  const scopeEnabled = enabled && Boolean(scope);
  const queryClient = useOptionalQueryClient();

  const setRange = useCallback((next: ClientDashboardRangeKey) => {
    setRangeState(next);
  }, []);

  if (!queryClient) {
    const refreshFallback = () => {};
    const fallbackValue = { data: null, error: null, loading: false, isFetching: false, range, setRange, refresh: refreshFallback };
    return <ClientDashboardContext.Provider value={fallbackValue as unknown as ClientDashboardContextValue}>{children}</ClientDashboardContext.Provider>;
  }

  const query = useQuery({
    queryKey: scope ? clientOverviewKeys.dashboard(scope, range) : (["client-overview", "dashboard", range] as unknown[]),
    queryFn: ({ signal }) => fetchDashboard(range, signal),
    enabled: scopeEnabled,
    staleTime: CLIENT_OVERVIEW_STALE_MS,
    gcTime: CLIENT_OVERVIEW_GC_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
  });

  const refresh = useCallback(() => {
    if (!scope) {
      void queryClient?.invalidateQueries({ queryKey: ["client-overview"] });
      return;
    }
    void queryClient?.invalidateQueries({ queryKey: clientOverviewKeys.dashboard(scope, range) });
    void queryClient?.invalidateQueries({ queryKey: clientOverviewKeys.root(scope) });
  }, [queryClient, range, scope]);

  const data = (query.data as ClientDashboardData | undefined) ?? null;
  const error = query.error ? (query.error instanceof Error ? query.error.message : "Dashboard data could not be loaded.") : null;
  // Preserve skeleton when scope not yet resolved or no cached data for that range
  // During background refresh, keep cached data visible (loading false)
  const loading = !scope ? !data : query.isPending && !data;
  // Also consider initial enabled false with no data => show skeleton
  const isFetching = query.isFetching;

  // If scope not enabled yet, we still want loading true to show skeletons (initial visit)
  // query.isPending will be false when disabled, so we override
  const finalLoading = !scopeEnabled ? !data : loading;
  // When disabled due to scope, data is null, so loading true -> skeleton

  const value = useMemo(
    () => ({ data, error, loading: finalLoading, isFetching, range, setRange, refresh }),
    [data, error, finalLoading, isFetching, range, setRange, refresh],
  );

  // Provide even when disabled to avoid null context
  return <ClientDashboardContext.Provider value={value as ClientDashboardContextValue}>{children}</ClientDashboardContext.Provider>;
}

export function useClientDashboard() {
  const ctx = useContext(ClientDashboardContext);
  return ctx;
}
