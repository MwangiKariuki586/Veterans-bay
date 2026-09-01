import { describe, expect, it } from "vitest";

import { getWorkspaceNav } from "./workspace-nav";

describe("workspace navigation", () => {
  it("consolidates client jobs into bookings while preserving professional jobs", () => {
    const clientItems = getWorkspaceNav("client").flatMap((group) => group.items);
    const professionalItems = getWorkspaceNav("professional").flatMap(
      (group) => group.items,
    );

    expect(clientItems).toContainEqual(
      expect.objectContaining({ href: "/client/bookings", label: "Bookings" }),
    );
    expect(clientItems).not.toContainEqual(
      expect.objectContaining({ href: "/client/jobs" }),
    );
    expect(professionalItems).toContainEqual(
      expect.objectContaining({ href: "/professional/jobs", label: "Jobs" }),
    );
  });
});
