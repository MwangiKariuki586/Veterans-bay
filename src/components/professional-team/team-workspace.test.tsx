import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamWorkspace } from "./team-workspace";
import { teamInvitationsFixture, teamMembersFixture } from "./fixtures";

const toastMocks = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastMocks.success(...args),
    error: (...args: unknown[]) => toastMocks.error(...args),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/professional/team",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  redirect: () => {},
}));

afterEach(() => {
  vi.restoreAllMocks();
  toastMocks.success.mockClear();
  toastMocks.error.mockClear();
});

describe("professional team workspace", () => {
  it("renders active and deactivated members with role-limited access", () => {
    render(<TeamWorkspace view="team" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getAllByText("Alex Veteran").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nadia Kamau").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Faith Mwangi").length).toBeGreaterThan(0);
    // Search and filters are present, member table replaces KPI cards
    expect(screen.getByPlaceholderText("Search team members...")).toBeInTheDocument();
    expect(screen.getAllByText("Available today").length).toBeGreaterThan(0);
  });

  it("shows pending and expired invitation states", () => {
    render(<TeamWorkspace view="invitations" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Team" })).toBeInTheDocument();
    expect(screen.getAllByText("samuel@digitalqatalyst.co.ke").length).toBeGreaterThan(0);
    expect(screen.getAllByText("accounts@digitalqatalyst.co.ke").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Search invitations...")).toBeInTheDocument();
    expect(screen.getAllByText("Email").length).toBeGreaterThan(0);
  });

  it("renders member drawer with workload, role and permissions", async () => {
    render(<TeamWorkspace view="member" memberId="member-manager" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Nadia Kamau" })).toBeInTheDocument();
    // drawer tabs and sections per new spec - use getAll for duplicate Availability (filter option vs drawer card)
    expect(screen.getAllByText("Availability").length).toBeGreaterThan(0);
    expect(screen.getByText("Current workload")).toBeInTheDocument();
    expect(screen.getAllByText("Permissions summary").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recent assignments").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Transfer ownership" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deactivate member/ })).toBeInTheDocument();
  });

  it("deliberately handles empty and permission-restricted states", () => {
    const { unmount } = render(<TeamWorkspace view="team" initialMembers={[]} />);
    expect(screen.getByText("No team members yet")).toBeInTheDocument();

    unmount();
    render(<TeamWorkspace view="team" canManage={false} initialMembers={[]} />);
    expect(screen.getByText("Team management permission required")).toBeInTheDocument();
  });

  it("loads authoritative data and records invitations through the team API", async () => {
    const overview = {
      canManage: true,
      members: [{
        id: "membership-1",
        accountProfileId: "profile-1",
        name: "Alex Veteran",
        email: "alex@example.com",
        phone: null,
        role: "owner",
        status: "active",
        assignedJobsOnly: false,
        financialDataAccess: true,
        joinedAt: "2026-07-20T10:00:00.000Z",
        updatedAt: "2026-07-20T10:00:00.000Z",
        availabilityStatus: "available",
        availabilityLabel: "Available today",
        availabilityDetail: "8:00 AM – 6:00 PM",
        activeJobs: 1,
        bookingsToday: 1,
      }],
      invitations: [],
    };
    const invitation = {
      id: "invitation-1",
      email: "new.member@example.com",
      role: "technician",
      status: "pending",
      assignedJobsOnly: true,
      financialDataAccess: false,
      invitedBy: "Alex Veteran",
      expiresAt: "2026-07-27T10:00:00.000Z",
      createdAt: "2026-07-20T10:00:00.000Z",
    };
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: overview }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { roles: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: invitation }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...overview, invitations: [invitation] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { roles: [] } }), { status: 200 }));

    render(<TeamWorkspace view="team" />);
    expect(screen.getByText("Loading team access")).toBeInTheDocument();
    expect(await screen.findAllByText("Alex Veteran")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Invite member/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Work email" }), { target: { value: "new.member@example.com" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Role" }), { target: { value: "technician" } });
    fireEvent.click(screen.getByRole("button", { name: "Record invitation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/v1/professional/team/invitations", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "new.member@example.com", role: "technician" }),
    }));
    await waitFor(() =>
      expect(toastMocks.success).toHaveBeenCalledWith("Invitation ready", expect.objectContaining({ description: expect.stringContaining("new.member@example.com") })),
    );
    expect(screen.queryByText(/Invitation recorded for new\.member@example\.com/)).not.toBeInTheDocument();
  });

  it("renders roles & permissions tab with role list", () => {
    render(<TeamWorkspace view="team" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);
    fireEvent.click(screen.getByRole("button", { name: "Roles & permissions" }));
    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("Permissions")).toBeInTheDocument();
  });
});
