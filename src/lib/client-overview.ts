"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { authClient } from "@/lib/auth-client";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";

// Five minutes stale, fifteen minutes gc (matches default provider gcTime)
export const CLIENT_OVERVIEW_STALE_MS = 5 * 60_000;
export const CLIENT_OVERVIEW_GC_MS = 15 * 60_000;

export type ClientOverviewScope = {
  userId: string;
  workspaceId: string;
};

export function useClientOverviewScope(): {
  scope: ClientOverviewScope | null;
  enabled: boolean;
  prefix: unknown[];
} {
  const { data: session } = authClient.useSession();
  const { workspaceId } = useWorkspaceShell();
  const userId = session?.user.id ?? null;
  const scope =
    userId && workspaceId ? { userId, workspaceId } : null;
  const enabled = Boolean(scope);
  const prefix = scope
    ? (["client-overview", scope.userId, scope.workspaceId] as unknown[])
    : (["client-overview"] as unknown[]);
  return { scope, enabled, prefix };
}

export const clientOverviewKeys = {
  root: (scope: ClientOverviewScope) =>
    ["client-overview", scope.userId, scope.workspaceId] as const,
  dashboard: (scope: ClientOverviewScope, range: string) =>
    ["client-overview", scope.userId, scope.workspaceId, "dashboard", range] as const,
  requests: (scope: ClientOverviewScope, queryState: unknown) =>
    ["client-overview", scope.userId, scope.workspaceId, "requests", queryState] as const,
  quotations: (scope: ClientOverviewScope, queryState: unknown) =>
    ["client-overview", scope.userId, scope.workspaceId, "quotations", queryState] as const,
  bookings: (
    scope: ClientOverviewScope,
    audience: string,
    queryState: unknown,
  ) =>
    ["client-overview", scope.userId, scope.workspaceId, "bookings", audience, queryState] as const,
  invoices: (
    scope: ClientOverviewScope,
    audience: string,
    queryState: unknown,
  ) =>
    ["client-overview", scope.userId, scope.workspaceId, "invoices", audience, queryState] as const,
  warranties: (
    scope: ClientOverviewScope,
    audience: string,
    queryState: unknown,
  ) =>
    ["client-overview", scope.userId, scope.workspaceId, "warranties", audience, queryState] as const,
  savedProfessionals: (scope: ClientOverviewScope) =>
    ["client-overview", scope.userId, scope.workspaceId, "saved-professionals"] as const,
};

export function useInvalidateClientOverview() {
  const queryClient = useQueryClient();
  const { scope } = useClientOverviewScope();
  return useCallback(
    async (options?: { detailKeys?: unknown[][] }) => {
      const base = scope
        ? clientOverviewKeys.root(scope)
        : (["client-overview"] as unknown as readonly unknown[]);
      await queryClient.invalidateQueries({ queryKey: base as unknown[] });
      if (options?.detailKeys) {
        for (const key of options.detailKeys) {
          await queryClient.invalidateQueries({ queryKey: key as unknown[] });
        }
      }
    },
    [queryClient, scope],
  );
}

// Helper for non-hook contexts (e.g., marketplace pages without scope hook)
export function invalidateAllClientOverviews(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return queryClient.invalidateQueries({ queryKey: ["client-overview"] });
}
