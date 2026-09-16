import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDashboard } from "./admin-dashboard";

describe("admin dashboard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders scoped operational metrics and event trend", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            metrics: {
              pending_professional_reviews: 2,
              active_professionals: 14,
              new_requests: 8,
              completed_jobs: 6,
              open_reports: 1,
              active_disputes: 1,
              completion_rate: 75,
            },
            recent: [],
            engagementTrend: [{ day: "2026-07-28", value: 4 }],
            generatedAt: "2026-07-28T08:00:00.000Z",
            source: "event-backed-live-summary",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    render(<AdminDashboard />);

    expect(await screen.findByText("Open reports")).toBeInTheDocument();
    expect(screen.getByText("Marketplace engagement trend")).toBeInTheDocument();
    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });
});
