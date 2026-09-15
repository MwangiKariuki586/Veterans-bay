"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Tag,
  UserRound,
  Wrench,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateTaskSheet } from "@/components/jobs/create-task-sheet";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  WorkspaceDrawer,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import type {
  AvailabilityConfiguration,
  BookingSlot,
  CalendarEntry,
} from "@/modules/bookings/types";
import {
  addAvailabilityBlock,
  bookingAction,
  getAvailability,
  getBooking,
  getBookingSlots,
  getCalendar,
  removeAvailabilityBlock,
  updateAvailabilityBlock,
  updateBookingTask,
} from "./booking-api";

const weekdaysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdaysLong = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const monthShort = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Kenya public holidays 2026 (subset) — treated as all-day unavailable
const PUBLIC_HOLIDAYS_2026: Array<{ date: string; label: string }> = [
  { date: "2026-01-01", label: "New Year's Day" },
  { date: "2026-04-03", label: "Good Friday" },
  { date: "2026-04-06", label: "Easter Monday" },
  { date: "2026-05-01", label: "Labour Day" },
  { date: "2026-06-01", label: "Madaraka Day" },
  { date: "2026-10-20", label: "Mashujaa Day" },
  { date: "2026-12-12", label: "Jamhuri Day" },
  { date: "2026-12-25", label: "Christmas Day" },
  { date: "2026-12-26", label: "Boxing Day" },
];

const SCHEDULABLE_STATUSES = [
  "PENDING_CONFIRMATION",
  "PENDING_DEPOSIT",
  "CONFIRMED",
  "RESCHEDULED",
  "RESCHEDULE_REQUESTED",
] as const;

function isSchedulableStatus(status?: string): boolean {
  return Boolean(
    status && (SCHEDULABLE_STATUSES as readonly string[]).includes(status),
  );
}

function getMemberHours(
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>,
): { startMinute: number; endMinute: number } {
  if (rules.length === 0) return { startMinute: 8 * 60, endMinute: 18 * 60 };
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rules) {
    if (r.startMinute < min) min = r.startMinute;
    if (r.endMinute > max) max = r.endMinute;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { startMinute: 8 * 60, endMinute: 18 * 60 };
  }
  return { startMinute: min, endMinute: max };
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 Sun
  const diff = (day + 6) % 7; // Mon=0
  d.setDate(d.getDate() - diff);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatRange(start: Date, end: Date): string {
  const sDay = start.getDate();
  const eDay = end.getDate();
  const sMon = monthShort[start.getMonth()];
  const eMon = monthShort[end.getMonth()];
  const year = end.getFullYear();
  if (sMon === eMon) return `${sDay} – ${eDay} ${eMon} ${year}`;
  return `${sDay} ${sMon} – ${eDay} ${eMon} ${year}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function minutesToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return m === 0
    ? `${hr}:00 ${period}`
    : `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function parseHolidaysForRange(
  start: Date,
  end: Date,
): Array<{ startsAt: string; endsAt: string; reason: string }> {
  return PUBLIC_HOLIDAYS_2026.filter((h) => {
    const d = new Date(h.date + "T00:00:00");
    return d >= start && d < end;
  }).map((h) => {
    const d = new Date(h.date + "T00:00:00");
    const next = addDays(d, 1);
    return {
      startsAt: d.toISOString(),
      endsAt: next.toISOString(),
      reason: `Public holiday · ${h.label}`,
    };
  });
}

type ScheduleEntry = {
  id: string;
  title: string;
  subtitle: string;
  description?: string | null;
  location?: string | null;
  scope?: string | null;
  startsAt: Date;
  endsAt: Date;
  kind: "task" | "blocked";
  accepted: boolean;
  raw?: CalendarEntry;
  blockRaw?: AvailabilityConfiguration["blocks"][number];
};

function isTaskAccepted(entry: CalendarEntry): boolean {
  const jobStatus = entry.jobStatus;
  if (jobStatus) {
    if (
      ["TEAM_ASSIGNED", "EN_ROUTE", "IN_PROGRESS", "COMPLETED"].includes(
        jobStatus,
      )
    )
      return true;
    if (
      [
        "ON_HOLD",
        "AWAITING_CLIENT_CONFIRMATION",
        "RETURN_VISIT_REQUIRED",
        "CREATED",
        "SCHEDULED",
        "DISPUTED",
        "CANCELLED",
      ].includes(jobStatus)
    )
      return false;
  }
  if (["CONFIRMED", "RESCHEDULED", "COMPLETED"].includes(entry.status))
    return true;
  return false;
}

function entryTone(kind: ScheduleEntry["kind"], accepted: boolean): string {
  if (kind === "task") {
    return accepted
      ? "bg-[#f0f7e0] border-[#cde4a0] text-[#3d5a0a]"
      : "bg-[#fef3c7] border-[#fcd34d] text-[#92400e]";
  }
  if (kind === "blocked") {
    return accepted
      ? "bg-[#fdeaea] border-[#f5c2c2] text-[#7a1a1a]"
      : "bg-[#f3f4f6] border-[#d1d5db] text-[#374151]";
  }
  return "bg-[#f3f1ff] border-[#d9d4f5] text-[#3b2e7a]";
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function DraggableEntry({
  entry,
  top,
  height,
  variant = "week",
  isPending = false,
  onEntryClick,
}: {
  entry: ScheduleEntry;
  top: number;
  height: number;
  variant?: "week" | "day";
  isPending?: boolean;
  onEntryClick?: (entry: ScheduleEntry) => void;
}) {
  const isSchedulable =
    entry.kind === "task" &&
    isSchedulableStatus(entry.raw?.status) &&
    !isPending;
  const isDraggable = isSchedulable;
  const isClickable =
    (entry.kind === "task" || entry.kind === "blocked") && !isPending;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: entry.id,
      disabled: !isDraggable,
      data: { entry, top, height },
    });
  const style: React.CSSProperties = {
    top: `${top}px`,
    height: `${height}px`,
    transform: CSS.Translate.toString(transform),
    opacity: isPending ? 0.6 : isDragging ? 0.45 : 1,
    zIndex: isDragging ? 30 : isPending ? 15 : 1,
    cursor: isPending
      ? "wait"
      : isDraggable
        ? "grab"
        : isClickable
          ? "pointer"
          : "default",
    touchAction: "none",
  };
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging) return;
    if (!isClickable) return;
    if (!onEntryClick) return;
    onEntryClick(entry);
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      data-draggable={isDraggable ? "true" : undefined}
      data-schedule-entry={entry.id}
      aria-busy={isPending}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && isClickable) {
          e.preventDefault();
          handleClick(e as unknown as React.MouseEvent);
        }
      }}
      className={`absolute inset-x-1 overflow-hidden rounded-[8px] border px-2 py-1 text-[0.68rem] leading-3 ${entryTone(entry.kind, entry.accepted)} ${isDraggable ? "hover:shadow-md active:cursor-grabbing hover:border-[#b5d46a] transition-shadow" : ""} ${isClickable && !isDraggable ? "hover:shadow-sm hover:border-black/15" : ""} ${isPending ? "animate-pulse border-dashed" : ""} ${variant === "day" ? "inset-x-2 px-3 py-2 text-xs" : ""}`}
      title={
        isPending
          ? "Rescheduling…"
          : isDraggable
            ? "Drag to reschedule or click for details (professional only)"
            : isClickable
              ? "Click for details"
              : undefined
      }
    >
      <p className="truncate font-semibold flex items-center gap-1.5">
        {isPending ? (
          <span
            className="inline-block size-2.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {entry.title}
        {isPending ? (
          <span className="text-[0.62rem] font-normal opacity-80">
            Rescheduling…
          </span>
        ) : null}
      </p>
      <p className="truncate text-[0.62rem] opacity-80">{entry.subtitle}</p>
    </div>
  );
}

function DroppableDay({
  day,
  children,
  onSlotClick,
  isDragging = false,
  workingHours,
}: {
  day: Date;
  children: React.ReactNode;
  onSlotClick?: (start: Date, end: Date) => void;
  isDragging?: boolean;
  workingHours: { startMinute: number; endMinute: number };
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day.toISOString() });
  const handleClick = (e: React.MouseEvent) => {
    if (!onSlotClick || isDragging) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("[data-schedule-entry]") ||
      target.closest("button") ||
      target.closest("[data-no-create]")
    )
      return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hourHeight = 52;
    const startHour = Math.floor(workingHours.startMinute / 60);
    const minutesFromStart = Math.floor(((y / hourHeight) * 60) / 30) * 30;
    const totalMin = startHour * 60 + minutesFromStart;
    if (
      totalMin < workingHours.startMinute ||
      totalMin >= workingHours.endMinute
    ) {
      toast.error("Outside working hours", {
        description: `Choose within ${minutesToLabel(workingHours.startMinute)} – ${minutesToLabel(workingHours.endMinute)}.`,
      });
      return;
    }
    const start = new Date(day);
    start.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    if (start.getTime() < Date.now()) {
      toast.error("Cannot schedule in the past", {
        description: "Choose a future slot.",
      });
      return;
    }
    onSlotClick(start, end);
  };
  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`relative border-r border-black/6 last:border-r-0 ${isOver ? "bg-[#f0f7e0]/40" : ""} ${onSlotClick ? "cursor-pointer" : ""}`}
    >
      {children}
    </div>
  );
}

function generateAvailableSlots(
  day: Date,
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>,
  busy: Array<{ startsAt: Date; endsAt: Date }>,
): Array<{ start: Date; end: Date }> {
  const weekday = day.getDay();
  const dayRules = rules.filter((r) => r.weekday === weekday);
  if (dayRules.length === 0) return [];
  const slots: Array<{ start: Date; end: Date }> = [];
  const isHoliday = busy.some(
    (b) =>
      b.startsAt.getHours() === 0 &&
      b.endsAt.getHours() === 0 &&
      localDateKey(b.startsAt) === localDateKey(day),
  );
  if (isHoliday) return [];
  const now = Date.now();
  for (const rule of dayRules) {
    for (let m = rule.startMinute; m + 60 <= rule.endMinute; m += 30) {
      const s = new Date(day);
      s.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const e = new Date(s.getTime() + 60 * 60 * 1000);
      if (s.getTime() <= now) continue;
      if (busy.some((b) => overlaps(s, e, b.startsAt, b.endsAt))) continue;
      // dedupe
      if (slots.some((existing) => existing.start.getTime() === s.getTime()))
        continue;
      slots.push({ start: s, end: e });
    }
  }
  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function AvailabilitySchedule() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const requestedMemberId = searchParams.get("memberId");
  const [view, setView] = useState<"Day" | "Week" | "Month">("Week");
  const [anchor, setAnchor] = useState<Date>(() =>
    startOfWeekMonday(new Date()),
  );

  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    error: configErr,
  } = useQuery({
    queryKey: ["availability-schedule-config"],
    queryFn: getAvailability,
    staleTime: 30_000,
  });

  const selectedMember = useMemo(() => {
    if (!config) return null;
    if (requestedMemberId)
      return (
        config.members.find((m) => m.membershipId === requestedMemberId) ??
        config.members[0] ??
        null
      );
    return config.members[0] ?? null;
  }, [config, requestedMemberId]);

  const membershipId = selectedMember?.membershipId;

  // Derive week range
  const weekStart = useMemo(
    () =>
      view === "Day"
        ? new Date(anchor)
        : view === "Month"
          ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
          : startOfWeekMonday(anchor),
    [anchor, view],
  );
  const weekEndExclusive = useMemo(() => {
    if (view === "Day") return addDays(weekStart, 1);
    if (view === "Month")
      return new Date(weekStart.getFullYear(), weekStart.getMonth() + 1, 1);
    return addDays(weekStart, 7);
  }, [weekStart, view]);

  const weekEndInclusive = useMemo(
    () => addDays(weekEndExclusive, -1),
    [weekEndExclusive],
  );

  const calendarQuery = useQuery({
    queryKey: [
      "availability-calendar",
      membershipId,
      weekStart.toISOString(),
      weekEndExclusive.toISOString(),
      view,
    ],
    queryFn: () => getCalendar(weekStart, weekEndExclusive, membershipId),
    enabled: Boolean(membershipId),
    staleTime: 30_000,
  });

  // Prefetch adjacent weeks (Week view only, per spec)
  const prefetchAdjacent = (base: Date) => {
    if (view !== "Week" || !membershipId) return;
    const prevStart = addDays(base, -7);
    const prevEnd = base;
    const nextStart = addDays(base, 7);
    const nextEnd = addDays(nextStart, 7);
    void queryClient.prefetchQuery({
      queryKey: [
        "availability-calendar",
        membershipId,
        prevStart.toISOString(),
        prevEnd.toISOString(),
        view,
      ],
      queryFn: () => getCalendar(prevStart, prevEnd, membershipId),
      staleTime: 30_000,
    });
    void queryClient.prefetchQuery({
      queryKey: [
        "availability-calendar",
        membershipId,
        nextStart.toISOString(),
        nextEnd.toISOString(),
        view,
      ],
      queryFn: () => getCalendar(nextStart, nextEnd, membershipId),
      staleTime: 30_000,
    });
  };

  const entries: ScheduleEntry[] = useMemo(() => {
    const result: ScheduleEntry[] = [];
    const cal = calendarQuery.data ?? [];
    for (const c of cal) {
      const s = new Date(c.startsAt);
      const e = new Date(c.endsAt);
      const accepted = isTaskAccepted(c);
      result.push({
        id: c.id,
        title: c.serviceName,
        subtitle: c.assignmentName || c.clientName,
        location: (c as CalendarEntry).location ?? null,
        scope: (c as CalendarEntry).scope ?? null,
        description: c.status,
        startsAt: s,
        endsAt: e,
        kind: "task",
        accepted,
        raw: c,
      });
    }
    if (config && membershipId) {
      const blocks = config.blocks.filter(
        (b) => b.membershipId === membershipId,
      );
      for (const b of blocks) {
        const s = new Date(b.startsAt);
        const e = new Date(b.endsAt);
        if (e <= weekStart || s >= weekEndExclusive) continue;
        const accepted = (b.status ?? "ACCEPTED") === "ACCEPTED";
        result.push({
          id: b.id,
          title: b.reason,
          subtitle: b.description
            ? b.description
            : accepted
              ? "Blocked time"
              : "Tentative",
          description: b.description ?? null,
          location: null,
          startsAt: s,
          endsAt: e,
          kind: "blocked",
          accepted,
          blockRaw: b,
        });
      }
      // holidays mapped to blocked accepted all-day
      for (const h of parseHolidaysForRange(weekStart, weekEndExclusive)) {
        const s = new Date(h.startsAt);
        const e = new Date(h.endsAt);
        result.push({
          id: `holiday-${h.startsAt}`,
          title: "Unavailable",
          subtitle: h.reason,
          startsAt: s,
          endsAt: e,
          kind: "blocked",
          accepted: true,
          blockRaw: {
            id: `holiday-${h.startsAt}`,
            membershipId: membershipId ?? "",
            memberName: "",
            startsAt: h.startsAt,
            endsAt: h.endsAt,
            reason: h.reason,
            status: "ACCEPTED",
          } as AvailabilityConfiguration["blocks"][number],
        });
      }
    }
    return result.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }, [calendarQuery.data, config, membershipId, weekStart, weekEndExclusive]);

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeId) ?? null,
    [entries, activeId],
  );

  const bookingCount = useMemo(
    () => entries.filter((e) => e.kind === "task").length,
    [entries],
  );
  const isCurrentViewEmpty =
    !calendarQuery.isLoading &&
    !calendarQuery.isError &&
    bookingCount === 0 &&
    (view === "Week" || view === "Day");

  const nextBookingsQuery = useQuery({
    queryKey: [
      "availability-calendar-next",
      membershipId,
      weekEndExclusive.toISOString(),
    ],
    queryFn: async () => {
      if (!membershipId) return [] as CalendarEntry[];
      const end = addDays(weekEndExclusive, 30);
      return getCalendar(weekEndExclusive, end, membershipId);
    },
    enabled: Boolean(membershipId && isCurrentViewEmpty),
    staleTime: 30_000,
  });
  const nextBooking = useMemo(() => {
    const list = nextBookingsQuery.data ?? [];
    if (list.length === 0) return null;
    return [...list].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
  }, [nextBookingsQuery.data]);

  // Detail drawer for clicking blocked/task — inline edit form
  const [detailEntry, setDetailEntry] = useState<ScheduleEntry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const openDetail = (entry: ScheduleEntry) => {
    if (entry.id.startsWith("holiday-")) return;
    // eslint-disable-next-line react-hooks/purity -- guarded drag debounce, not render
    if (Date.now() - lastDragAtRef.current < 500) return;
    setDetailEntry(entry);
    setDetailOpen(true);
    setDetailEditMode(false);
    if (entry.kind === "task") {
      setEditTaskDraft({
        id: entry.id,
        location: entry.location ?? "",
        scope: entry.scope ?? "",
      });
      // If calendar entry lacks scope (stale cache), warm it in background so Edit is instant.
      if (!entry.scope) {
        void getBooking("professional", entry.id)
          .then((full) => {
            const freshScope =
              (full as unknown as { scope?: string }).scope ?? "";
            const freshLocation =
              (full as unknown as { location?: string | null }).location ??
              entry.location ??
              "";
            if (!freshScope && !freshLocation) return;
            setEditTaskDraft((prev) => {
              if (!prev || prev.id !== entry.id) return prev;
              // Only hydrate empty fields; don't overwrite user input if already editing.
              if (prev.scope !== "" || prev.location !== (entry.location ?? ""))
                return prev;
              return {
                id: entry.id,
                location: freshLocation,
                scope: freshScope,
              };
            });
            // Hydrate the cached calendar entry itself so scope is present next time.
            setDetailEntry((prev) =>
              prev && prev.id === entry.id
                ? { ...prev, location: freshLocation, scope: freshScope }
                : prev,
            );
          })
          .catch(() => {});
      }
    } else if (entry.kind === "blocked" && entry.blockRaw) {
      const b = entry.blockRaw;
      const toLocal = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setEditBlockDraft({
        id: b.id,
        name: b.reason,
        description: b.description ?? "",
        start: toLocal(b.startsAt),
        end: toLocal(b.endsAt),
        status: (b.status as "PENDING" | "ACCEPTED") ?? "ACCEPTED",
      });
    }
  };

  const handleStartEdit = () => {
    if (!detailEntry) return;
    if (detailEntry.kind === "task") {
      // Show form instantly; calendar now carries scope so no fetch is required in the common case.
      const initialScope = detailEntry.scope ?? "";
      const initialLocation = detailEntry.location ?? "";
      setEditTaskDraft({
        id: detailEntry.id,
        location: initialLocation,
        scope: initialScope,
      });
      setDetailEditMode(true);
      if (!initialScope) {
        void getBooking("professional", detailEntry.id)
          .then((full) => {
            const freshLocation =
              (full as unknown as { location?: string | null }).location ??
              initialLocation;
            const freshScope =
              (full as unknown as { scope?: string }).scope ?? "";
            if (!freshScope && !freshLocation) return;
            setEditTaskDraft((prev) => {
              if (!prev || prev.id !== detailEntry.id) return prev;
              const locationDirty = prev.location !== initialLocation;
              const scopeDirty = prev.scope !== initialScope;
              if (locationDirty && scopeDirty) return prev;
              return {
                id: prev.id,
                location: locationDirty ? prev.location : freshLocation,
                scope: scopeDirty ? prev.scope : freshScope,
              };
            });
            setDetailEntry((prev) =>
              prev && prev.id === detailEntry.id
                ? { ...prev, location: freshLocation, scope: freshScope }
                : prev,
            );
          })
          .catch(() => {});
      }
      return;
    }
    if (detailEntry.kind === "blocked" && detailEntry.blockRaw) {
      const b = detailEntry.blockRaw;
      const toLocal = (iso: string) => {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setEditBlockDraft({
        id: b.id,
        name: b.reason,
        description: b.description ?? "",
        start: toLocal(b.startsAt),
        end: toLocal(b.endsAt),
        status: (b.status as "PENDING" | "ACCEPTED") ?? "ACCEPTED",
      });
      setDetailEditMode(true);
      return;
    }
    setDetailEditMode(true);
  };

  // Inline reschedule picker (click + drag pre-filled)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerEntry, setPickerEntry] = useState<ScheduleEntry | null>(null);
  const [pickerPreselected, setPickerPreselected] = useState<{
    membershipId: string;
    startsAt: string;
  } | null>(null);
  const [pickerSelectedSlot, setPickerSelectedSlot] =
    useState<BookingSlot | null>(null);
  const [pickerNote, setPickerNote] = useState("");
  const [pickerError, setPickerError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const memberRules = useMemo(
    () => config?.rules.filter((r) => r.membershipId === membershipId) ?? [],
    [config, membershipId],
  );
  const workingHours = useMemo(
    () => getMemberHours(memberRules),
    [memberRules],
  );

  const pickerSlotsQuery = useQuery({
    queryKey: ["booking-slots", pickerEntry?.id],
    queryFn: () => {
      if (!pickerEntry?.id) throw new Error("No booking selected");
      return getBookingSlots("professional", pickerEntry.id);
    },
    enabled: Boolean(pickerEntry?.id && pickerOpen),
    staleTime: 30_000,
  });

  const lastDragAtRef = useRef(0);

  const openPicker = (
    entry: ScheduleEntry,
    preselected?: { membershipId: string; startsAt: string } | null,
  ) => {
    if (!preselected && Date.now() - lastDragAtRef.current < 500) return;
    if (!entry.raw) return;
    if (!isSchedulableStatus(entry.raw.status)) {
      toast.info("Not reschedulable", {
        description: `Status ${entry.raw.status} cannot be moved from the calendar.`,
      });
      return;
    }
    setPickerEntry(entry);
    setPickerPreselected(preselected ?? null);
    setPickerSelectedSlot(null);
    setPickerNote("");
    setPickerError(null);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    setPickerEntry(null);
    setPickerPreselected(null);
    setPickerSelectedSlot(null);
    setPickerNote("");
    setPickerError(null);
  };

  // Auto-select preselected/requested slot once slots load (derived, no effect setState)
  const autoSelectedSlot = useMemo(() => {
    if (!pickerOpen || !pickerSlotsQuery.data || pickerSelectedSlot)
      return null;
    if (pickerPreselected) {
      const match = pickerSlotsQuery.data.find(
        (s) =>
          s.membershipId === pickerPreselected.membershipId &&
          s.startsAt === pickerPreselected.startsAt,
      );
      if (match) return match;
    }
    if (pickerEntry?.raw?.status === "RESCHEDULE_REQUESTED") {
      const req = pickerEntry.raw as unknown as {
        requestedStartAt?: string | null;
        requestedMembershipId?: string | null;
      };
      if (req.requestedStartAt && req.requestedMembershipId) {
        const reqMatch = pickerSlotsQuery.data.find(
          (s) =>
            s.startsAt === req.requestedStartAt &&
            s.membershipId === req.requestedMembershipId,
        );
        if (reqMatch) return reqMatch;
      }
    }
    return null;
  }, [
    pickerOpen,
    pickerPreselected,
    pickerSlotsQuery.data,
    pickerEntry,
    pickerSelectedSlot,
  ]);
  const effectivePickerSlot = pickerSelectedSlot ?? autoSelectedSlot;

  const acceptTaskMutation = useMutation({
    mutationFn: async ({
      bookingId,
      membershipId: mId,
      startsAt,
      lockVersion,
    }: {
      bookingId: string;
      membershipId: string;
      startsAt: string;
      lockVersion: number;
    }) => {
      return bookingAction("professional", bookingId, "confirm", {
        lockVersion,
        membershipId: mId,
        startsAt,
        cancellationPolicyAcknowledged: true,
      });
    },
    onMutate: async ({ bookingId }) => {
      await queryClient.cancelQueries({
        queryKey: ["availability-calendar", membershipId],
      });
      await queryClient.cancelQueries({ queryKey: ["availability-calendar"] });
      const key = [
        "availability-calendar",
        membershipId,
        weekStart.toISOString(),
        weekEndExclusive.toISOString(),
        view,
      ] as const;
      const previous = queryClient.getQueryData<CalendarEntry[]>(key);
      // optimistic: mark task accepted immediately
      queryClient.setQueryData<CalendarEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === bookingId
            ? {
                ...c,
                status: "CONFIRMED" as const,
                jobStatus: "TEAM_ASSIGNED" as const,
              }
            : c,
        );
      });
      // also update entries-derived detail if open
      setDetailEntry((prev) =>
        prev && prev.id === bookingId
          ? {
              ...prev,
              accepted: true,
              raw: prev.raw
                ? {
                    ...prev.raw,
                    status: "CONFIRMED" as const,
                    jobStatus: "TEAM_ASSIGNED" as const,
                  }
                : prev.raw,
            }
          : prev,
      );
      setPendingId(bookingId);
      toast.loading("Accepting task…", { id: `accept-${bookingId}` });
      return { previous, key };
    },
    onError: (err, vars, context) => {
      const ctx = context as
        | { previous?: CalendarEntry[]; key?: readonly unknown[] }
        | undefined;
      if (ctx?.previous && ctx?.key)
        queryClient.setQueryData(ctx.key as unknown[], ctx.previous);
      // rollback detail accepted
      setDetailEntry((prev) =>
        prev && prev.id === vars.bookingId
          ? { ...prev, accepted: false }
          : prev,
      );
      const message = err instanceof Error ? err.message : "Failed";
      const isPast = message.toLowerCase().includes("future");
      const isUnavailable =
        message.toLowerCase().includes("no longer available") ||
        message.toLowerCase().includes("conflict");
      toast.error("Could not accept task", {
        id: `accept-${vars.bookingId}`,
        description: message,
      });
      if (isPast || isUnavailable) {
        const entry = entries.find((e) => e.id === vars.bookingId);
        if (entry) {
          setDetailOpen(false);
          setTimeout(() => openPicker(entry), 300);
        }
      }
    },
    onSuccess: (_data, vars) => {
      toast.success("Task accepted", { id: `accept-${vars.bookingId}` });
      setDetailOpen(false);
    },
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability-schedule-config"],
      });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({
      bookingId,
      membershipId: mId,
      startsAt,
      lockVersion,
      note,
    }: {
      bookingId: string;
      membershipId: string;
      startsAt: string;
      lockVersion: number;
      note?: string;
    }) => {
      const rawStatus = pickerEntry?.raw?.status;
      const isReschedule =
        rawStatus === "RESCHEDULE_REQUESTED" ||
        rawStatus === "CONFIRMED" ||
        rawStatus === "RESCHEDULED";
      const payload: Record<string, unknown> = {
        lockVersion,
        membershipId: mId,
        startsAt,
        cancellationPolicyAcknowledged: true,
      };
      if (note) payload.note = note;
      const action = isReschedule ? "reschedule" : "confirm";
      return bookingAction("professional", bookingId, action, payload);
    },
    onMutate: async ({ bookingId, startsAt }) => {
      const key = [
        "availability-calendar",
        membershipId,
        weekStart.toISOString(),
        weekEndExclusive.toISOString(),
        view,
      ] as const;
      await queryClient.cancelQueries({
        queryKey: ["availability-calendar", membershipId],
      });
      const previous = queryClient.getQueryData<CalendarEntry[]>(key);
      const original = entries.find((e) => e.id === bookingId);
      const duration = original
        ? original.endsAt.getTime() - original.startsAt.getTime()
        : 60 * 60000;
      const newStart = new Date(startsAt);
      const newEnd = new Date(newStart.getTime() + duration);
      queryClient.setQueryData<CalendarEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === bookingId
            ? {
                ...c,
                startsAt: newStart.toISOString(),
                endsAt: newEnd.toISOString(),
              }
            : c,
        );
      });
      setPendingId(bookingId);
      toast.loading("Rescheduling…", {
        id: `reschedule-${bookingId}`,
        description: `Moving to ${newStart.toLocaleString()}`,
      });
      return { previous, key };
    },
    onError: (err, variables, context) => {
      const ctx = context as
        | { previous?: CalendarEntry[]; key?: readonly unknown[] }
        | undefined;
      if (ctx?.previous && ctx?.key) {
        queryClient.setQueryData(ctx.key as unknown[], ctx.previous);
      }
      const message =
        err instanceof Error
          ? err.message
          : "That time is no longer available. Rolled back.";
      setPickerError(message);
      toast.error("Reschedule failed", {
        id: `reschedule-${variables.bookingId}`,
        description: message,
      });
    },
    onSuccess: (_data, variables) => {
      toast.success("Booking rescheduled", {
        id: `reschedule-${variables.bookingId}`,
        description: `Moved to ${new Date(variables.startsAt).toLocaleString()}`,
      });
      closePicker();
    },
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability-schedule-config"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["booking-slots"],
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    lastDragAtRef.current = Date.now();
    const { active, over, delta } = event;
    if (!over || !active) return;
    const entry = entries.find((e) => e.id === active.id);
    if (!entry || entry.kind !== "task" || !entry.raw) return;
    if (!isSchedulableStatus(entry.raw.status)) {
      toast.error("Not reschedulable", {
        description: `Bookings with status ${entry.raw.status} cannot be dragged. Click to view details.`,
      });
      return;
    }
    const overDay = new Date(over.id as string);
    if (Number.isNaN(overDay.getTime())) return;
    const startHour = Math.floor(workingHours.startMinute / 60);
    const hourHeight = 52;
    const originalTop =
      ((entry.startsAt.getHours() * 60 +
        entry.startsAt.getMinutes() -
        startHour * 60) *
        hourHeight) /
      60;
    const newTop = originalTop + delta.y;
    const newStartMin =
      Math.round((startHour * 60 + (newTop / hourHeight) * 60) / 30) * 30;
    const durationMin = Math.round(
      (entry.endsAt.getTime() - entry.startsAt.getTime()) / 60000,
    );
    const newStart = new Date(overDay);
    newStart.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);
    if (
      newStartMin < workingHours.startMinute ||
      newStartMin + durationMin > workingHours.endMinute
    ) {
      toast.error("Outside working hours", {
        description: `Drop within ${minutesToLabel(workingHours.startMinute)} – ${minutesToLabel(workingHours.endMinute)}.`,
      });
      return;
    }
    if (newStart.getTime() < Date.now()) {
      toast.error("Cannot schedule in the past", {
        description: "Choose a future slot.",
      });
      return;
    }
    if (!membershipId) return;
    // Open inline picker pre-filled to dragged slot — user confirms with required note
    openPicker(entry, {
      membershipId,
      startsAt: newStart.toISOString(),
    });
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<{
    start: string;
    end: string;
    name: string;
    description: string;
    status: "PENDING" | "ACCEPTED";
  } | null>(null);
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [editBlockDraft, setEditBlockDraft] = useState<{
    id: string;
    name: string;
    description: string;
    start: string;
    end: string;
    status: "PENDING" | "ACCEPTED";
  } | null>(null);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editTaskDraft, setEditTaskDraft] = useState<{
    id: string;
    location: string;
    scope: string;
  } | null>(null);

  const openCreate = (start: Date, end: Date) => {
    const toLocalInput = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setCreateDraft({
      start: toLocalInput(start),
      end: toLocalInput(end),
      name: "Blocked time",
      description: "",
      status: "ACCEPTED",
    });
    setCreateOpen(true);
  };

  const createBlockMutation = useMutation({
    mutationFn: async (vars: {
      start: string;
      end: string;
      name: string;
      description?: string;
      status: "PENDING" | "ACCEPTED";
    }) => {
      if (!membershipId) throw new Error("No member selected");
      return addAvailabilityBlock({
        membershipId,
        startsAt: new Date(vars.start).toISOString(),
        endsAt: new Date(vars.end).toISOString(),
        reason: vars.name,
        status: vars.status,
        ...(vars.description?.trim()
          ? { description: vars.description.trim() }
          : {}),
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: ["availability-schedule-config"],
      });
      const previous = queryClient.getQueryData<AvailabilityConfiguration>([
        "availability-schedule-config",
      ]);
      const optimisticBlock = {
        id: `optimistic-${Date.now()}`,
        membershipId: membershipId!,
        memberName: selectedMember?.displayName ?? "You",
        startsAt: new Date(vars.start).toISOString(),
        endsAt: new Date(vars.end).toISOString(),
        reason: vars.name,
        description: vars.description,
        status: vars.status,
      } as AvailabilityConfiguration["blocks"][number];
      queryClient.setQueryData<AvailabilityConfiguration>(
        ["availability-schedule-config"],
        (old) => {
          if (!old) return old;
          return { ...old, blocks: [...old.blocks, optimisticBlock] };
        },
      );
      setCreateOpen(false);
      toast.loading("Creating blocked time…", {
        id: "create-block",
        description: `${new Date(vars.start).toLocaleString()} → ${new Date(vars.end).toLocaleString()}`,
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      if ((context as { previous?: AvailabilityConfiguration })?.previous) {
        queryClient.setQueryData(
          ["availability-schedule-config"],
          (context as { previous: AvailabilityConfiguration }).previous,
        );
      }
      toast.error("Could not create blocked time", {
        id: "create-block",
        description:
          err instanceof Error
            ? err.message
            : "Failed to create — rolled back.",
      });
    },
    onSuccess: () => {
      toast.success("Blocked time created", {
        id: "create-block",
        description: "Slot is now blocked and visible on the calendar.",
      });
      setCreateDraft(null);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["availability-schedule-config"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      return removeAvailabilityBlock(blockId);
    },
    onMutate: async (blockId) => {
      await queryClient.cancelQueries({
        queryKey: ["availability-schedule-config"],
      });
      const prev = queryClient.getQueryData<AvailabilityConfiguration>([
        "availability-schedule-config",
      ]);
      queryClient.setQueryData<AvailabilityConfiguration>(
        ["availability-schedule-config"],
        (old) => {
          if (!old) return old;
          return { ...old, blocks: old.blocks.filter((b) => b.id !== blockId) };
        },
      );
      toast.loading("Removing blocked time…", {
        id: `delete-block-${blockId}`,
      });
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if ((ctx as { prev?: AvailabilityConfiguration })?.prev) {
        queryClient.setQueryData(
          ["availability-schedule-config"],
          (ctx as { prev: AvailabilityConfiguration }).prev,
        );
      }
      toast.error("Could not remove blocked time", {
        id: `delete-block-${_id}`,
        description:
          err instanceof Error ? err.message : "Failed — rolled back.",
      });
    },
    onSuccess: () => {
      toast.success("Blocked time removed", {
        id: `delete-block-${detailEntry?.id}`,
      });
      setDetailOpen(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["availability-schedule-config"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
    },
  });

  const updateBlockMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      name: string;
      description?: string;
      start: string;
      end: string;
      status: "PENDING" | "ACCEPTED";
    }) => {
      if (!membershipId) throw new Error("No member selected");
      return updateAvailabilityBlock(vars.id, {
        membershipId,
        startsAt: new Date(vars.start).toISOString(),
        endsAt: new Date(vars.end).toISOString(),
        reason: vars.name,
        status: vars.status,
        ...(vars.description?.trim()
          ? { description: vars.description.trim() }
          : { description: undefined }),
      });
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({
        queryKey: ["availability-schedule-config"],
      });
      const prev = queryClient.getQueryData<AvailabilityConfiguration>([
        "availability-schedule-config",
      ]);
      queryClient.setQueryData<AvailabilityConfiguration>(
        ["availability-schedule-config"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            blocks: old.blocks.map((b) =>
              b.id === vars.id
                ? ({
                    ...b,
                    reason: vars.name,
                    description: vars.description,
                    startsAt: new Date(vars.start).toISOString(),
                    endsAt: new Date(vars.end).toISOString(),
                    status: vars.status,
                  } as typeof b)
                : b,
            ),
          };
        },
      );
      // immediate drawer reflects edit
      const prevDetail = detailEntry;
      setDetailEntry((prev) => {
        if (!prev || prev.id !== vars.id) return prev;
        const s = new Date(vars.start);
        const e = new Date(vars.end);
        const accepted = vars.status === "ACCEPTED";
        return {
          ...prev,
          title: vars.name,
          subtitle:
            vars.description ?? (accepted ? "Blocked time" : "Tentative"),
          description: vars.description ?? null,
          startsAt: s,
          endsAt: e,
          accepted,
          blockRaw: prev.blockRaw
            ? {
                ...prev.blockRaw,
                reason: vars.name,
                description: vars.description ?? null,
                startsAt: s.toISOString(),
                endsAt: e.toISOString(),
                status: vars.status as "PENDING" | "ACCEPTED",
              }
            : prev.blockRaw,
        };
      });
      toast.loading("Updating blocked time…", {
        id: `update-block-${vars.id}`,
      });
      return { prev, prevDetail };
    },
    onError: (err, vars, ctx) => {
      const c = ctx as
        | {
            prev?: AvailabilityConfiguration;
            prevDetail?: ScheduleEntry | null;
          }
        | undefined;
      if (c?.prev) {
        queryClient.setQueryData(["availability-schedule-config"], c.prev);
      }
      if (c?.prevDetail) setDetailEntry(c.prevDetail);
      toast.error("Could not update blocked time", {
        id: `update-block-${vars.id}`,
        description:
          err instanceof Error ? err.message : "Failed — rolled back.",
      });
    },
    onSuccess: () => {
      toast.success("Blocked time updated", {
        id: `update-block-${editBlockDraft?.id}`,
      });
      setDetailEditMode(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["availability-schedule-config"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      location: string;
      scope: string;
    }) => {
      return updateBookingTask(vars.id, {
        location: vars.location,
        scope: vars.scope,
      });
    },
    onMutate: async (vars) => {
      const key = [
        "availability-calendar",
        membershipId,
        weekStart.toISOString(),
        weekEndExclusive.toISOString(),
        view,
      ] as const;
      await queryClient.cancelQueries({
        queryKey: ["availability-calendar", membershipId],
      });
      const prev = queryClient.getQueryData<CalendarEntry[]>(key);
      const prevDetail = detailEntry;
      queryClient.setQueryData<CalendarEntry[]>(key, (old) => {
        if (!old) return old;
        return old.map((c) =>
          c.id === vars.id
            ? { ...c, location: vars.location, scope: vars.scope }
            : c,
        );
      });
      // immediate drawer update
      setDetailEntry((prev) =>
        prev && prev.id === vars.id
          ? { ...prev, location: vars.location, scope: vars.scope }
          : prev,
      );
      toast.loading("Updating task…", { id: `update-task-${vars.id}` });
      return { prev, key, prevDetail };
    },
    onError: (err, vars, ctx) => {
      const c = ctx as
        | {
            prev?: CalendarEntry[];
            key?: readonly unknown[];
            prevDetail?: ScheduleEntry | null;
          }
        | undefined;
      if (c?.prev && c?.key)
        queryClient.setQueryData(c.key as unknown[], c.prev);
      if (c?.prevDetail) setDetailEntry(c.prevDetail);
      toast.error("Could not update task", {
        id: `update-task-${vars.id}`,
        description:
          err instanceof Error ? err.message : "Failed — rolled back.",
      });
    },
    onSuccess: (_data, vars) => {
      toast.success("Task updated", { id: `update-task-${vars.id}` });
      setDetailEditMode(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["availability-calendar"],
      });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
    },
  });

  const hours = useMemo(() => {
    let startH = Math.floor(workingHours.startMinute / 60);
    let endH = Math.ceil(workingHours.endMinute / 60);
    for (const e of entries) {
      if (e.startsAt < weekEndExclusive && e.endsAt > weekStart) {
        const sh = e.startsAt.getHours();
        const eh = Math.ceil(
          (e.endsAt.getHours() * 60 + e.endsAt.getMinutes()) / 60,
        );
        if (sh < startH) startH = sh;
        if (eh > endH) endH = eh;
      }
    }
    startH = Math.max(0, Math.min(23, startH));
    endH = Math.max(startH + 1, Math.min(24, endH));
    return Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  }, [workingHours, entries, weekStart, weekEndExclusive]);

  // Prefetch adjacent week when calendar succeeds — must be before early returns to keep hook order stable
  useEffect(() => {
    if (calendarQuery.isSuccess) prefetchAdjacent(anchor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarQuery.isSuccess, anchor]);

  if (configLoading) {
    return (
      <div className="pt-1" aria-busy="true" aria-label="Loading schedule">
        <Skeleton className="h-4 w-24 rounded-full" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <Skeleton className="size-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-lg" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-5 w-20 rounded-lg" />
          <Skeleton className="h-3 w-64 rounded-lg" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Skeleton className="size-9 rounded-[9px]" />
          <Skeleton className="h-9 w-16 rounded-[9px]" />
          <Skeleton className="size-9 rounded-[9px]" />
          <Skeleton className="ml-2 h-4 w-40 rounded-lg" />
          <div className="ml-auto flex gap-1 rounded-full border border-black/8 p-1">
            <Skeleton className="h-7 w-12 rounded-full" />
            <Skeleton className="h-7 w-12 rounded-full" />
            <Skeleton className="h-7 w-14 rounded-full" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-[15px] border border-black/8 bg-white">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-black/6 bg-[#fbfcfd] px-2 py-2">
            <div />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 py-1">
                <Skeleton className="h-3 w-8 rounded" />
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[56px_repeat(7,1fr)]">
            <div className="border-r border-black/6 bg-[#fbfcfd]">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[52px] border-b border-black/5 px-2 py-2">
                  <Skeleton className="h-3 w-10 rounded" />
                </div>
              ))}
            </div>
            {Array.from({ length: 7 }).map((_, col) => (
              <div key={col} className="relative border-r border-black/6 last:border-r-0">
                {Array.from({ length: 8 }).map((_, r) => (
                  <div key={r} className="h-[52px] border-b border-black/5" />
                ))}
                {col === 1 ? <Skeleton className="absolute inset-x-1 top-[52px] h-[62px] rounded-[8px]" /> : null}
                {col === 3 ? <Skeleton className="absolute inset-x-1 top-[156px] h-[52px] rounded-[8px]" /> : null}
                {col === 5 ? <Skeleton className="absolute inset-x-1 top-[104px] h-[72px] rounded-[8px]" /> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-3 w-32 rounded-full" />
          <Skeleton className="h-3 w-32 rounded-full" />
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="mt-3 h-[140px] rounded-[12px]" />
          </div>
          <div>
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="mt-3 h-[140px] rounded-[12px]" />
          </div>
        </div>
      </div>
    );
  }
  if (configError) {
    return (
      <InlineAlert
        className="mt-6"
        variant="error"
        title="Schedule unavailable"
        description={
          configErr instanceof Error
            ? configErr.message
            : "Schedule could not be loaded."
        }
      />
    );
  }
  if (!selectedMember) {
    return (
      <StatePanel
        className="mt-6"
        variant="empty"
        title="No team member"
        description="No assignable member found for this workspace."
      />
    );
  }

  const memberBlocks =
    config?.blocks
      .filter((b) => b.membershipId === membershipId)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)) ?? [];
  const upcoming = [
    ...memberBlocks,
    ...parseHolidaysForRange(new Date(), addDays(new Date(), 30)).map(
      (h) =>
        ({
          id: h.startsAt,
          reason: h.reason,
          startsAt: h.startsAt,
          endsAt: h.endsAt,
          membershipId: membershipId!,
        }) as unknown as (typeof memberBlocks)[number],
    ),
  ]
    .filter((b) => new Date(b.endsAt) > new Date())
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 3);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1)
      router.back();
    else router.push("/professional/team");
  };

  const goToday = () =>
    setAnchor(
      view === "Month"
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : view === "Day"
          ? new Date(new Date().setHours(0, 0, 0, 0))
          : startOfWeekMonday(new Date()),
    );
  const goPrev = () => {
    if (view === "Day") setAnchor((d) => addDays(d, -1));
    else if (view === "Month") setAnchor((d) => addMonths(d, -1));
    else setAnchor((d) => addDays(d, -7));
    if (view === "Week") prefetchAdjacent(addDays(anchor, -7));
  };
  const goNext = () => {
    if (view === "Day") setAnchor((d) => addDays(d, 1));
    else if (view === "Month") setAnchor((d) => addMonths(d, 1));
    else setAnchor((d) => addDays(d, 7));
    if (view === "Week") prefetchAdjacent(addDays(anchor, 7));
  };

  const pickerIsReschedule =
    pickerEntry?.raw?.status === "RESCHEDULE_REQUESTED" ||
    pickerEntry?.raw?.status === "CONFIRMED" ||
    pickerEntry?.raw?.status === "RESCHEDULED";
  const pickerRequiresNote = pickerIsReschedule;
  const pickerNoteValid = pickerNote.trim().length >= 3;
  const pickerCanSubmit = Boolean(
    pickerEntry &&
    effectivePickerSlot &&
    (!pickerRequiresNote || pickerNoteValid) &&
    !rescheduleMutation.isPending,
  );

  const handlePickerConfirm = () => {
    if (!pickerEntry?.raw || !membershipId) return;
    const slot = effectivePickerSlot;
    if (!slot) {
      setPickerError("Choose a time slot.");
      return;
    }
    if (pickerRequiresNote && !pickerNoteValid) {
      setPickerError(
        "Add a reason of at least 3 characters for the audit trail.",
      );
      return;
    }
    const lockVersion = pickerEntry.raw.lockVersion;
    setPickerError(null);
    rescheduleMutation.mutate({
      bookingId: pickerEntry.id,
      membershipId: slot.membershipId,
      startsAt: slot.startsAt,
      lockVersion,
      note: pickerNote.trim() || undefined,
    });
  };

  return (
    <div className="pt-1">
      {/* Back + Member header */}
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" /> Back to team
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0a1724] text-base font-semibold text-white">
            {selectedMember.displayName
              .split(" ")
              .slice(0, 2)
              .map((p) => p[0] ?? "")
              .join("")
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-title">
                {selectedMember.displayName}
              </h1>
              <Badge variant="success" className="capitalize">
                Active
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedMember.roleName}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const s = new Date();
              s.setSeconds(0, 0);
              s.setMinutes(0, 0, 0);
              s.setHours(s.getHours() + 1, 0, 0, 0);
              if (s.getHours() * 60 < workingHours.startMinute)
                s.setHours(
                  Math.floor(workingHours.startMinute / 60),
                  workingHours.startMinute % 60,
                  0,
                  0,
                );
              if (s.getHours() * 60 >= workingHours.endMinute) {
                s.setDate(s.getDate() + 1);
                s.setHours(
                  Math.floor(workingHours.startMinute / 60),
                  workingHours.startMinute % 60,
                  0,
                  0,
                );
              }
              const e = new Date(s.getTime() + 60 * 60 * 1000);
              openCreate(s, e);
            }}
          >
            Block time
          </Button>
          <Button onClick={() => setTaskOpen(true)}>
            <Plus className="size-4" /> Create task
          </Button>
        </div>
      </div>

      {/* Schedule title */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold tracking-tight">Schedule</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Working hours, availability and blocked time.
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-[9px] p-0"
          aria-label="Previous"
          onClick={goPrev}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-[9px] px-3"
          onClick={goToday}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 rounded-[9px] p-0"
          aria-label="Next"
          onClick={goNext}
        >
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-sm font-semibold">
          {view === "Day"
            ? weekStart.toLocaleDateString([], {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : view === "Month"
              ? `${monthShort[weekStart.getMonth()]} ${weekStart.getFullYear()}`
              : formatRange(weekStart, weekEndInclusive)}
        </span>
        <div className="ml-auto flex rounded-full border border-black/8 bg-white p-1">
          {(["Day", "Week", "Month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v === "Day") setAnchor(new Date(anchor));
                if (v === "Week") setAnchor(startOfWeekMonday(anchor));
                if (v === "Month")
                  setAnchor(
                    new Date(anchor.getFullYear(), anchor.getMonth(), 1),
                  );
                setView(v);
              }}
              className={
                view === v
                  ? "rounded-full bg-[#5f8d11] px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Empty week/day CTA — strict per-member, jump to next booking */}
      {isCurrentViewEmpty ? (
        <div className="mt-4 rounded-[12px] border border-dashed border-black/15 bg-[#fbfcfd] px-4 py-3 flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium text-[#536170]">
            No bookings for{" "}
            <span className="font-semibold text-foreground">
              {selectedMember.displayName}
            </span>{" "}
            {view === "Day"
              ? `on ${weekStart.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" })}`
              : `this week`}
            .
            {nextBookingsQuery.isLoading
              ? " Checking next bookings…"
              : nextBooking
                ? ` Next: ${nextBooking.serviceName} · ${new Date(nextBooking.startsAt).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                : " No bookings in next 30 days."}
          </p>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={
                view === "Day"
                  ? () => setAnchor(addDays(weekStart, 1))
                  : () => setAnchor(addDays(weekStart, 7))
              }
            >
              Next {view === "Day" ? "day" : "week"} →
            </Button>
            {nextBooking ? (
              <Button
                size="sm"
                className="h-8 rounded-full bg-[#5f8d11] hover:bg-[#4a7010]"
                onClick={() => {
                  const d = new Date(nextBooking.startsAt);
                  setAnchor(
                    view === "Day"
                      ? new Date(d.setHours(0, 0, 0, 0))
                      : startOfWeekMonday(d),
                  );
                }}
              >
                Jump to next booking
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Calendar grid */}
      <div className="mt-4 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]">
        {calendarQuery.isError ? (
          <InlineAlert
            className="m-4"
            variant="error"
            title="Calendar needs attention"
            description={
              calendarQuery.error instanceof Error
                ? calendarQuery.error.message
                : "Calendar could not be loaded."
            }
          />
        ) : null}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id as string)}
          onDragEnd={(e) => {
            setActiveId(null);
            handleDragEnd(e);
          }}
          onDragCancel={() => setActiveId(null)}
        >
          {view === "Week" ? (
            <WeekGrid
              hours={hours}
              weekStart={weekStart}
              entries={entries}
              rules={memberRules}
              pendingId={pendingId}
              onSlotClick={openCreate}
              isDragging={activeId !== null}
              workingHours={workingHours}
              onEntryClick={openDetail}
            />
          ) : view === "Day" ? (
            <DayGrid
              hours={hours}
              day={weekStart}
              entries={entries.filter(
                (e) => localDateKey(e.startsAt) === localDateKey(weekStart),
              )}
              rules={memberRules}
              pendingId={pendingId}
              onSlotClick={openCreate}
              isDragging={activeId !== null}
              workingHours={workingHours}
              onEntryClick={openDetail}
            />
          ) : (
            <MonthGrid
              monthStart={weekStart}
              entries={entries}
              onPickDay={(d) => {
                setAnchor(d);
                setView("Day");
              }}
            />
          )}
          <DragOverlay dropAnimation={null}>
            {activeEntry ? (
              <div
                className={`w-[170px] rounded-[8px] border px-2 py-1 text-xs shadow-xl ${entryTone(activeEntry.kind, activeEntry.accepted)} opacity-90`}
              >
                <p className="truncate font-semibold">{activeEntry.title}</p>
                <p className="truncate text-[0.62rem] opacity-80">
                  {activeEntry.subtitle}
                </p>
                <p className="mt-1 text-[0.62rem] opacity-70">
                  {formatTime(activeEntry.startsAt)} –{" "}
                  {formatTime(activeEntry.endsAt)}
                </p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Legend — 2 types with acceptance colors */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#1a9a3a]" /> Tasks — Accepted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#f59e0b]" /> Tasks — Pending
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#e23a3a]" /> Blocked —
          Accepted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#9ca3af]" /> Blocked —
          Tentative
        </span>
      </div>

      {/* Footer two columns — read-only per spec */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold">Regular working hours</h3>
          <div className="mt-3 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
            <dl className="space-y-2 text-xs">
              {weekdaysLong.map((label, idx) => {
                const rules = memberRules
                  .filter((r) => r.weekday === idx)
                  .sort((a, b) => a.startMinute - b.startMinute);
                const display = rules.length
                  ? rules
                      .map(
                        (r) =>
                          `${minutesToLabel(r.startMinute)} – ${minutesToLabel(r.endMinute)}`,
                      )
                      .join(", ")
                  : "Closed";
                const isWeekend = idx === 0 || idx === 6;
                return (
                  <div key={label} className="flex justify-between gap-2">
                    <dt
                      className={
                        isWeekend && display === "Closed"
                          ? "text-muted-foreground"
                          : "font-medium"
                      }
                    >
                      {label.slice(0, 3)}
                    </dt>
                    <dd
                      className={`text-right ${display === "Closed" ? "text-muted-foreground" : "font-medium"}`}
                    >
                      {display}
                    </dd>
                  </div>
                );
              })}
              {memberRules[0]?.timezone ? (
                <p className="pt-2 text-[0.62rem] text-muted-foreground">
                  Timezone · {memberRules[0].timezone}
                </p>
              ) : null}
            </dl>
          </div>
        </section>
        <section>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Upcoming exceptions</h3>
            <span className="rounded-full bg-[#eef1f3] px-2 py-0.5 text-[0.62rem] font-semibold text-[#536170]">
              {upcoming.length}
            </span>
          </div>
          <div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
            {upcoming.length ? (
              <ul className="space-y-3">
                {upcoming.map((b) => {
                  const s = new Date(b.startsAt);
                  const e = new Date(b.endsAt);
                  const isHoliday = b.reason.toLowerCase().includes("holiday");
                  const isAllDay =
                    e.getTime() - s.getTime() >= 23 * 3600 * 1000;
                  void isAllDay;
                  return (
                    <li key={b.id} className="flex gap-3">
                      <span
                        className={`mt-1 size-2 shrink-0 rounded-full ${isHoliday ? "bg-[#e23a3a]" : "bg-[#e23a3a]"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">
                          {s.toLocaleDateString([], {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}{" "}
                          {isHoliday ? b.reason : ""}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isHoliday
                            ? "Unavailable"
                            : `${formatTime(s)} – ${formatTime(e)} · ${b.reason}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                No upcoming exceptions.
              </p>
            )}
          </div>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create blocked time</DialogTitle>
            <DialogDescription>
              Block time for {selectedMember.displayName}. Clients and
              dispatchers won’t be able to book this period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Name *</span>
              <Input
                value={createDraft?.name ?? ""}
                onChange={(e) =>
                  setCreateDraft((d) =>
                    d ? { ...d, name: e.target.value } : d,
                  )
                }
                placeholder="e.g. Leave, Training, Personal time"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                3–120 characters, shown on calendar.
              </p>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">
                Description (optional)
              </span>
              <textarea
                value={createDraft?.description ?? ""}
                onChange={(e) =>
                  setCreateDraft((d) =>
                    d ? { ...d, description: e.target.value } : d,
                  )
                }
                placeholder="Why is this time blocked? Visible in details."
                className="min-h-16 w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Starts</span>
              <Input
                type="datetime-local"
                value={createDraft?.start ?? ""}
                onChange={(e) =>
                  setCreateDraft((d) =>
                    d ? { ...d, start: e.target.value } : d,
                  )
                }
                onClick={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
                onFocus={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
                className="cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Ends</span>
              <Input
                type="datetime-local"
                value={createDraft?.end ?? ""}
                onChange={(e) =>
                  setCreateDraft((d) => (d ? { ...d, end: e.target.value } : d))
                }
                onClick={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
                onFocus={(e) =>
                  (e.currentTarget as HTMLInputElement).showPicker?.()
                }
                className="cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold">Status</span>
              <div className="flex gap-2">
                {(["ACCEPTED", "PENDING"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setCreateDraft((d) => (d ? { ...d, status: s } : d))
                    }
                    className={`flex-1 rounded-[10px] border px-3 py-2 text-xs font-semibold ${createDraft?.status === s ? (s === "ACCEPTED" ? "border-[#f5c2c2] bg-[#fdeaea] text-[#7a1a1a]" : "border-[#d1d5db] bg-[#f3f4f6] text-[#374151]") : "border-black/10 bg-white text-muted-foreground"}`}
                  >
                    {s === "ACCEPTED" ? "Accepted" : "Tentative"}
                  </button>
                ))}
              </div>
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (
                  !createDraft ||
                  !createDraft.start ||
                  !createDraft.end ||
                  !createDraft.name?.trim() ||
                  createDraft.name.trim().length < 3
                )
                  return;
                createBlockMutation.mutate({
                  start: createDraft.start,
                  end: createDraft.end,
                  name: createDraft.name.trim(),
                  description: createDraft.description?.trim() || undefined,
                  status: createDraft.status,
                });
              }}
              loading={createBlockMutation.isPending}
              disabled={
                !createDraft ||
                !createDraft.start ||
                !createDraft.end ||
                !createDraft.name?.trim() ||
                createDraft.name.trim().length < 3
              }
            >
              Create blocked time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateTaskSheet open={taskOpen} onOpenChange={setTaskOpen} />

      {/* Detail drawer — clicking blocked time or task shows details + actions — styled like InvoiceDrawer WorkspaceDrawer */}
      {detailEntry && detailOpen ? (
        <WorkspaceDrawer
          onClose={() => setDetailOpen(false)}
          aria-describedby="availability-detail-desc"
        >
          <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
            <div className="flex items-start gap-3">
              <span
                className={`grid size-12 shrink-0 place-items-center rounded-full ${detailEntry.kind === "task" ? (detailEntry.accepted ? "bg-[#edf7dd] text-[#5f8d11]" : "bg-[#fef3c7] text-[#92400e]") : detailEntry.accepted ? "bg-[#fdeaea] text-[#b42318]" : "bg-[#f3f4f6] text-[#374151]"}`}
              >
                {detailEntry.kind === "task" ? (
                  <Wrench className="size-5" aria-hidden="true" />
                ) : (
                  <CalendarOff className="size-5" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-xl font-semibold tracking-title">
                      {detailEntry.title}
                    </SheetTitle>
                    <SheetDescription
                      id="availability-detail-desc"
                      className="mt-1 text-[0.68rem] text-muted-foreground"
                    >
                      {detailEntry.kind === "task"
                        ? `${detailEntry.subtitle} · ${detailEntry.location ?? "No location"}`
                        : detailEntry.blockRaw
                          ? `${detailEntry.blockRaw.memberName} · ${new Date(detailEntry.blockRaw.startsAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`
                          : "Calendar entry details."}
                    </SheetDescription>
                  </div>
                  {detailEntry.kind === "task" ? (
                    <Badge
                      variant={detailEntry.accepted ? "success" : "warning"}
                    >
                      {detailEntry.accepted ? "Accepted" : "Pending"}
                    </Badge>
                  ) : detailEntry.kind === "blocked" ? (
                    <Badge
                      variant={detailEntry.accepted ? "danger" : "neutral"}
                    >
                      {detailEntry.accepted ? "Accepted" : "Tentative"}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
            {detailEditMode ? (
              <div className="space-y-4">
                {detailEntry?.kind === "task" ? (
                  <>
                    <DetailSection number="1" title="Edit location & scope">
                      <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3 space-y-3">
                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                            <MapPin className="size-3.5 text-muted-foreground" />
                            Location *
                          </span>
                          <Input
                            value={editTaskDraft?.location ?? ""}
                            onChange={(e) =>
                              setEditTaskDraft((d) =>
                                d ? { ...d, location: e.target.value } : d,
                              )
                            }
                            placeholder="Westlands, 14 Riverside..."
                            className="h-10 rounded-[11px] text-[0.72rem]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                            <Wrench className="size-3.5 text-muted-foreground" />
                            Scope *
                          </span>
                          <textarea
                            value={editTaskDraft?.scope ?? ""}
                            onChange={(e) =>
                              setEditTaskDraft((d) =>
                                d ? { ...d, scope: e.target.value } : d,
                              )
                            }
                            placeholder="Min 20 chars"
                            className="min-h-20 w-full rounded-[11px] border border-black/8 p-3 text-[0.72rem] outline-none focus:border-ring"
                          />
                        </label>
                      </div>
                    </DetailSection>
                  </>
                ) : (
                  <>
                    <DetailSection number="1" title="Edit blocked time">
                      <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3 space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold">
                            Name *
                          </span>
                          <Input
                            value={editBlockDraft?.name ?? ""}
                            onChange={(e) =>
                              setEditBlockDraft((d) =>
                                d ? { ...d, name: e.target.value } : d,
                              )
                            }
                            placeholder="Blocked time name"
                            className="h-10 rounded-[11px] text-[0.72rem]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold">
                            Description
                          </span>
                          <textarea
                            value={editBlockDraft?.description ?? ""}
                            onChange={(e) =>
                              setEditBlockDraft((d) =>
                                d ? { ...d, description: e.target.value } : d,
                              )
                            }
                            placeholder="Optional details"
                            className="min-h-16 w-full rounded-[11px] border border-black/8 p-3 text-[0.72rem] outline-none focus:border-ring"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold">
                            Starts
                          </span>
                          <Input
                            type="datetime-local"
                            value={editBlockDraft?.start ?? ""}
                            onChange={(e) =>
                              setEditBlockDraft((d) =>
                                d ? { ...d, start: e.target.value } : d,
                              )
                            }
                            className="h-10 rounded-[11px] text-[0.72rem]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold">
                            Ends
                          </span>
                          <Input
                            type="datetime-local"
                            value={editBlockDraft?.end ?? ""}
                            onChange={(e) =>
                              setEditBlockDraft((d) =>
                                d ? { ...d, end: e.target.value } : d,
                              )
                            }
                            className="h-10 rounded-[11px] text-[0.72rem]"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold">
                            Acceptance
                          </span>
                          <div className="flex gap-2">
                            {(["ACCEPTED", "PENDING"] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() =>
                                  setEditBlockDraft((d) =>
                                    d ? { ...d, status: s } : d,
                                  )
                                }
                                className={`flex-1 rounded-[10px] border px-3 py-2 text-xs font-semibold ${editBlockDraft?.status === s ? (s === "ACCEPTED" ? "border-[#f5c2c2] bg-[#fdeaea] text-[#7a1a1a]" : "border-[#d1d5db] bg-[#f3f4f6] text-[#374151]") : "border-black/10 bg-white text-muted-foreground"}`}
                              >
                                {s === "ACCEPTED" ? "Accepted" : "Tentative"}
                              </button>
                            ))}
                          </div>
                        </label>
                      </div>
                    </DetailSection>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <DetailSection
                  number="1"
                  title={
                    detailEntry.kind === "task"
                      ? "Task summary"
                      : "Block details"
                  }
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartEdit}
                      className="gap-1.5 rounded-full border-black/10 bg-white hover:bg-white hover:border-black/20 h-7 px-3 text-[0.68rem]"
                    >
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                  }
                >
                  <div
                    className={
                      detailEntry.kind === "task"
                        ? "grid grid-cols-2 divide-x divide-y divide-black/7 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] sm:grid-cols-2 sm:divide-y-0"
                        : "overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]"
                    }
                  >
                    {detailEntry.kind === "task" ? (
                      <>
                        <DetailMetric
                          icon={Clock3}
                          label="Time"
                          value={`${formatTime(detailEntry.startsAt)} – ${formatTime(detailEntry.endsAt)}`}
                        />
                        <DetailMetric
                          icon={CalendarOff}
                          label="Date"
                          value={detailEntry.startsAt.toLocaleDateString([], {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        />
                        <DetailMetric
                          icon={Tag}
                          label="Duration"
                          value={`${Math.round((detailEntry.endsAt.getTime() - detailEntry.startsAt.getTime()) / 60000)} min`}
                        />
                        <DetailMetric
                          icon={MapPin}
                          label="Location"
                          value={detailEntry.location ?? "—"}
                        />
                      </>
                    ) : (
                      <dl className="grid grid-cols-2 overflow-hidden">
                        <DetailRow
                          label="Date"
                          value={detailEntry.startsAt.toLocaleDateString([], {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        />
                        <DetailRow
                          label="Time"
                          value={`${formatTime(detailEntry.startsAt)} – ${formatTime(detailEntry.endsAt)}`}
                        />
                        <DetailRow
                          label="Duration"
                          value={`${Math.round((detailEntry.endsAt.getTime() - detailEntry.startsAt.getTime()) / 60000)} min`}
                        />
                        <DetailRow
                          label="Member"
                          value={
                            detailEntry.blockRaw?.memberName ??
                            selectedMember.displayName
                          }
                        />
                        <DetailRow
                          label="Status"
                          value={
                            detailEntry.accepted ? "Accepted" : "Tentative"
                          }
                        />
                      </dl>
                    )}
                  </div>
                  {detailEntry.kind === "task" ? (
                    <div className="mt-3 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                      <div className="px-3 py-3">
                        <p className="text-[0.6rem] font-semibold text-muted-foreground">
                          Scope / Instructions
                        </p>
                        <p className="mt-1 text-[0.68rem] leading-5 text-foreground whitespace-pre-wrap break-words">
                          {detailEntry.scope?.trim()
                            ? detailEntry.scope
                            : "No instructions provided — tap Edit to add instructions."}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {detailEntry.kind === "task" &&
                  (detailEntry.subtitle || detailEntry.location) ? (
                    <div className="mt-3 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                      <div className="grid grid-cols-2">
                        <DetailRow
                          label="Client / Assignee"
                          value={detailEntry.subtitle ?? "—"}
                          icon={UserRound}
                        />
                        <DetailRow
                          label="Service"
                          value={detailEntry.title}
                          icon={Wrench}
                        />
                      </div>
                      <div className="border-t border-black/7 px-3 py-3">
                        <p className="text-[0.6rem] font-semibold text-muted-foreground">
                          Acceptance
                        </p>
                        <p className="mt-1">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[0.62rem] font-medium border ${detailEntry.accepted ? "bg-[#f0f7e0] text-[#3d5a0a] border-[#cde4a0]" : "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]"}`}
                          >
                            {detailEntry.accepted ? "Accepted" : "Pending"}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {detailEntry.kind === "blocked" ? (
                    <div className="mt-3 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                      <div className="px-3 py-3">
                        <p className="text-[0.6rem] font-semibold text-muted-foreground">
                          Reason
                        </p>
                        <p className="mt-1 text-[0.75rem] font-medium text-foreground">
                          {detailEntry.title}
                        </p>
                        {detailEntry.subtitle &&
                        detailEntry.subtitle !== "Blocked time" ? (
                          <p className="mt-1 text-[0.68rem] text-muted-foreground">
                            {detailEntry.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <div className="border-t border-black/7 px-3 py-3">
                        <p className="text-[0.6rem] font-semibold text-muted-foreground">
                          Description
                        </p>
                        <p className="mt-1 text-[0.68rem] leading-5 text-foreground whitespace-pre-wrap break-words">
                          {detailEntry.description?.trim()
                            ? detailEntry.description
                            : "No description provided"}
                        </p>
                      </div>
                      <div className="border-t border-black/7 bg-[#fbfcfd] px-3 py-2 text-[0.62rem] text-muted-foreground">
                        {detailEntry.blockRaw
                          ? `${new Date(detailEntry.blockRaw.startsAt).toLocaleString()} → ${new Date(detailEntry.blockRaw.endsAt).toLocaleString()}`
                          : null}
                      </div>
                    </div>
                  ) : null}
                </DetailSection>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-black/8 bg-white px-4 py-3 sm:px-5">
            {detailEditMode ? (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDetailEditMode(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
                {detailEntry?.kind === "task" ? (
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-hover border border-primary"
                    loading={updateTaskMutation.isPending}
                    disabled={
                      !editTaskDraft ||
                      editTaskDraft.location.trim().length < 3 ||
                      editTaskDraft.scope.trim().length < 20
                    }
                    onClick={() =>
                      editTaskDraft &&
                      updateTaskMutation.mutate({
                        id: editTaskDraft.id,
                        location: editTaskDraft.location.trim(),
                        scope: editTaskDraft.scope.trim(),
                      })
                    }
                  >
                    Save
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-hover border border-primary"
                    loading={updateBlockMutation.isPending}
                    disabled={
                      !editBlockDraft ||
                      editBlockDraft.name.trim().length < 3 ||
                      !editBlockDraft.start ||
                      !editBlockDraft.end
                    }
                    onClick={() =>
                      editBlockDraft &&
                      updateBlockMutation.mutate({
                        id: editBlockDraft.id,
                        name: editBlockDraft.name.trim(),
                        description: editBlockDraft.description,
                        start: editBlockDraft.start,
                        end: editBlockDraft.end,
                        status: editBlockDraft.status,
                      })
                    }
                  >
                    Save
                  </Button>
                )}
              </div>
            ) : detailEntry?.kind === "task" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {!detailEntry.accepted &&
                detailEntry.raw &&
                isSchedulableStatus(detailEntry.raw.status) ? (
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-hover border border-primary"
                    loading={acceptTaskMutation.isPending}
                    onClick={() => {
                      if (!detailEntry.raw) return;
                      const startsAt = detailEntry.raw.startsAt;
                      if (new Date(startsAt).getTime() <= Date.now()) {
                        toast.error("Task is in the past", {
                          description:
                            "Choose a future time — opening reschedule.",
                        });
                        setDetailOpen(false);
                        setTimeout(() => openPicker(detailEntry), 150);
                        return;
                      }
                      acceptTaskMutation.mutate({
                        bookingId: detailEntry.id,
                        membershipId: detailEntry.raw.membershipId,
                        startsAt,
                        lockVersion: detailEntry.raw.lockVersion,
                      });
                    }}
                  >
                    Accept
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary-hover border border-primary"
                    disabled={!isSchedulableStatus(detailEntry.raw?.status)}
                    onClick={() => {
                      setDetailOpen(false);
                      setTimeout(() => openPicker(detailEntry), 150);
                    }}
                  >
                    Reschedule
                  </Button>
                )}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90 border border-accent"
                  onClick={() =>
                    router.push(`/professional/jobs/${detailEntry.id}`)
                  }
                >
                  View job
                </Button>
              </div>
            ) : detailEntry?.kind === "blocked" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {!detailEntry.id.startsWith("holiday-") ? (
                  <Button
                    variant={detailEntry.accepted ? "outline" : "primary"}
                    className="w-full"
                    loading={updateBlockMutation.isPending}
                    onClick={() => {
                      const nextStatus = detailEntry.accepted
                        ? "PENDING"
                        : "ACCEPTED";
                      const toLocalInput = (iso: string) => {
                        const d = new Date(iso);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      };
                      const startIso =
                        detailEntry.blockRaw?.startsAt ??
                        detailEntry.startsAt.toISOString();
                      const endIso =
                        detailEntry.blockRaw?.endsAt ??
                        detailEntry.endsAt.toISOString();
                      updateBlockMutation.mutate({
                        id: detailEntry.id,
                        name: detailEntry.title,
                        description: detailEntry.description ?? undefined,
                        start: toLocalInput(startIso),
                        end: toLocalInput(endIso),
                        status: nextStatus as "PENDING" | "ACCEPTED",
                      });
                      setDetailEntry((prev) => {
                        if (!prev) return prev;
                        const nextAccepted = !prev.accepted;
                        const prevRaw = prev.blockRaw;
                        return {
                          ...prev,
                          accepted: nextAccepted,
                          blockRaw: prevRaw
                            ? {
                                ...prevRaw,
                                status: nextStatus as "PENDING" | "ACCEPTED",
                              }
                            : prevRaw,
                        };
                      });
                    }}
                  >
                    {detailEntry.accepted ? "Mark tentative" : "Accept"}
                  </Button>
                ) : (
                  <span className="flex items-center justify-center rounded-md bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                    Public holiday
                  </span>
                )}
                {!detailEntry.id.startsWith("holiday-") ? (
                  <Button
                    variant="danger"
                    loading={deleteBlockMutation.isPending}
                    onClick={() => deleteBlockMutation.mutate(detailEntry.id)}
                    className="w-full"
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </WorkspaceDrawer>
      ) : null}
      {/* Inline reschedule picker — revamped to match WorkspaceDrawer */}
      <Sheet open={pickerOpen} onOpenChange={(open) => !open && closePicker()}>
        <SheetContent
          className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0"
          aria-describedby="availability-reschedule-description"
        >
          <div className="relative shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
            <button
              type="button"
              onClick={() => setDetailEditMode((v) => !v)}
              className="absolute right-14 top-4 grid size-10 place-items-center rounded-full border border-black/8 bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={detailEditMode ? "Done editing" : "Edit"}
              title={detailEditMode ? "Done editing" : "Edit"}
            >
              <Pencil className="size-4" />
            </button>
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]">
                <Clock3 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-xl font-semibold tracking-title">
                      {pickerIsReschedule
                        ? "Accept requested time"
                        : "Confirm schedule"}
                    </SheetTitle>
                    <SheetDescription
                      id="availability-reschedule-description"
                      className="mt-1 text-[0.68rem] text-muted-foreground"
                    >
                      {pickerEntry
                        ? `${pickerEntry.title} · ${pickerEntry.subtitle}`
                        : "Choose an eligible time. Drag on the calendar also pre-fills this picker."}
                    </SheetDescription>
                  </div>
                  {pickerEntry ? (
                    <Badge variant={pickerIsReschedule ? "warning" : "success"}>
                      {pickerIsReschedule ? "Reschedule" : "Confirm"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-[0.66rem] text-muted-foreground">
                  Times are checked against working hours, unavailable periods,
                  and active reservations.
                </p>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5 space-y-4">
            {pickerPreselected ? (
              <InlineAlert
                variant="success"
                title="Dragged time pre-selected"
                description={`${new Date(pickerPreselected.startsAt).toLocaleString()} — confirm with a reason or choose another slot.`}
              />
            ) : null}
            {pickerSlotsQuery.isLoading ? (
              <p className="text-sm text-[#68717b]">Loading availability…</p>
            ) : null}
            {pickerSlotsQuery.isError ? (
              <InlineAlert
                variant="error"
                title="Slots unavailable"
                description={
                  pickerSlotsQuery.error instanceof Error
                    ? pickerSlotsQuery.error.message
                    : "Could not load slots."
                }
              />
            ) : null}
            {pickerSlotsQuery.data && pickerSlotsQuery.data.length === 0 ? (
              <InlineAlert
                variant="warning"
                title="No eligible slots"
                description="The professional needs to publish working hours or clear an existing conflict."
              />
            ) : null}
            {pickerSlotsQuery.data && pickerSlotsQuery.data.length > 0 ? (
              <div
                className="max-h-[42vh] space-y-2 overflow-y-auto pr-1"
                role="radiogroup"
                aria-label="Available booking times"
              >
                {pickerSlotsQuery.data.slice(0, 40).map((slot) => {
                  const active =
                    effectivePickerSlot?.membershipId === slot.membershipId &&
                    effectivePickerSlot?.startsAt === slot.startsAt;
                  return (
                    <label
                      key={`${slot.membershipId}-${slot.startsAt}`}
                      className={`block cursor-pointer rounded-xl border p-3 text-sm ${active ? "border-[#8eb81d] bg-[#f7fbdc]" : "border-black/8 hover:border-black/12"}`}
                    >
                      <input
                        type="radio"
                        name="availability-slot"
                        className="sr-only"
                        checked={active}
                        onChange={() => setPickerSelectedSlot(slot)}
                      />
                      <span className="font-semibold">
                        {new Date(slot.startsAt).toLocaleString([], {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="mt-1 block text-xs text-[#68717b]">
                        {slot.memberName}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : null}
            {pickerPreselected &&
            !pickerSlotsQuery.data?.some(
              (s) =>
                s.startsAt === pickerPreselected.startsAt &&
                s.membershipId === pickerPreselected.membershipId,
            ) &&
            !pickerSlotsQuery.isLoading ? (
              <InlineAlert
                variant="warning"
                title="Dragged time not in slot list"
                description="That exact time isn't currently eligible (working hours or conflict). Choose a nearby eligible slot instead — your dragged time is still shown above."
              />
            ) : null}
            <div>
              <label
                htmlFor="availability-reschedule-note"
                className="text-xs font-medium text-muted-foreground"
              >
                Reason for rescheduling{" "}
                {pickerRequiresNote ? "*" : "(optional)"}
              </label>
              <textarea
                id="availability-reschedule-note"
                value={pickerNote}
                onChange={(e) => setPickerNote(e.target.value)}
                placeholder={
                  pickerIsReschedule
                    ? "Brief reason for the audit trail — e.g. Client requested change, technician reassigned…"
                    : "Optional note for the audit trail…"
                }
                className="mt-2 min-h-20 w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {pickerRequiresNote
                  ? "Required — at least 3 characters, saved to booking history."
                  : "Saved to booking history if provided (min 3 characters)."}
              </p>
            </div>
            {pickerError ? (
              <InlineAlert
                variant="error"
                title="Time not confirmed"
                description={pickerError}
              />
            ) : null}
          </div>
          <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={closePicker}
              disabled={rescheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={rescheduleMutation.isPending}
              disabled={!pickerCanSubmit}
              onClick={handlePickerConfirm}
            >
              {pickerIsReschedule ? "Accept requested time" : "Confirm booking"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailSection({
  number,
  title,
  action,
  children,
}: {
  number: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[0.68rem] font-semibold text-foreground">
          {number}. {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 px-3 py-3">
      <span className="flex items-center gap-1.5 text-[0.61rem] text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className="mt-1.5 block truncate text-[0.72rem] font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: typeof Wrench;
}) {
  return (
    <div className="min-w-0 border-b border-r border-black/7 px-3 py-2.5 even:border-r-0 last:border-b-0">
      <dt className="flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">
        {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
        {label}
      </dt>
      <dd className="mt-1 truncate text-[0.68rem] font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

function WeekGrid({
  hours,
  weekStart,
  entries,
  rules,
  pendingId,
  onSlotClick,
  isDragging = false,
  workingHours,
  onEntryClick,
}: {
  hours: number[];
  weekStart: Date;
  entries: ScheduleEntry[];
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  pendingId?: string | null;
  onSlotClick?: (start: Date, end: Date) => void;
  isDragging?: boolean;
  workingHours: { startMinute: number; endMinute: number };
  onEntryClick?: (entry: ScheduleEntry) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startHour = hours[0] ?? Math.floor(workingHours.startMinute / 60);
  const endHour =
    (hours[hours.length - 1] ?? Math.ceil(workingHours.endMinute / 60)) + 1;
  const hourHeight = 52;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-black/6 bg-[#fbfcfd] text-[0.68rem] font-semibold text-[#536170]">
          <div className="px-2 py-2" />
          {days.map((d) => (
            <div
              key={d.toISOString()}
              className="border-l border-black/6 px-2 py-2 text-center"
            >
              <span className="block text-[0.62rem] uppercase tracking-wide text-muted-foreground">
                {weekdaysShort[d.getDay()]}
              </span>
              <span className="text-xs font-semibold text-foreground">
                {d.getDate()} {monthShort[d.getMonth()]}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[56px_repeat(7,1fr)]">
          <div className="border-r border-black/6 bg-[#fbfcfd] text-[0.62rem] text-muted-foreground">
            {hours.map((h) => (
              <div
                key={h}
                className="h-[52px] border-b border-black/5 px-2 py-1"
              >
                {h}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayStart = new Date(day);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = addDays(dayStart, 1);
            const dayEntries = entries.filter(
              (e) => e.startsAt < dayEnd && e.endsAt > dayStart,
            );
            const busy = dayEntries.map((e) => ({
              startsAt: e.startsAt,
              endsAt: e.endsAt,
            }));
            const slots = generateAvailableSlots(day, rules, busy);
            return (
              <DroppableDay
                key={day.toISOString()}
                day={day}
                onSlotClick={onSlotClick}
                isDragging={isDragging}
                workingHours={workingHours}
              >
                {hours.map((h) => (
                  <div key={h} className="h-[52px] border-b border-black/5" />
                ))}
                {/* Available slots — always visible background, click to create */}
                {slots.map((slot) => {
                  const startMin =
                    slot.start.getHours() * 60 +
                    slot.start.getMinutes() -
                    startHour * 60;
                  const height = (60 * hourHeight) / 60 - 4;
                  const top = (startMin * hourHeight) / 60 + 2;
                  if (startMin < 0 || startMin > (endHour - startHour) * 60)
                    return null;
                  return (
                    <button
                      key={`slot-${slot.start.toISOString()}`}
                      type="button"
                      onClick={() => onSlotClick?.(slot.start, slot.end)}
                      className="absolute inset-x-1 rounded-[6px] border border-dashed border-[#d8e0e4] bg-[#f7f9fa]/70 hover:bg-[#eef3f6] hover:border-[#c7d7df] transition-colors"
                      style={{ top: `${top}px`, height: `${height}px` }}
                      title={`Available ${formatTime(slot.start)} – ${formatTime(slot.end)} — click to create`}
                      aria-label={`Create blocked time ${formatTime(slot.start)} – ${formatTime(slot.end)}`}
                    />
                  );
                })}
                {dayEntries.map((entry) => {
                  const startMin =
                    entry.startsAt.getHours() * 60 +
                    entry.startsAt.getMinutes() -
                    startHour * 60;
                  const endMin =
                    entry.endsAt.getHours() * 60 +
                    entry.endsAt.getMinutes() -
                    startHour * 60;
                  const top = Math.max(0, (startMin * hourHeight) / 60);
                  const height = Math.max(
                    18,
                    ((endMin - startMin) * hourHeight) / 60,
                  );
                  if (endMin < 0 || startMin > (endHour - startHour) * 60)
                    return null;
                  return (
                    <DraggableEntry
                      key={entry.id}
                      entry={entry}
                      top={top}
                      height={Math.min(
                        height,
                        (endHour - startHour) * hourHeight - top,
                      )}
                      isPending={pendingId === entry.id}
                      onEntryClick={onEntryClick}
                    />
                  );
                })}
              </DroppableDay>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DayGrid({
  hours,
  day,
  entries,
  rules,
  pendingId,
  onSlotClick,
  isDragging = false,
  workingHours,
  onEntryClick,
}: {
  hours: number[];
  day: Date;
  entries: ScheduleEntry[];
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  pendingId?: string | null;
  onSlotClick?: (start: Date, end: Date) => void;
  isDragging?: boolean;
  workingHours: { startMinute: number; endMinute: number };
  onEntryClick?: (entry: ScheduleEntry) => void;
}) {
  const startHour = hours[0] ?? Math.floor(workingHours.startMinute / 60);
  const endHour =
    (hours[hours.length - 1] ?? Math.ceil(workingHours.endMinute / 60)) + 1;
  const hourHeight = 52;
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const busy = entries.map((e) => ({ startsAt: e.startsAt, endsAt: e.endsAt }));
  const slots = generateAvailableSlots(day, rules, busy);
  const { setNodeRef, isOver } = useDroppable({ id: day.toISOString() });
  const handleDayClick = (e: React.MouseEvent) => {
    if (!onSlotClick || isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-schedule-entry]") || target.closest("button"))
      return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = Math.floor(((y / hourHeight) * 60) / 30) * 30;
    const totalMin = startHour * 60 + minutesFromStart;
    if (
      totalMin < workingHours.startMinute ||
      totalMin >= workingHours.endMinute
    )
      return;
    const start = new Date(day);
    start.setHours(Math.floor(totalMin / 60), totalMin % 60, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    if (start.getTime() < Date.now()) {
      toast.error("Cannot schedule in the past", {
        description: "Choose a future slot.",
      });
      return;
    }
    onSlotClick(start, end);
  };
  return (
    <div className="grid grid-cols-[56px_1fr]">
      <div className="border-r border-black/6 bg-[#fbfcfd] text-[0.62rem] text-muted-foreground">
        {hours.map((h) => (
          <div key={h} className="h-[52px] border-b border-black/5 px-2 py-1">
            {h}:00
          </div>
        ))}
      </div>
      <div
        ref={setNodeRef}
        onClick={handleDayClick}
        className={`relative ${isOver ? "bg-[#f0f7e0]/30" : ""} ${onSlotClick ? "cursor-pointer" : ""}`}
      >
        {hours.map((h) => (
          <div key={h} className="h-[52px] border-b border-black/5" />
        ))}
        {slots.map((slot) => {
          const startMin =
            slot.start.getHours() * 60 +
            slot.start.getMinutes() -
            startHour * 60;
          const top = (startMin * hourHeight) / 60 + 2;
          const height = (60 * hourHeight) / 60 - 4;
          if (startMin < 0 || startMin > (endHour - startHour) * 60)
            return null;
          return (
            <button
              key={`slot-${slot.start.toISOString()}`}
              type="button"
              onClick={() => onSlotClick?.(slot.start, slot.end)}
              className="absolute inset-x-2 rounded-[6px] border border-dashed border-[#d8e0e4] bg-[#f7f9fa]/70 hover:bg-[#eef3f6] hover:border-[#c7d7df] transition-colors"
              style={{ top: `${top}px`, height: `${height}px` }}
              title={`Available ${formatTime(slot.start)} – ${formatTime(slot.end)} — click to create`}
              aria-label={`Create blocked time ${formatTime(slot.start)} – ${formatTime(slot.end)}`}
            />
          );
        })}
        {entries.map((entry) => {
          const startMin =
            entry.startsAt.getHours() * 60 +
            entry.startsAt.getMinutes() -
            startHour * 60;
          const endMin =
            entry.endsAt.getHours() * 60 +
            entry.endsAt.getMinutes() -
            startHour * 60;
          const top = Math.max(0, (startMin * hourHeight) / 60);
          const height = Math.max(22, ((endMin - startMin) * hourHeight) / 60);
          return (
            <DraggableEntry
              key={entry.id}
              entry={entry}
              top={top}
              height={height}
              variant="day"
              isPending={pendingId === entry.id}
              onEntryClick={onEntryClick}
            />
          );
        })}
        {entries.length === 0 && slots.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
            No entries for this day.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MonthGrid({
  monthStart,
  entries,
  onPickDay,
}: {
  monthStart: Date;
  entries: ScheduleEntry[];
  onPickDay: (d: Date) => void;
}) {
  const firstWeekStart = startOfWeekMonday(monthStart);
  const days: Date[] = Array.from({ length: 35 }, (_, i) =>
    addDays(firstWeekStart, i),
  );
  return (
    <div className="p-3">
      <div className="grid grid-cols-7 gap-1 text-center text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2">
        {days.map((d) => {
          const isCurrentMonth = d.getMonth() === monthStart.getMonth();
          const dayEntries = entries.filter(
            (e) => localDateKey(e.startsAt) === localDateKey(d),
          );
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onPickDay(d)}
              className={`min-h-24 rounded-[12px] border p-2 text-left ${isCurrentMonth ? "border-black/8 bg-white" : "border-black/5 bg-[#f7f9fa] text-muted-foreground"} hover:border-black/15`}
            >
              <span
                className={`text-xs font-semibold ${isCurrentMonth ? "" : "opacity-60"}`}
              >
                {d.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayEntries.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={`block truncate rounded-[6px] px-1.5 py-0.5 text-[0.62rem] ${entryTone(e.kind, e.accepted)}`}
                  >
                    {e.title}
                  </span>
                ))}
                {dayEntries.length > 3 ? (
                  <span className="block text-[0.62rem] text-muted-foreground">
                    +{dayEntries.length - 3} more
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
