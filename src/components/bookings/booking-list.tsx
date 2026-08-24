"use client";

import { CalendarDays, Clock3, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useCachedResource } from "@/lib/use-cached-resource";
import { cn } from "@/lib/utils";
import {
  bookingStatuses,
  type BookingStatus,
  type BookingSummary,
} from "@/modules/bookings/types";
import { listBookings } from "./booking-api";

export function BookingList({
  audience,
}: {
  audience: "client" | "professional";
}) {
  const [status, setStatus] = useState<BookingStatus | "ALL">("ALL");
  const load = useCallback(
    (signal: AbortSignal) =>
      listBookings(audience, status === "ALL" ? undefined : status).then(
        (result) => {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          return result.items;
        },
      ),
    [audience, status],
  );
  const { data: items, error } = useCachedResource<BookingSummary[]>({
    namespace: "bookings-list",
    key: `${audience}:${status}`,
    load,
    errorMessage: "Bookings unavailable.",
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Scheduling workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            {audience === "client" ? "My bookings" : "Bookings"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            {audience === "client"
              ? "Choose times, follow confirmations, and manage schedule changes."
              : "Confirm eligible times, coordinate assignments, and preserve every schedule change."}
          </p>
        </div>
        {audience === "professional" ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/professional/calendar"
              className={buttonVariants({ variant: "outline" })}
            >
              <CalendarDays className="size-4" /> Calendar
            </Link>
            <Link
              href="/professional/availability"
              className={buttonVariants()}
            >
              Set availability
            </Link>
          </div>
        ) : null}
      </div>

      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Booking status filter"
      >
        {(["ALL", ...bookingStatuses] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold",
              status === item
                ? "border-[#8eb81d] bg-[#eff9c9]"
                : "border-black/8 bg-white text-[#68717b]",
            )}
          >
            {item === "ALL" ? "All" : item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Bookings need attention"
          description={error}
        />
      ) : null}
      {!items && !error ? (
        <div className="mt-5 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : null}
      {items?.length === 0 ? (
        <StatePanel
          className="mt-5"
          title="No bookings in this view"
          description={
            status === "ALL"
              ? "Eligible service arrangements will appear here when they become bookings."
              : "Try another status to see the rest of the schedule."
          }
        />
      ) : null}
      {items && items.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {items.map((booking) => (
            <Link
              key={booking.id}
              href={`/${audience}/bookings/${booking.id}`}
              className="block rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Surface className="p-5 shadow-none transition-colors hover:border-[#b5d657] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          booking.status === "CANCELLED"
                            ? "danger"
                            : ["CONFIRMED", "RESCHEDULED", "COMPLETED"].includes(
                                  booking.status,
                                )
                              ? "trust"
                              : "warning"
                        }
                      >
                        {booking.status.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-xs text-[#7a838c]">
                        {booking.origin.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold">
                      {booking.serviceName}
                    </h2>
                    <p className="mt-1 text-sm text-[#68717b]">
                      {audience === "client"
                        ? booking.providerName
                        : booking.clientName}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatMoney(booking.totalMinor, booking.currency)}
                  </p>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-[#59646e] sm:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-[#5f8d11]" />
                    {booking.startsAt
                      ? new Date(booking.startsAt).toLocaleDateString()
                      : booking.requestedStartAt
                        ? `Requested ${new Date(booking.requestedStartAt).toLocaleDateString()}`
                        : "Time not requested"}
                  </p>
                  <p className="flex items-center gap-2">
                    <Clock3 className="size-4 text-[#5f8d11]" />
                    {booking.startsAt
                      ? new Date(booking.startsAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Awaiting confirmation"}
                  </p>
                  <p className="flex items-center gap-2">
                    <UserRound className="size-4 text-[#5f8d11]" />
                    {booking.assignmentName ?? "Assignment pending"}
                  </p>
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
