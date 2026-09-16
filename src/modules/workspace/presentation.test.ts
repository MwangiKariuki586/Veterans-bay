import { describe, expect, it } from "vitest";

import { workspaceEntryContent } from "./presentation";
import type { WorkspaceSummary } from "./types";

function workspace(
  overrides: Partial<WorkspaceSummary> = {},
): WorkspaceSummary {
  return {
    id: "client:profile-1",
    kind: "client",
    label: "Client workspace",
    href: "/client",
    organisationId: null,
    membershipId: null,
    roleKey: null,
    organisationStatus: null,
    permissions: [],
    assignedJobsOnly: false,
    financialDataAccess: false,
    ...overrides,
  };
}

describe("workspaceEntryContent", () => {
  it("gives a client a clear hiring next step", () => {
    expect(workspaceEntryContent(workspace())).toMatchObject({
      eyebrow: "Client",
      title: "Hire trusted professionals",
      action: "Open client workspace",
    });
  });

  it("takes a pending professional to their application status", () => {
    expect(
      workspaceEntryContent(
        workspace({
          id: "organisation:org-1",
          kind: "organisation",
          label: "Bay Repairs",
          href: "/professional/onboarding/review",
          organisationId: "org-1",
          membershipId: "membership-1",
          roleKey: "owner",
          organisationStatus: "pending_review",
        }),
      ),
    ).toMatchObject({
      title: "Bay Repairs is under review",
      action: "View application status",
    });
  });

  it("gives an administrator a platform operations next step", () => {
    expect(
      workspaceEntryContent(
        workspace({
          id: "platform:admin",
          kind: "platform",
          label: "Platform administration",
          href: "/admin",
          roleKey: "platform_admin",
          financialDataAccess: true,
        }),
      ),
    ).toMatchObject({
      eyebrow: "Platform administrator",
      title: "Manage Veterans Bay",
      action: "Open administration",
    });
  });
});
