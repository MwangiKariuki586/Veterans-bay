import { describe, expect, it } from "vitest";

import { resolveJobTransition } from "./repository";
import type { JobStatus } from "./types";

describe("job workflow transition matrix", () => {
  it("allows only intent-specific execution transitions", () => {
    const allowed: Array<
      [JobStatus, Parameters<typeof resolveJobTransition>[1], JobStatus]
    > = [
      ["SCHEDULED", "CHECK_IN", "EN_ROUTE"],
      ["TEAM_ASSIGNED", "CHECK_IN", "EN_ROUTE"],
      ["EN_ROUTE", "START", "IN_PROGRESS"],
      ["IN_PROGRESS", "HOLD", "ON_HOLD"],
      ["ON_HOLD", "RESUME", "IN_PROGRESS"],
      ["IN_PROGRESS", "READY", "AWAITING_CLIENT_CONFIRMATION"],
      ["RETURN_VISIT_REQUIRED", "START", "IN_PROGRESS"],
    ];
    for (const [from, action, to] of allowed) {
      expect(resolveJobTransition(from, action)).toEqual({ status: to });
    }
  });

  it("rejects invalid and terminal transitions while retaining explicit cancellation", () => {
    expect(resolveJobTransition("CREATED", "READY")).toBeNull();
    expect(resolveJobTransition("ON_HOLD", "READY")).toBeNull();
    expect(resolveJobTransition("AWAITING_CLIENT_CONFIRMATION", "START")).toBeNull();
    expect(resolveJobTransition("COMPLETED", "START")).toBeNull();
    expect(resolveJobTransition("COMPLETED", "CANCEL")).toBeNull();
    expect(resolveJobTransition("IN_PROGRESS", "CANCEL")).toEqual({
      status: "CANCELLED",
    });
  });
});
