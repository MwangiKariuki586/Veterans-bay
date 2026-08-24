import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientDashboardData } from "@/modules/dashboards/types";

vi.mock("@/components/workspace/authenticated-shell", () => ({ useWorkspaceShell: () => ({ workspaceLabel: "Alex" }) }));

const setRange = vi.fn();
const refresh = vi.fn();
const mockData: ClientDashboardData = {
  metrics: {
    active_requests: 2,
    pending_quotations: 3,
    upcoming_bookings: 2,
    active_jobs: 1,
    completion_confirmations: 1,
    active_warranties: 3,
    outstanding_payments_minor: 485000,
    outstanding_payments_count: 1,
  },
  restrictedMetrics: [],
  recent: [],
  generatedAt: "2026-08-24T17:24:00.000Z",
  source: "transactional",
  range: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
  summary: {
    openRequests: 2,
    quotesToReview: 3,
    upcomingBookings: 2,
    activeJobs: 1,
    outstandingPaymentsMinor: 485000,
    outstandingPaymentsCount: 1,
    nextBookingAt: "2026-08-25T07:00:00.000Z",
  },
  serviceProtection: {
    score: 85,
    status: "Good",
    activeWarranties: 3,
    paymentsDue: 1,
    savedProfessionals: 2,
  },
  actionCentre: [
    { id: "1", title: "Review 3 quotations", description: "New quotes received for your plumbing repair.", actionLabel: "Review now", href: "/client/quotations", tone: "purple" },
    { id: "2", title: "Invoice INV-1048 is ready", description: "Total amount KSh 4,850. Payment due.", actionLabel: "View invoice", href: "/client/invoices/1", tone: "blue" },
    { id: "3", title: "Confirm completion for plumbing repair", description: "Job #JOB-2315 is awaiting your confirmation.", actionLabel: "Review job", href: "/client/jobs/1", tone: "green" },
    { id: "4", title: "Warranty expiring soon", description: "AC Maintenance warranty expires in 18 days.", actionLabel: "View warranty", href: "/client/warranties/1", tone: "orange" },
  ],
  spending: {
    currentMonthMinor: 4538000,
    previousMonthMinor: 4050000,
    outstandingMinor: 485000,
    outstandingCount: 1,
    upcomingBookings: 2,
    avgServiceCostMinor: 756300,
    previousAvgServiceCostMinor: 700000,
    nextBookingAt: "2026-08-25T07:00:00.000Z",
    series: [
      { day: "2026-08-01", value: 0 },
      { day: "2026-08-05", value: 150000 },
      { day: "2026-08-09", value: 180000 },
      { day: "2026-08-13", value: 120000 },
      { day: "2026-08-17", value: 320000 },
      { day: "2026-08-21", value: 480000 },
      { day: "2026-08-25", value: 310000 },
      { day: "2026-08-31", value: 400000 },
    ],
    range: { from: "2026-08-01T00:00:00.000Z", to: "2026-09-01T00:00:00.000Z" },
  },
  professionals: [
    { id: "1", name: "David Mwangi", specialty: "Plumbing Specialist", rating: 4.8, reviewCount: 124, imageUrl: null, organisationSlug: "david-mwangi", href: "/professionals/david-mwangi", verifiedJobs: 42 },
    { id: "2", name: "Brian Otieno", specialty: "Electrician", rating: 4.9, reviewCount: 98, imageUrl: null, organisationSlug: "brian-otieno", href: "/professionals/brian-otieno", verifiedJobs: 35 },
    { id: "3", name: "Grace Achieng'", specialty: "Cleaning Expert", rating: 4.7, reviewCount: 76, imageUrl: null, organisationSlug: "grace-achieng", href: "/professionals/grace-achieng", verifiedJobs: 28 },
  ],
  upcomingBookings: [
    { id: "b1", bookingNumber: "BK-4291", professionalName: "David Mwangi", professionalImageUrl: null, serviceName: "Plumbing Repair", scheduledAt: "2026-08-25T07:00:00.000Z", endsAt: null, status: "CONFIRMED", href: "/client/bookings/b1" },
    { id: "b2", bookingNumber: "BK-4292", professionalName: "Brian Otieno", professionalImageUrl: null, serviceName: "AC Maintenance", scheduledAt: "2026-08-31T11:00:00.000Z", endsAt: null, status: "SCHEDULED", href: "/client/bookings/b2" },
    { id: "b3", bookingNumber: "BK-4293", professionalName: "Grace Achieng'", professionalImageUrl: null, serviceName: "Home Deep Cleaning", scheduledAt: "2026-09-01T06:00:00.000Z", endsAt: null, status: "SCHEDULED", href: "/client/bookings/b3" },
    { id: "b4", bookingNumber: "BK-4294", professionalName: "Samuel Kibera", professionalImageUrl: null, serviceName: "Appliance Repair", scheduledAt: "2026-09-02T08:00:00.000Z", endsAt: null, status: "IN_PROGRESS", href: "/client/bookings/b4" },
  ],
  protectionPayments: {
    totalSpentYtdMinor: 18624000,
    outstandingMinor: 485000,
    outstandingCount: 1,
    paymentMethodLast4: "4567",
    activeWarranties: 3,
  },
  recommended: [
    { id: "s1", slug: "home-deep-cleaning", name: "Home Deep Cleaning", category: "Cleaning", priceMinor: 350000, currency: "KES", imageUrl: "/images/category-cleaning.png", organisationSlug: "spotless", organisationName: "Spotless Home", rating: 4.8, reviewCount: 124, href: "/services/home-deep-cleaning" },
    { id: "s2", slug: "ac-maintenance", name: "AC Maintenance", category: "Appliance", priceMinor: 400000, currency: "KES", imageUrl: "/images/category-appliance.png", organisationSlug: "cool-air", organisationName: "Cool Air", rating: 4.7, reviewCount: 96, href: "/services/ac-maintenance" },
    { id: "s3", slug: "appliance-repair", name: "Appliance Repair", category: "Appliance", priceMinor: 380000, currency: "KES", imageUrl: "/images/category-appliance.png", organisationSlug: "fix-it", organisationName: "Fix It", rating: 4.9, reviewCount: 78, href: "/services/appliance-repair" },
    { id: "s4", slug: "electrical-services", name: "Electrical Services", category: "Electrical", priceMinor: 250000, currency: "KES", imageUrl: "/images/category-electrical.png", organisationSlug: "bright-spark", organisationName: "Bright Spark", rating: 4.6, reviewCount: 63, href: "/services/electrical-services" },
  ],
};
let dashboardData = mockData;

vi.mock("@/components/workspace/client-dashboard-context", () => ({
  useClientDashboard: () => ({ data: dashboardData, loading: false, error: null, range: "month" as const, setRange, refresh }),
}));

import { ClientDashboard } from "./client-dashboard";

describe("client dashboard", () => {
  beforeEach(() => {
    dashboardData = mockData;
  });

  it("renders mockup sections with authoritative data", () => {
    render(<ClientDashboard />);
    // Header greeting + actions
    expect(screen.getByText(/Good (morning|afternoon|evening), Alex!/)).toBeInTheDocument();
    expect(screen.getByText(/Find service/i)).toBeInTheDocument();
    expect(screen.getByText(/Post request/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Find service/i }).parentElement).toHaveClass(
      "justify-end",
      "sm:ml-auto",
    );
    // Top metrics - use all queries for duplicate text
    expect(screen.getByText("Open requests")).toBeInTheDocument();
    expect(screen.getByText("Quotes to review")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming bookings").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Active jobs")).toBeInTheDocument();
    expect(screen.getByText("Outstanding payments")).toBeInTheDocument();
    // Service protection
    expect(screen.getByText("Service protection")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText(/3 active warranties/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View protection/i })).toHaveClass("text-trust");
    expect(screen.getByRole("link", { name: /View protection/i })).not.toHaveClass("border");
    // Action centre
    expect(screen.getByText("Action centre")).toBeInTheDocument();
    expect(screen.getByText("Review 3 quotations")).toBeInTheDocument();
    // Spending
    expect(screen.getByText("Spending & service activity")).toBeInTheDocument();
    expect(screen.getByText(/45,380/)).toBeInTheDocument();
    // Professionals
    expect(screen.getByText("Your professionals")).toBeInTheDocument();
    expect(screen.getAllByText("David Mwangi").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: "Message" })[0]).toHaveClass("text-muted-foreground");
    expect(screen.getAllByRole("button", { name: "Message" })[0]).not.toHaveClass("bg-primary");
    expect(screen.getAllByRole("link", { name: "Book again" })[0]).toHaveClass("bg-primary");
    expect(screen.getAllByRole("link", { name: "Book again" })[0]).toHaveAttribute(
      "href",
      "/professionals/david-mwangi",
    );
    // Upcoming bookings table row
    expect(screen.getAllByText("BK-4291").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Plumbing Repair").length).toBeGreaterThanOrEqual(1);
    const bookingActions = screen.getAllByRole("link", {
      name: "View details for BK-4291",
    });
    expect(bookingActions.length).toBeGreaterThanOrEqual(1);
    expect(bookingActions[0]).toHaveAttribute("href", "/client/bookings/b1");
    expect(bookingActions[0]).toHaveClass("min-h-9", "text-trust");
    // Protection & payments
    expect(screen.getByText("Protection & payments")).toBeInTheDocument();
    expect(screen.getByText(/186,240/)).toBeInTheDocument();
    expect(screen.getByText("•••• 4567")).toBeInTheDocument();
    // Recommended
    expect(screen.getByText("Recommended for you")).toBeInTheDocument();
    expect(screen.getAllByText("Home Deep Cleaning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("link", { name: "View more" })).toHaveClass(
      "text-trust",
    );
    const serviceCard = screen.getByRole("link", {
      name: "View Home Deep Cleaning",
    });
    expect(serviceCard).toHaveClass("group", "focus-visible:ring-2");
    expect(serviceCard).toHaveAttribute(
      "href",
      "/services/home-deep-cleaning",
    );
    expect(screen.getAllByText("View service").length).toBe(4);
    expect(screen.getAllByText("4.8").length).toBeGreaterThanOrEqual(1);
  });

  it("supports spending period change", () => {
    render(<ClientDashboard />);
    const select = screen.getByLabelText("Spending period");
    fireEvent.change(select, { target: { value: "30-days" } });
    expect(setRange).toHaveBeenCalledWith("30-days");
  });

  it("shows a truthful action when there are no upcoming bookings", () => {
    dashboardData = {
      ...mockData,
      upcomingBookings: [],
    };

    render(<ClientDashboard />);

    expect(screen.getByText("No upcoming bookings")).toBeInTheDocument();
    expect(screen.getByText("Confirmed bookings will appear here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a service" })).toHaveAttribute(
      "href",
      "/marketplace",
    );
    expect(screen.queryByText("BK-4291")).not.toBeInTheDocument();
  });

  it("shows a marketplace action when recommendations are unavailable", () => {
    dashboardData = {
      ...mockData,
      recommended: [],
    };

    render(<ClientDashboard />);

    expect(screen.getByText("No recommendations yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore services" })).toHaveAttribute(
      "href",
      "/marketplace",
    );
    expect(screen.queryByText("View service")).not.toBeInTheDocument();
  });
});
