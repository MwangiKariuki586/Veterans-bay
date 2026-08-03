import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/workspace/authenticated-shell", () => ({
  useWorkspaceShell: () => ({ workspaceLabel: "ProLine Plumbing" }),
}));

import { ProfessionalDashboard } from "./professional-dashboard";

function ok(data: unknown) {
  return Promise.resolve({ ok: true, json: async () => ({ data }) } as Response);
}

describe("ProfessionalDashboard", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/professional/dashboard")) {
          return ok({
            metrics: {
              new_enquiries: 5,
              quotations_awaiting_response: 3,
              upcoming_bookings: 4,
              jobs_in_progress: 2,
              outstanding_payments: 2,
              recent_reviews: 1,
              average_rating: 5,
              completed_jobs: 8,
              completion_rate: 80,
              revenue_minor: 8545000,
            },
            recent: [
              {
                id: "job-1",
                title: "Leak repair",
                status: "IN_PROGRESS",
                updatedAt: new Date().toISOString(),
                actionTarget: "/professional/jobs/job-1",
              },
            ],
            generatedAt: new Date().toISOString(),
          });
        }
        if (url.endsWith("/professional/profile")) {
          return ok({
            organisationId: "org-1",
            professionalProfileId: "profile-1",
            slug: "proline-plumbing",
            businessName: "ProLine Plumbing",
            organisationStatus: "active",
            description: "Trusted plumbing services across Nairobi.",
            primaryCategory: "Plumbing",
            operatingLocation: "Westlands",
            serviceAreas: ["Westlands", "Kilimani"],
            availabilitySummary: "Weekdays",
            verificationStatus: "verified",
            logoAssetId: "asset-1",
            logoUrl: "/logo.png",
            portfolio: [{ id: "portfolio-1" }],
            updatedAt: new Date().toISOString(),
          });
        }
        if (url.endsWith("/professional/team")) {
          return ok({
            members: [
              { id: "member-1", name: "Alex", status: "active" },
              { id: "member-2", name: "Sam", status: "active" },
            ],
            invitations: [{ id: "invite-1", status: "pending" }],
            canManage: true,
          });
        }
        if (url.includes("/professional/calendar")) {
          return ok([
            {
              id: "booking-1",
              serviceName: "Leak repair",
              clientName: "Peter",
              status: "CONFIRMED",
              membershipId: "member-1",
              assignmentName: "Alex",
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 3_600_000).toISOString(),
              timezone: "Africa/Nairobi",
            },
          ]);
        }
        return ok([
          {
            id: "review-1",
            clientName: "Jane",
            overallRating: 5,
            feedback: "Clear communication and excellent work.",
            status: "PUBLISHED",
          },
        ]);
      }),
    );
  });

  it("renders the mockup-aligned operations dashboard from live response data", async () => {
    render(<ProfessionalDashboard />);

    expect(
      await screen.findByRole("heading", { name: /ProLine Plumbing/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("New enquiries")).toBeInTheDocument();
    expect(screen.getByText("Business performance")).toBeInTheDocument();
    expect(screen.getByText("Team today")).toBeInTheDocument();
    expect(screen.getByText("Today’s schedule")).toBeInTheDocument();
    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText(/85,450/)).toBeInTheDocument();
    expect(screen.getByText(/Clear communication and excellent work/)).toBeInTheDocument();

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
  });
});
