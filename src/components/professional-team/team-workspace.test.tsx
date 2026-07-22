import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeamWorkspace } from "./team-workspace";
import { teamInvitationsFixture, teamMembersFixture } from "./fixtures";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("professional team workspace", () => {
  it("renders active and deactivated members with role-limited access", () => {
    render(<TeamWorkspace view="team" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Team access" })).toBeInTheDocument();
    expect(screen.getByText("Alex Veteran")).toBeInTheDocument();
    expect(screen.getByText("Nadia Kamau")).toBeInTheDocument();
    expect(screen.getByText("Faith Mwangi")).toBeInTheDocument();
    expect(screen.getByText("Assigned jobs only")).toBeInTheDocument();
  });

  it("shows pending and expired invitation states", () => {
    render(<TeamWorkspace view="invitations" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Team invitations" })).toBeInTheDocument();
    expect(screen.getByText("samuel@digitalqatalyst.co.ke")).toBeInTheDocument();
    expect(screen.getByText("accounts@digitalqatalyst.co.ke")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();
  });

  it("renders member restrictions, activity, and ownership protection", () => {
    render(<TeamWorkspace view="member" memberId="member-manager" initialMembers={teamMembersFixture} initialInvitations={teamInvitationsFixture} />);

    expect(screen.getByRole("heading", { name: "Nadia Kamau" })).toBeInTheDocument();
    expect(screen.getByText("Role and restrictions")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transfer ownership" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deactivate access" })).toBeInTheDocument();
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: invitation }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...overview, invitations: [invitation] } }), { status: 200 }));

    render(<TeamWorkspace view="team" />);
    expect(screen.getByText("Loading team access")).toBeInTheDocument();
    expect(await screen.findByText("Alex Veteran")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Work email" }), { target: { value: "new.member@example.com" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Role" }), { target: { value: "technician" } });
    fireEvent.click(screen.getByRole("button", { name: "Record invitation" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/professional/team/invitations", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ email: "new.member@example.com", role: "technician" }),
    }));
    expect(await screen.findByText(/Invitation recorded for new\.member@example\.com/)).toBeInTheDocument();
  });
});
