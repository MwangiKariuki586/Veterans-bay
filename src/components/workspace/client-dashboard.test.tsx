import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientDashboard } from "./client-dashboard";

describe("client dashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders authoritative metrics and recent history", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            metrics: {
              active_requests: 2,
              pending_quotations: 1,
              upcoming_bookings: 3,
              active_jobs: 1,
              completion_confirmations: 1,
              active_warranties: 2,
            },
            recent: [
              {
                id: "job-1",
                title: "Plumbing inspection",
                status: "IN_PROGRESS",
                updatedAt: "2026-07-28T08:00:00.000Z",
                actionTarget: "/client/jobs/job-1",
              },
            ],
            generatedAt: "2026-07-28T08:00:00.000Z",
            source: "transactional",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    render(<ClientDashboard />);

    expect(await screen.findByText("Active requests")).toBeInTheDocument();
    expect(screen.getByText("Recent history")).toBeInTheDocument();
    expect(screen.getByText("Plumbing inspection")).toBeInTheDocument();
  });
});
