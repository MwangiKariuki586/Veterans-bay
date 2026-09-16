import { describe, expect, it } from "vitest";

import {
  assertValidTimezone,
  buildAvailableSlots,
  overlaps,
} from "./availability";

const mondayRule = {
  membershipId: "member-1",
  memberName: "Amina Technician",
  weekday: 1,
  startMinute: 8 * 60,
  endMinute: 10 * 60,
  timezone: "Africa/Nairobi",
};

describe("booking availability", () => {
  it("builds duration-aware half-hour slots in the member timezone", () => {
    const slots = buildAvailableSlots({
      from: new Date("2026-07-27T04:30:00.000Z"),
      to: new Date("2026-07-27T08:00:00.000Z"),
      durationMinutes: 60,
      rules: [mondayRule],
      blocks: [],
      reservations: [],
      now: new Date("2026-07-27T04:00:00.000Z"),
    });

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-07-27T05:00:00.000Z",
      "2026-07-27T05:30:00.000Z",
      "2026-07-27T06:00:00.000Z",
    ]);
    expect(slots.every((slot) => slot.timezone === "Africa/Nairobi")).toBe(
      true,
    );
  });

  it("removes blocked and reserved windows without treating touching edges as conflicts", () => {
    const slots = buildAvailableSlots({
      from: new Date("2026-07-27T04:30:00.000Z"),
      to: new Date("2026-07-27T08:00:00.000Z"),
      durationMinutes: 30,
      rules: [mondayRule],
      blocks: [
        {
          membershipId: "member-1",
          startsAt: new Date("2026-07-27T05:30:00.000Z"),
          endsAt: new Date("2026-07-27T06:00:00.000Z"),
        },
      ],
      reservations: [
        {
          membershipId: "member-1",
          startsAt: new Date("2026-07-27T06:30:00.000Z"),
          endsAt: new Date("2026-07-27T07:00:00.000Z"),
        },
      ],
      now: new Date("2026-07-27T04:00:00.000Z"),
    });

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-07-27T05:00:00.000Z",
      "2026-07-27T06:00:00.000Z",
    ]);
    expect(
      overlaps(
        new Date("2026-07-27T05:00:00.000Z"),
        new Date("2026-07-27T05:30:00.000Z"),
        new Date("2026-07-27T05:30:00.000Z"),
        new Date("2026-07-27T06:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("keeps local working hours correct across a daylight-saving transition", () => {
    const slots = buildAvailableSlots({
      from: new Date("2026-11-02T12:00:00.000Z"),
      to: new Date("2026-11-02T16:00:00.000Z"),
      durationMinutes: 60,
      rules: [
        {
          ...mondayRule,
          timezone: "America/New_York",
        },
      ],
      blocks: [],
      reservations: [],
      now: new Date("2026-11-02T11:00:00.000Z"),
    });

    expect(slots.map((slot) => slot.startsAt)).toEqual([
      "2026-11-02T13:00:00.000Z",
      "2026-11-02T13:30:00.000Z",
      "2026-11-02T14:00:00.000Z",
    ]);
  });

  it("rejects invalid timezones and ranges longer than the scheduling horizon", () => {
    expect(() => assertValidTimezone("Not/A_Timezone")).toThrow(
      "INVALID_TIMEZONE",
    );
    expect(() =>
      buildAvailableSlots({
        from: new Date("2026-07-01T00:00:00.000Z"),
        to: new Date("2026-08-02T00:00:00.000Z"),
        durationMinutes: 60,
        rules: [mondayRule],
        blocks: [],
        reservations: [],
      }),
    ).toThrow("INVALID_SLOT_RANGE");
  });
});
