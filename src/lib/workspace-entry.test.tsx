import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentWorkspace,
  WorkspaceEntryError,
} from "@/lib/workspace-entry";

describe("workspace entry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the validated current workspace without selecting it again", async () => {
    const workspace = {
      id: "organisation:organisation-1",
      kind: "organisation" as const,
      label: "Emkay Ltd",
      href: "/professional",
      organisationId: "organisation-1",
      membershipId: "membership-1",
      roleKey: "owner",
      organisationStatus: "active" as const,
      permissions: ["requests.view"],
      assignedJobsOnly: false,
      financialDataAccess: true,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: workspace }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(getCurrentWorkspace(controller.signal)).resolves.toEqual(
      workspace,
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/workspaces/current", {
      credentials: "include",
      signal: controller.signal,
    });
  });

  it("preserves the response status for authentication and recovery decisions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "WORKSPACE_UNAVAILABLE" } }),
          {
            status: 403,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    await expect(getCurrentWorkspace()).rejects.toEqual(
      new WorkspaceEntryError("WORKSPACE_UNAVAILABLE", 403),
    );
  });
});
