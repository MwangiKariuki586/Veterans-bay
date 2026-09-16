import type { BookingSlot } from "./types";

export interface SlotRule {
  membershipId: string;
  memberName: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
}

export interface BusyWindow {
  membershipId: string;
  startsAt: Date;
  endsAt: Date;
}

export function assertValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("INVALID_TIMEZONE");
  }
}

export function buildAvailableSlots(input: {
  from: Date;
  to: Date;
  durationMinutes: number;
  rules: SlotRule[];
  blocks: BusyWindow[];
  reservations: BusyWindow[];
  now?: Date;
  intervalMinutes?: number;
  limit?: number;
}): BookingSlot[] {
  const intervalMinutes = input.intervalMinutes ?? 30;
  const limit = input.limit ?? 500;
  if (
    input.to <= input.from ||
    input.durationMinutes <= 0 ||
    input.to.getTime() - input.from.getTime() > 31 * 24 * 60 * 60 * 1_000
  ) {
    throw new Error("INVALID_SLOT_RANGE");
  }

  const now = input.now ?? new Date();
  const durationMs = input.durationMinutes * 60_000;
  const intervalMs = intervalMinutes * 60_000;
  const firstCandidate = new Date(
    Math.ceil(input.from.getTime() / intervalMs) * intervalMs,
  );
  const slots: BookingSlot[] = [];

  for (const rule of input.rules) {
    assertValidTimezone(rule.timezone);
    for (
      let startMs = firstCandidate.getTime();
      startMs + durationMs <= input.to.getTime();
      startMs += intervalMs
    ) {
      if (slots.length >= limit) break;
      const startsAt = new Date(startMs);
      const endsAt = new Date(startMs + durationMs);
      if (startsAt <= now) continue;
      if (!withinRule(startsAt, endsAt, rule)) continue;
      if (
        [...input.blocks, ...input.reservations].some(
          (window) =>
            window.membershipId === rule.membershipId &&
            overlaps(startsAt, endsAt, window.startsAt, window.endsAt),
        )
      ) {
        continue;
      }
      slots.push({
        membershipId: rule.membershipId,
        memberName: rule.memberName,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone: rule.timezone,
      });
    }
  }

  return slots.sort(
    (left, right) =>
      left.startsAt.localeCompare(right.startsAt) ||
      left.memberName.localeCompare(right.memberName),
  );
}

export function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function withinRule(startsAt: Date, endsAt: Date, rule: SlotRule) {
  const start = zonedParts(startsAt, rule.timezone);
  const lastOccupiedMinute = zonedParts(
    new Date(endsAt.getTime() - 1),
    rule.timezone,
  );
  const startMinute = start.hour * 60 + start.minute;
  const endMinute =
    lastOccupiedMinute.hour * 60 + lastOccupiedMinute.minute + 1;
  return (
    start.weekday === rule.weekday &&
    lastOccupiedMinute.weekday === rule.weekday &&
    startMinute >= rule.startMinute &&
    endMinute <= rule.endMinute
  );
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const year = values.year ?? 1970;
  const month = values.month ?? 1;
  const day = values.day ?? 1;
  return {
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
  };
}
