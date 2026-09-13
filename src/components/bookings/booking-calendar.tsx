"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { CalendarEntry } from "@/modules/bookings/types";
import { getCalendar } from "./booking-api";

function isTaskAccepted(entry: CalendarEntry): boolean {
  const jobStatus = entry.jobStatus;
  if (jobStatus) {
    if (["TEAM_ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"].includes(jobStatus)) return true;
    if (["ON_HOLD", "AWAITING_CLIENT_CONFIRMATION", "RETURN_VISIT_REQUIRED", "CREATED", "SCHEDULED", "DISPUTED", "CANCELLED"].includes(jobStatus)) return false;
  }
  if (["CONFIRMED", "RESCHEDULED", "COMPLETED"].includes(entry.status)) return true;
  return false;
}

export function BookingCalendar() {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const [entries, setEntries] = useState<CalendarEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useMemo(
    () => new Date(anchor.getTime() + 7 * 86_400_000),
    [anchor],
  );

  useEffect(() => {
    void getCalendar(anchor, end)
      .then((result) => {
        setEntries(result);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Calendar unavailable."),
      );
  }, [anchor, end]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date(anchor.getTime() + index * 86_400_000);
        return {
          date,
          entries:
            entries?.filter(
              (entry) =>
                localDateKey(new Date(entry.startsAt)) === localDateKey(date),
            ) ?? [],
        };
      }),
    [anchor, entries],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Team schedule
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            Booking calendar
          </h1>
          <p className="mt-2 text-sm text-[#68717b]">
            Tasks and accepted work, grouped by local calendar day — color shows acceptance.
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.7rem]">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#1a9a3a]" /> Accepted</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#f59e0b]" /> Pending</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            aria-label="Previous week"
            onClick={() =>
              setAnchor(new Date(anchor.getTime() - 7 * 86_400_000))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-44 text-center text-sm font-semibold">
            {anchor.toLocaleDateString([], {
              month: "short",
              day: "numeric",
            })}{" "}
            –{" "}
            {new Date(end.getTime() - 1).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <Button
            variant="outline"
            aria-label="Next week"
            onClick={() =>
              setAnchor(new Date(anchor.getTime() + 7 * 86_400_000))
            }
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Calendar needs attention"
          description={error}
        />
      ) : null}
      {!entries && !error ? (
        <StatePanel
          className="mt-5"
          variant="loading"
          title="Loading calendar"
          description="Retrieving conflict-protected reservations."
        />
      ) : null}
      {entries ? (
        <div className="mt-6 grid gap-3 lg:grid-cols-7">
          {days.map((day) => (
            <Surface
              key={day.date.toISOString()}
              className="min-h-36 p-4 shadow-none"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#68717b]">
                {day.date.toLocaleDateString([], { weekday: "short" })}
              </p>
              <p className="mt-1 text-xl font-semibold">
                {day.date.toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              {day.entries.length === 0 ? (
                <p className="mt-5 text-xs text-[#8a939b]">No bookings</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {day.entries.map((entry) => {
                    const accepted = isTaskAccepted(entry);
                    return (
                      <a
                        key={entry.id}
                        href={`/professional/bookings/${entry.id}`}
                        className={`block rounded-xl border p-3 ${accepted ? "border-[#cde4a0] bg-[#f0f7e0]" : "border-[#fcd34d] bg-[#fef3c7]"}`}
                      >
                      <p className="text-xs font-semibold">{entry.serviceName}</p>
                      <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-[#59646e]">
                        <Clock3 className="size-3" />
                        {new Date(entry.startsAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 truncate text-[0.7rem] text-[#59646e]">
                        {entry.assignmentName}
                      </p>
                      <p className={`mt-1 text-[0.62rem] font-semibold ${isTaskAccepted(entry) ? "text-[#3d5a0a]" : "text-[#92400e]"}`}>
                        {isTaskAccepted(entry) ? "Accepted" : "Pending"}
                      </p>
                    </a>
                    );
                  })}
                </div>
              )}
            </Surface>
          ))}
        </div>
      ) : null}
      {entries?.length === 0 ? (
        <div className="mt-5 flex items-center gap-2 text-sm text-[#68717b]">
          <CalendarDays className="size-4" /> No confirmed bookings this week.
        </div>
      ) : null}
    </div>
  );
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
