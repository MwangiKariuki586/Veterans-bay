"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  Circle,
  Copy,
  EllipsisVertical,
  ExternalLink,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type { NotificationItem, NotificationListResult } from "@/modules/notifications/types";

import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationListQuery,
} from "./notification-api";

type NotificationQueryState = NotificationListQuery;

const defaultQuery: NotificationQueryState = {
  filter: "all",
  page: 1,
  pageSize: 20,
};

const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

export function NotificationCenter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [queryState, setQueryState] = useState<NotificationQueryState>(() =>
    queryFromParams(searchParams),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateParams = useCallback(
    (changes: Partial<NotificationQueryState>, resetPage = true) => {
      setQueryState((prev) => {
        const next: NotificationQueryState = {
          ...prev,
          ...changes,
          page: resetPage ? 1 : (changes.page ?? prev.page ?? 1),
        };
        // Normalise pageSize
        if (![10, 20, 50].includes(next.pageSize)) next.pageSize = 20;
        if (next.page < 1) next.page = 1;
        replaceUrl(pathname, queryString(next));
        return next;
      });
    },
    [pathname],
  );

  const clearFilters = useCallback(() => {
    const next: NotificationQueryState = { ...defaultQuery };
    setQueryState(next);
    replaceUrl(pathname, queryString(next));
  }, [pathname]);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", queryState] as const,
    queryFn: ({ signal }) => listNotifications(queryState, signal as unknown as AbortSignal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 2,
  });

  const result = notificationsQuery.data as NotificationListResult | undefined;
  const hasData = Boolean(result);
  const isInitialLoading = notificationsQuery.isPending && !hasData;
  const isBackgroundError = hasData && notificationsQuery.isError;
  const showProgress = notificationsQuery.isFetching && notificationsQuery.isPlaceholderData;

  useWorkspaceContentReady(!isInitialLoading);

  const visibleItems: NotificationItem[] = useMemo(() => result?.items ?? [], [result?.items]);
  const unreadCount = result?.unreadCount ?? 0;
  const totalItems = result?.totalItems ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const currentPage = result?.page ?? queryState.page;
  const currentPageSize = result?.pageSize ?? queryState.pageSize;

  async function markRead(notificationId: string) {
    setBusy(notificationId);
    setError(null);
    try {
      const res = await markNotificationRead(notificationId);
      // Optimistic cache update
      queryClient.setQueryData<NotificationListResult>(["notifications", queryState], (old) => {
        if (!old) return old;
        const nextItems = old.items.map((item) =>
          item.id === notificationId ? { ...item, readAt: new Date().toISOString() } : item,
        );
        // If filter is unread, remove it from list
        const filtered = queryState.filter === "unread" ? nextItems.filter((i) => i.readAt === null) : nextItems;
        const totalDelta = queryState.filter === "unread" && old.items.length !== filtered.length ? -1 : 0;
        return {
          ...old,
          items: filtered,
          unreadCount: res.unreadCount,
          totalItems: old.totalItems + totalDelta,
        };
      });
      // Also invalidate to reconcile pagination counts if on unread filter
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The notification was not updated.");
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBusy("all");
    setError(null);
    try {
      const res = await markAllNotificationsRead();
      queryClient.setQueryData<NotificationListResult>(["notifications", queryState], (old) => {
        if (!old) return old;
        if (queryState.filter === "unread") {
          return { ...old, items: [], unreadCount: 0, totalItems: Math.max(0, old.totalItems - old.items.length) };
        }
        return {
          ...old,
          items: old.items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
          unreadCount: 0,
        };
      });
      // Full invalidate to ensure counts consistent
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
      // If we optimistically cleared unread filter, also update unreadCount fallback
      if (queryState.filter === "unread") {
        // keep filter as unread but page will be empty — user sees empty state
      }
      // Update local unreadCount via result will be res.unreadCount on next fetch
      void res;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notifications were not updated.");
    } finally {
      setBusy(null);
    }
  }

  const handleCardClick = useCallback(
    (item: NotificationItem) => {
      if (!item.readAt) {
        void markRead(item.id);
      }
      if (item.actionTarget) {
        router.push(item.actionTarget);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  const hasActiveFilter = queryState.filter !== "all";

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6b9f16]">Account activity</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">
            Notifications
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
            Important request, quotation, conversation, and booking activity appears here after it is processed
            independently.
          </p>
        </div>
        <Button
          variant="outline"
          className="shadow-none"
          disabled={unreadCount === 0 || isInitialLoading}
          loading={busy === "all"}
          onClick={() => void markAllRead()}
        >
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </header>

      {isInitialLoading && !hasData ? (
        <NotificationListSkeleton />
      ) : notificationsQuery.isError && !hasData ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Notifications unavailable"
          description={notificationsQuery.error instanceof Error ? notificationsQuery.error.message : "Notifications could not be loaded."}
        >
          <button
            type="button"
            onClick={() => void notificationsQuery.refetch()}
            className="mt-2 text-xs font-semibold text-trust underline"
          >
            Try again
          </button>
        </InlineAlert>
      ) : (
        <>
          {isBackgroundError ? (
            <InlineAlert
              className="mt-4"
              variant="error"
              title="Notifications update failed"
              description={
                notificationsQuery.error instanceof Error
                  ? notificationsQuery.error.message
                  : "Notifications could not be refreshed."
              }
            >
              <button
                type="button"
                onClick={() => void notificationsQuery.refetch()}
                className="mt-2 text-xs font-semibold text-trust underline"
              >
                Try again
              </button>
            </InlineAlert>
          ) : null}

          <nav
            className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6"
            aria-label="Notification views"
          >
            {(["all", "unread"] as const).map((value) => {
              const active = queryState.filter === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => updateParams({ filter: value })}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition",
                    active
                      ? "border-[#83b72c] text-[#426d08]"
                      : "border-transparent text-[#536170] hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {value === "all" ? "All" : "Unread"}
                  <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">
                    {value === "all" ? totalItems : unreadCount}
                  </span>
                </button>
              );
            })}
          </nav>

          <section
            className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]"
            aria-label="Notifications"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <span className="hidden text-[0.68rem] font-medium text-muted-foreground sm:inline">
                Tap a notification to open its activity.
              </span>
              <span className="text-[0.68rem] text-muted-foreground sm:hidden">Tap to view activity</span>
            </div>

            <div className="relative" aria-busy={showProgress || undefined}>
              {error ? (
                <InlineAlert
                  className="m-4"
                  variant="error"
                  title="Notifications need attention"
                  description={error}
                />
              ) : null}

              {isInitialLoading || showProgress ? (
                <div className="grid gap-3 p-3" aria-busy="true" aria-live="polite">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]"
                    >
                      <div className="flex items-start gap-4">
                        <Skeleton className="size-9 shrink-0 rounded-[10px]" />
                        <div className="min-w-0 flex-1">
                          <Skeleton className="h-4 w-2/3 rounded-full" />
                          <Skeleton className="mt-2 h-3 w-full rounded-full" />
                          <Skeleton className="mt-2 h-3 w-1/3 rounded-full" />
                        </div>
                        <Skeleton className="size-9 rounded-[9px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : visibleItems.length === 0 ? (
                <StatePanel
                  className="m-4 border-dashed shadow-none"
                  title={
                    hasActiveFilter
                      ? "You are all caught up"
                      : totalItems === 0
                        ? "No notifications yet"
                        : "No notifications on this page"
                  }
                  description={
                    hasActiveFilter
                      ? "New unread activity will appear here."
                      : totalItems === 0
                        ? "Relevant service activity will appear here after it is processed."
                        : "Try a different page or filter."
                  }
                >
                  {hasActiveFilter ? (
                    <Button size="sm" variant="outline" onClick={clearFilters}>
                      Show all
                    </Button>
                  ) : totalItems === 0 ? null : (
                    <Button size="sm" variant="outline" onClick={() => updateParams({ page: 1 }, false)}>
                      Go to first page
                    </Button>
                  )}
                </StatePanel>
              ) : (
                <ol className="grid gap-3 p-3">
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <NotificationCard
                        item={item}
                        busy={busy === item.id}
                        onMarkRead={() => void markRead(item.id)}
                        onOpen={() => handleCardClick(item)}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {result ? (
              <NotificationPagination
                page={currentPage}
                pageSize={currentPageSize}
                totalItems={totalItems}
                totalPages={totalPages}
                onPage={(page) => updateParams({ page }, false)}
                onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)}
              />
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

function NotificationCard({
  item,
  busy,
  onMarkRead,
  onOpen,
}: {
  item: NotificationItem;
  busy: boolean;
  onMarkRead: () => void;
  onOpen: () => void;
}) {
  const isUnread = !item.readAt;
  return (
    <article
      role={item.actionTarget ? "button" : undefined}
      tabIndex={item.actionTarget ? 0 : undefined}
      aria-label={`${item.title}${isUnread ? " unread" : ""}`}
      onClick={(event) => {
        if (isInteractiveTarget(event.target)) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target)) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group flex items-start gap-4 rounded-[14px] border bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        item.actionTarget && "cursor-pointer hover:bg-[#fafcf8] hover:shadow-[0_4px_14px_rgba(15,31,43,0.05)]",
        !item.actionTarget && "cursor-default",
        isUnread ? "border-[#c9e46f] bg-[#fbfef1]" : "border-black/8",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-[10px]",
          isUnread ? "bg-[#edf7dd] text-[#6d9f16]" : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        <Bell className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-[0.84rem] font-semibold leading-5 text-foreground">{item.title}</h2>
            {isUnread ? (
              <Badge variant="trust" className="min-h-6 shrink-0 px-2.5 py-0.5 text-[0.62rem] font-medium">
                <Circle className="size-2 fill-current" /> Unread
              </Badge>
            ) : null}
          </div>
          <span className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <NotificationKebab item={item} busy={busy} onMarkRead={onMarkRead} onOpen={onOpen} />
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[0.78rem] leading-5 text-muted-foreground">{item.body}</p>
        <p className="mt-2 text-[0.64rem] text-muted-foreground">
          {formatNotificationTime(item.createdAt)}
          {!item.actionTarget ? " · No action" : null}
          {item.actionTarget ? (
            <span className="ml-1 hidden items-center gap-1 text-[#6d9f16] group-hover:inline-flex">
              — View <ExternalLink className="size-3" aria-hidden="true" />
            </span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function NotificationKebab({
  item,
  busy,
  onMarkRead,
  onOpen,
}: {
  item: NotificationItem;
  busy: boolean;
  onMarkRead: () => void;
  onOpen: () => void;
}) {
  const isUnread = !item.readAt;

  async function copyLink() {
    if (!item.actionTarget) return;
    const url = item.actionTarget.startsWith("http")
      ? item.actionTarget
      : `${window.location.origin}${item.actionTarget}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  async function copyNotification() {
    try {
      await navigator.clipboard.writeText(`${item.title} — ${item.body}`);
      toast.success("Notification copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="grid size-9 place-items-center rounded-[9px] border border-black/8 bg-white hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`More actions for ${item.title}`}
        >
          <EllipsisVertical className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item.actionTarget ? (
          <DropdownMenuItem onSelect={() => onOpen()}>
            Open activity <ExternalLink className="ml-auto size-3.5" aria-hidden="true" />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>Target unavailable</DropdownMenuItem>
        )}
        {isUnread ? (
          <DropdownMenuItem onSelect={() => onMarkRead()} disabled={busy}>
            {busy ? <Spinner className="mr-2 size-3.5" /> : <CheckCheck className="mr-2 size-3.5" aria-hidden="true" />}
            Mark as read
          </DropdownMenuItem>
        ) : null}
        {item.actionTarget ? (
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <Copy className="mr-2 size-3.5" aria-hidden="true" /> Copy link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={() => void copyNotification()}>
          <Copy className="mr-2 size-3.5" aria-hidden="true" /> Copy notification
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from(
    new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages)),
  ).sort((a, b) => a - b);

  return (
    <nav
      aria-label="Notification pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3"
    >
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} notifications
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="notification-page-size">
          Notifications per page
        </label>
        <select
          id="notification-page-size"
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className={cn(selectClass, "h-9")}
        >
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
        </select>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="grid size-9 place-items-center rounded-lg disabled:opacity-35"
          aria-label="Previous page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {pages.map((item, index) => (
          <span key={item} className="contents">
            {index > 0 && item - pages[index - 1] > 1 ? (
              <span className="px-1 text-muted-foreground">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPage(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium",
                item === page && "border border-[#83b72c] text-[#5f8d11]",
              )}
            >
              {item}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="grid size-9 place-items-center rounded-lg disabled:opacity-35"
          aria-label="Next page"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}

function NotificationListSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true">
      <Skeleton className="h-11 rounded-none" />
      <div className="overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]">
        <div className="border-b border-black/6 p-3">
          <Skeleton className="h-3 w-56 rounded-full" />
        </div>
        <div className="grid gap-3 p-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-[14px] border border-black/8 bg-white p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="size-9 shrink-0 rounded-[10px]" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-full rounded-full" />
                  <Skeleton className="mt-2 h-3 w-1/3 rounded-full" />
                </div>
                <Skeleton className="size-9 rounded-[9px]" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
          <Skeleton className="h-3 w-40 rounded-full" />
          <Skeleton className="h-9 w-64 rounded-[11px]" />
        </div>
      </div>
    </div>
  );
}

function queryFromParams(searchParams: URLSearchParams): NotificationQueryState {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const rawPageSize = Number(searchParams.get("pageSize"));
  const pageSize = [10, 20, 50].includes(rawPageSize) ? rawPageSize : 20;
  const filter = searchParams.get("filter") === "unread" ? "unread" : "all";
  return { filter, page, pageSize };
}

function queryString(state: NotificationQueryState): string {
  const params = new URLSearchParams();
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 20) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("a, button, input, select, textarea, [role='menuitem']"))
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const differenceMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(differenceMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(differenceMinutes, "minute");
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
