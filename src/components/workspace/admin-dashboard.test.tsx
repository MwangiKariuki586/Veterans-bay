import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminDashboard } from "./admin-dashboard";

describe("admin dashboard", () => {
  it("renders kpi row and latest bookings", () => {
    render(<AdminDashboard />);

    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("Latest Bookings")).toBeInTheDocument();
    expect(screen.getByText("VB-1042")).toBeInTheDocument();
  });
});
