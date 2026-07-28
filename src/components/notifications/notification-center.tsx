"use client";

import { Bell, CheckCheck, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { NotificationItem } from "@/modules/notifications/types";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-api";

export function NotificationCenter() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listNotifications(filter)
      .then((result) => {
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Notifications are unavailable.",
        ),
      );
  }, [filter]);

  async function markRead(notificationId: string) {
    setBusy(notificationId);
    setError(null);
    try {
      const result = await markNotificationRead(notificationId);
      setUnreadCount(result.unreadCount);
      setItems((current) =>
        current
          ?.map((item) =>
            item.id === notificationId
              ? { ...item, readAt: new Date().toISOString() }
              : item,
          )
          .filter((item) => filter !== "unread" || item.readAt === null) ??
        null,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The notification was not updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBusy("all");
    setError(null);
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setItems((current) =>
        filter === "unread"
          ? []
          : current?.map((item) => ({
              ...item,
              readAt: item.readAt ?? new Date().toISOString(),
            })) ?? null,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Notifications were not updated.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Account activity
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
            Notifications
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Important request, quotation, conversation, and booking activity
            appears here after it is processed independently.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={unreadCount === 0}
          loading={busy === "all"}
          onClick={() => void markAllRead()}
        >
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {(["all", "unread"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
              filter === value
                ? "border-[#8eb81d] bg-[#eff9c9]"
                : "border-black/8 bg-white text-[#68717b]"
            }`}
          >
            {value === "all" ? "All" : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Notifications need attention"
          description={error}
        />
      ) : null}
      {items === null && !error ? (
        <StatePanel
          className="mt-5"
          variant="loading"
          title="Loading notifications"
          description="Retrieving your latest account activity."
        />
      ) : null}
      {items?.length === 0 ? (
        <StatePanel
          className="mt-5"
          title={
            filter === "unread"
              ? "You are all caught up"
              : "No notifications yet"
          }
          description={
            filter === "unread"
              ? "New unread activity will appear here."
              : "Relevant service activity will appear here after it is processed."
          }
        />
      ) : null}
      {items && items.length > 0 ? (
        <ol className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Surface
                className={`p-5 shadow-none sm:p-6 ${
                  item.readAt ? "" : "border-[#c9e46f] bg-[#fbfef1]"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                      item.readAt
                        ? "bg-[#f0f3f5] text-[#68717b]"
                        : "bg-[#eafaaf] text-[#5f8d11]"
                    }`}
                  >
                    <Bell className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-bold">{item.title}</h2>
                      {!item.readAt ? (
                        <Badge variant="trust">
                          <Circle className="size-2 fill-current" /> Unread
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#59646e]">
                      {item.body}
                    </p>
                    <p className="mt-2 text-xs text-[#8a939b]">
                      {formatNotificationTime(item.createdAt)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.actionTarget ? (
                        <Link
                          href={item.actionTarget}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#071522] px-4 text-xs font-semibold text-white"
                          onClick={() =>
                            item.readAt ? undefined : void markRead(item.id)
                          }
                        >
                          View activity <ExternalLink className="size-3.5" />
                        </Link>
                      ) : (
                        <span className="inline-flex min-h-10 items-center rounded-full bg-[#f0f3f5] px-4 text-xs font-semibold text-[#68717b]">
                          Target unavailable
                        </span>
                      )}
                      {!item.readAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={busy === item.id}
                          onClick={() => void markRead(item.id)}
                        >
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Surface>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function formatNotificationTime(value: string) {
  const date = new Date(value);
  const differenceMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(differenceMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      differenceMinutes,
      "minute",
    );
  }
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
