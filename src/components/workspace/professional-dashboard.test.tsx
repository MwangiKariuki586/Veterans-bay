import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProfessionalDashboardData } from "@/modules/dashboards/types";

vi.mock("@/components/workspace/authenticated-shell", () => ({ useWorkspaceShell: () => ({ workspaceLabel: "ProLine Plumbing" }) }));
const setRange = vi.fn();
const data: ProfessionalDashboardData = {
  metrics: {}, restrictedMetrics: [], recent: [],
  summary: { newEnquiries: 5, urgentEnquiries: 3, quotationsAwaitingDecision: 3, expiringQuotations: 1, jobsToday: 4, jobsNeedingCheckIn: 1, jobsInProgress: 2, upcomingBookings: 4, outstandingInvoices: 2, overdueInvoices: 2, outstandingInvoicesMinor: 2450000, revenueMinor: 8545000, expectedPaymentsMinor: 6120000, averageJobValueMinor: 305200 },
  navigationBadges: { enquiries: 5, quotations: 3, invoices: 2, reviews: 12 }, utilityBadges: { notifications: 6, messages: 3 },
  profileVisibility: { score: 92, status: "Excellent", description: "Your profile is highly visible in the marketplace.", nextAction: "Add portfolio photos", nextActionHref: "/professional/profile" },
  actionGroups: [{ id: "priority", label: "High priority", items: [{ id: "request-1", title: "Respond to Peter’s plumbing enquiry", meta: "Leak repair at Westlands", href: "/professional/enquiries/request-1", action: "Respond", tone: "danger" }] }],
  schedule: [{ id: "booking-1", timeRange: "10:00 AM–12:00 PM", serviceName: "Leak repair", clientName: "Peter Mwangi", location: "Westlands", status: "IN_PROGRESS", assignmentName: "Alex", href: "/professional/bookings/booking-1", action: "Check in" }],
  performance: { range: { from: "2026-08-01", to: "2026-08-03" }, series: [{ day: "2026-08-01", revenue: 1500000, jobsCompleted: 2, enquiries: 3, quoteConversion: 50 }] },
  teamToday: { members: [{ id: "member-1", name: "Alex Kimani", imageUrl: null, status: "available" }], available: 1, onJobs: 1, unavailable: 0, conflicts: 0 },
  marketplaceInsights: [{ id: "demand", title: "Plumbing demand is active in Westlands", description: "5 open enquiries currently need attention.", tone: "green" }],
  reputation: { averageRating: 4.9, reviewCount: 126, newReviews: 12, responseRate: 98, topStrengths: ["Clear communication"], latestReview: { feedback: "Clear communication and excellent work.", clientName: "Jane M.", submittedAt: "2026-08-02" } },
  range: { from: "2026-08-01", to: "2026-08-03" }, generatedAt: "2026-08-03T08:00:00Z", source: "transactional",
};

vi.mock("@/components/workspace/professional-dashboard-context", () => ({ useProfessionalDashboard: () => ({ data, loading: false, error: null, range: "month", setRange, refresh: vi.fn() }) }));

import { ProfessionalDashboard } from "./professional-dashboard";

describe("ProfessionalDashboard", () => {
  it("renders populated operating data from the consolidated dashboard response", () => {
    render(<ProfessionalDashboard />);
    expect(screen.getByRole("heading", { name: /ProLine Plumbing/i })).toBeInTheDocument();
    expect(screen.getByText("Business performance")).toBeInTheDocument();
    expect(screen.getByText("Today’s schedule")).toBeInTheDocument();
    expect(screen.getByText(/85,450/)).toBeInTheDocument();
    expect(screen.getByText(/Clear communication and excellent work/)).toBeInTheDocument();
  });

  it("changes chart measure and date range", () => {
    render(<ProfessionalDashboard />);
    fireEvent.click(screen.getByRole("tab", { name: "Enquiries" }));
    expect(screen.getByRole("tab", { name: "Enquiries" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Performance date range"), { target: { value: "30-days" } });
    expect(setRange).toHaveBeenCalledWith("30-days");
  });
});
