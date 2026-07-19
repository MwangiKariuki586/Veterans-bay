import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClientDashboard } from "./client-dashboard";

describe("client dashboard", () => {
  it("renders greeting stats and recent bookings", () => {
    render(<ClientDashboard />);

    expect(screen.getByText(/Good morning/)).toBeInTheDocument();
    expect(screen.getByText("Jobs Booked")).toBeInTheDocument();
    expect(screen.getByText("Recent Bookings")).toBeInTheDocument();
    expect(screen.getAllByText("Plumbing Inspection").length).toBeGreaterThan(0);
  });
});
