import { describe, expect, it } from "vitest";

import { deriveWarrantyCoverage } from "./coverage";

describe("warranty coverage", () => {
  const start = new Date("2026-07-28T08:00:00.000Z");

  it("derives accepted day, week, month, and year durations", () => {
    expect(deriveWarrantyCoverage("Covered for 14 days.", start)?.durationDays).toBe(14);
    expect(deriveWarrantyCoverage("Includes 2 weeks cover.", start)?.durationDays).toBe(14);
    expect(deriveWarrantyCoverage("Workmanship warranty: 3 months.", start)?.durationDays).toBe(90);
    expect(deriveWarrantyCoverage("Covered for 1 year.", start)?.durationDays).toBe(365);
  });

  it("uses a conservative fallback and rejects explicit exclusions", () => {
    expect(deriveWarrantyCoverage("Standard workmanship warranty.", start)?.durationDays).toBe(30);
    expect(deriveWarrantyCoverage("No warranty applies.", start)).toBeNull();
  });
});
