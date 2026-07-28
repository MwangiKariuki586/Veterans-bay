import type {
  NotificationCount,
  NotificationListResult,
} from "@/modules/notifications/types";

interface ApiEnvelope<T> {
  data?: T;
  error?: { message?: string };
}

async function notificationApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  const body = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | null;
  if (!response.ok || !body?.data) {
    throw new Error(
      body?.error?.message ?? "Notifications are unavailable.",
    );
  }
  return body.data;
}

export function listNotifications(filter: "all" | "unread") {
  return notificationApi<NotificationListResult>(
    `/api/v1/notifications?filter=${filter}`,
  );
}

export function getUnreadNotificationCount() {
  return notificationApi<NotificationCount>(
    "/api/v1/notifications/unread-count",
  );
}

export function markNotificationRead(notificationId: string) {
  return notificationApi<NotificationCount>(
    `/api/v1/notifications/${notificationId}/read`,
    { method: "POST" },
  );
}

export function markAllNotificationsRead() {
  return notificationApi<NotificationCount & { markedRead: number }>(
    "/api/v1/notifications/read-all",
    { method: "POST" },
  );
}
