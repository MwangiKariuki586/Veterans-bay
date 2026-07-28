import type { PageResult } from "@/platform/http/pagination";
import type {
  AvailabilityConfiguration,
  BookingDetail,
  BookingSlot,
  BookingStatus,
  BookingSummary,
  CalendarEntry,
} from "@/modules/bookings/types";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiErrorEnvelope {
  error?: { message?: string };
}

export async function bookingApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    cache: "no-store",
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json()) as ApiEnvelope<T> & ApiErrorEnvelope;
  if (!response.ok) {
    throw new Error(body.error?.message ?? "Booking action failed.");
  }
  return body.data;
}

export function listBookings(
  audience: "client" | "professional",
  status?: BookingStatus,
) {
  const query = status ? `?status=${status}` : "";
  return bookingApi<PageResult<BookingSummary>>(
    `/api/v1/${audience}/bookings${query}`,
  );
}

export function getBooking(
  audience: "client" | "professional",
  bookingId: string,
) {
  return bookingApi<BookingDetail>(
    `/api/v1/${audience}/bookings/${bookingId}`,
  );
}

export function getBookingSlots(
  audience: "client" | "professional",
  bookingId: string,
) {
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 86_400_000);
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return bookingApi<BookingSlot[]>(
    `/api/v1/${audience}/bookings/${bookingId}/slots?${query}`,
  );
}

export function getDirectServiceSlots(
  professionalSlug: string,
  serviceSlug: string,
) {
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 86_400_000);
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return bookingApi<BookingSlot[]>(
    `/api/v1/client/services/${encodeURIComponent(professionalSlug)}/${encodeURIComponent(serviceSlug)}/booking-slots?${query}`,
  );
}

export function createClientBooking(body: Record<string, unknown>) {
  return bookingApi<BookingDetail>("/api/v1/client/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function bookingAction(
  audience: "client" | "professional",
  bookingId: string,
  action: string,
  body: Record<string, unknown>,
) {
  return bookingApi<BookingDetail>(
    `/api/v1/${audience}/bookings/${bookingId}/${action}`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getAvailability() {
  return bookingApi<AvailabilityConfiguration>(
    "/api/v1/professional/availability",
  );
}

export function saveAvailability(body: Record<string, unknown>) {
  return bookingApi<AvailabilityConfiguration>(
    "/api/v1/professional/availability",
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function addAvailabilityBlock(body: Record<string, unknown>) {
  return bookingApi<AvailabilityConfiguration>(
    "/api/v1/professional/availability/blocks",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function removeAvailabilityBlock(blockId: string) {
  return bookingApi<AvailabilityConfiguration>(
    `/api/v1/professional/availability/blocks/${blockId}`,
    { method: "DELETE" },
  );
}

export function getCalendar(from: Date, to: Date, membershipId?: string) {
  const query = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    ...(membershipId ? { membershipId } : {}),
  });
  return bookingApi<CalendarEntry[]>(
    `/api/v1/professional/calendar?${query}`,
  );
}
