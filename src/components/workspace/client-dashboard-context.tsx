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
  const queryClient = useOptionalQueryClient();
  if (!queryClient) {
    return <ClientDashboardContext.Provider value={{ data: null, error: null, loading: false, isFetching: false, refresh: () => {} }}>{children}</ClientDashboardContext.Provider>;
  }
  return <ClientDashboardQueryProvider enabled={enabled}>{children}</ClientDashboardQueryProvider>;
}

function ClientDashboardQueryProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const range = "month";
  const { workspaceId } = useWorkspaceShell();
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const scope = useMemo(() => (userId && workspaceId ? { userId, workspaceId } : null), [userId, workspaceId]);
  const scopeEnabled = enabled && Boolean(scope);
  const queryClient = useQueryClient();

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
  // Keep cached dashboard content visible during background refreshes.
  const isFetching = query.isFetching;
  const finalLoading = !data && (!scopeEnabled || query.isPending);

  const value = useMemo(
    () => ({ data, error, loading: finalLoading, isFetching, refresh }),
    [data, error, finalLoading, isFetching, refresh],
  );

  // Provide even when disabled to avoid null context
  return <ClientDashboardContext.Provider value={value}>{children}</ClientDashboardContext.Provider>;
}

export function useClientDashboard() {
  const ctx = useContext(ClientDashboardContext);
  return ctx;
}

// Duration changes belong to the spending card, not the dashboard-wide observer.
export function useClientSpending() {
  const [range, setRange] = useState<ClientDashboardRangeKey>("month");
  const { workspaceId, userId } = useWorkspaceShell();
  const scope = userId && workspaceId ? { userId, workspaceId } : null;
  const query = useQuery({
    queryKey: scope ? clientOverviewKeys.dashboard(scope, range) : ["client-overview", "spending", range],
    queryFn: ({ signal }) => fetchDashboard(range, signal),
    select: (data) => data.spending,
    enabled: Boolean(scope),
    staleTime: CLIENT_OVERVIEW_STALE_MS,
    gcTime: CLIENT_OVERVIEW_GC_MS,
    retry: 2,
  });
  return {
    data: query.data,
    loading: query.isPending,
    error: query.error?.message ?? null,
    range,
    setRange,
    refresh: () => { void query.refetch(); },
  };
}
