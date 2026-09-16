import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceSummary } from "@/modules/workspace/types";

const mocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  selectWorkspace: vi.fn(),
  session: { user: { id: "user-1" } } as {
    user: { id: string };
  } | null,
  sessionPending: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.sessionPending,
    }),
  },
}));

vi.mock("@/lib/workspace-entry", () => ({
  listAvailableWorkspaces: mocks.listWorkspaces,
  selectWorkspace: mocks.selectWorkspace,
}));

vi.mock("@/components/public/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));

import { WorkspaceSelectPage } from "./workspace-select-page";

const clientWorkspace: WorkspaceSummary = {
  id: "client:profile-1",
  kind: "client",
  label: "Personal account",
  href: "/client",
  organisationId: null,
  membershipId: null,
  roleKey: "client",
  organisationStatus: null,
  permissions: [],
  assignedJobsOnly: false,
  financialDataAccess: false,
};

const professionalWorkspace: WorkspaceSummary = {
  ...clientWorkspace,
  id: "organisation:org-1",
  kind: "organisation",
  label: "Mwas Plumbing",
  href: "/professional",
  organisationId: "org-1",
  membershipId: "membership-1",
  roleKey: "organisation_owner",
};

describe("workspace selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
  });

  it("bypasses the chooser when only one workspace is available", async () => {
    mocks.listWorkspaces.mockResolvedValue([clientWorkspace]);
    mocks.selectWorkspace.mockResolvedValue(clientWorkspace);

    render(<WorkspaceSelectPage />);

    await waitFor(() => {
      expect(mocks.selectWorkspace).toHaveBeenCalledWith(clientWorkspace.id);
      expect(mocks.replace).toHaveBeenCalledWith("/client");
    });
    expect(screen.queryByText("Choose where you want to continue")).not.toBeInTheDocument();
  });

  it("shows a real chooser for accounts with multiple workspaces", async () => {
    mocks.listWorkspaces.mockResolvedValue([
      clientWorkspace,
      professionalWorkspace,
    ]);
    mocks.selectWorkspace.mockResolvedValue(professionalWorkspace);

    render(<WorkspaceSelectPage />);

    expect(
      await screen.findByRole("heading", {
        name: "Choose where you want to continue",
      }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Mwas Plumbing/i }),
    );

    await waitFor(() => {
      expect(mocks.selectWorkspace).toHaveBeenCalledWith(
        professionalWorkspace.id,
      );
      expect(mocks.replace).toHaveBeenCalledWith("/professional");
    });
  });
});
