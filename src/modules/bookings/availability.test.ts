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

  it("returns earliest slot when rule generation order differs from chronological order", () => {
    const tuesdayRule = {
      ...mondayRule,
      membershipId: "member-2",
      memberName: "B Technician",
      weekday: 2,
    };
    // Window covers Monday 2026-07-27 and Tuesday 2026-07-28.
    // Rules are ordered [Tuesday, Monday] so generation order is reverse chronological.
    const from = new Date("2026-07-27T00:00:00.000Z");
    const to = new Date("2026-07-29T00:00:00.000Z");
    const now = new Date("2026-07-26T00:00:00.000Z");

    const single = buildAvailableSlots({
      from,
      to,
      durationMinutes: 60,
      rules: [tuesdayRule, mondayRule],
      blocks: [],
      reservations: [],
      now,
      limit: 1,
    });
    // Before fix, generation-time limit would return Tuesday 2026-07-28T05:00:00.000Z
    expect(single).toHaveLength(1);
    expect(single[0]?.startsAt).toBe("2026-07-27T05:00:00.000Z");
    expect(single[0]?.membershipId).toBe("member-1");

    const two = buildAvailableSlots({
      from,
      to,
      durationMinutes: 60,
      rules: [tuesdayRule, mondayRule],
      blocks: [],
      reservations: [],
      now,
      limit: 2,
    });
    expect(two.map((slot) => slot.startsAt)).toEqual([
      "2026-07-27T05:00:00.000Z",
      "2026-07-27T05:30:00.000Z",
    ]);

    const all = buildAvailableSlots({
      from,
      to,
      durationMinutes: 60,
      rules: [tuesdayRule, mondayRule],
      blocks: [],
      reservations: [],
      now,
    });
    // Sorted chronologically regardless of input rule order
    expect(all.map((slot) => slot.startsAt)).toEqual([
      "2026-07-27T05:00:00.000Z",
      "2026-07-27T05:30:00.000Z",
      "2026-07-27T06:00:00.000Z",
      "2026-07-28T05:00:00.000Z",
      "2026-07-28T05:30:00.000Z",
      "2026-07-28T06:00:00.000Z",
    ]);
  });
});
