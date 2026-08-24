export type DashboardRange = { from: string; to: string };

export interface ClientDashboardActionItem {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  tone: "purple" | "blue" | "green" | "orange";
}

export interface ClientDashboardSpending {
  currentMonthMinor: number;
  previousMonthMinor: number;
  outstandingMinor: number;
  outstandingCount: number;
  upcomingBookings: number;
  avgServiceCostMinor: number;
  previousAvgServiceCostMinor: number;
  nextBookingAt: string | null;
  series: Array<{ day: string; value: number }>;
  range: DashboardRange;
}

export interface ClientDashboardProfessional {
  id: string;
  name: string;
  specialty: string;
  rating: number | null;
  reviewCount: number;
  imageUrl: string | null;
  organisationSlug: string;
  href: string;
  verifiedJobs: number | null;
}

export interface ClientDashboardBooking {
  id: string;
  bookingNumber: string;
  professionalName: string;
  professionalImageUrl: string | null;
  serviceName: string;
  scheduledAt: string;
  endsAt: string | null;
  status: string;
  href: string;
  serviceSlug?: string | null;
}

export interface ClientDashboardRecommended {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  priceMinor: number | null;
  currency: string;
  imageUrl: string | null;
  organisationSlug: string;
  organisationName: string;
  rating: number | null;
  reviewCount: number;
  href: string;
}

export interface ClientDashboardData {
  metrics: Record<string, number | null>;
  restrictedMetrics: string[];
  recent: Array<{
    id: string;
    title: string;
    status?: string;
    updatedAt: string;
    actionTarget: string;
  }>;
  generatedAt: string;
  source: "transactional";
  range: DashboardRange;
  summary: {
    openRequests: number;
    quotesToReview: number;
    upcomingBookings: number;
    activeJobs: number;
    outstandingPaymentsMinor: number;
    outstandingPaymentsCount: number;
    nextBookingAt: string | null;
  };
  serviceProtection: {
    score: number;
    status: "Excellent" | "Good" | "Needs attention";
    activeWarranties: number;
    paymentsDue: number;
    savedProfessionals: number;
  };
  actionCentre: ClientDashboardActionItem[];
  spending: ClientDashboardSpending;
  professionals: ClientDashboardProfessional[];
  upcomingBookings: ClientDashboardBooking[];
  protectionPayments: {
    totalSpentYtdMinor: number;
    outstandingMinor: number;
    outstandingCount: number;
    paymentMethodLast4: string | null;
    activeWarranties: number;
  };
  recommended: ClientDashboardRecommended[];
  serverTiming?: { databaseMs: number; aggregationMs: number };
}

export interface ProfessionalDashboardAction {
  id: string;
  title: string;
  meta: string;
  href: string;
  action: string;
  tone: "danger" | "warning" | "info" | "neutral";
}

export interface ProfessionalDashboardData {
  metrics: Record<string, number | null>;
  restrictedMetrics: string[];
  recent: Array<{
    id: string;
    title: string;
    status?: string;
    updatedAt: string;
    actionTarget: string;
  }>;
  summary: {
    newEnquiries: number;
    urgentEnquiries: number;
    quotationsAwaitingDecision: number;
    expiringQuotations: number;
    jobsToday: number;
    jobsNeedingCheckIn: number;
    jobsInProgress: number;
    upcomingBookings: number;
    outstandingInvoices: number;
    overdueInvoices: number;
    outstandingInvoicesMinor: number | null;
    revenueMinor: number | null;
    expectedPaymentsMinor: number | null;
    averageJobValueMinor: number | null;
    previousRevenueMinor: number | null;
    previousAverageJobValueMinor: number | null;
    nextInvoiceDueAt: string | null;
  };
  navigationBadges: {
    enquiries: number;
    quotations: number;
    invoices: number;
    reviews: number;
  };
  utilityBadges: { notifications: number; messages: number };
  profileVisibility: {
    score: number;
    status: "Excellent" | "Good" | "Needs attention";
    description: string;
    nextAction: string;
    nextActionHref: string;
  };
  actionGroups: Array<{
    id: "priority" | "today" | "follow-up";
    label: string;
    items: ProfessionalDashboardAction[];
  }>;
  schedule: Array<{
    id: string;
    reference: string;
    timeRange: string;
    serviceName: string;
    clientName: string;
    location: string;
    status: string;
    assignmentName: string;
    href: string;
    action: string;
  }>;
  scheduleSummary: {
    tomorrowJobs: number;
    weekJobs: number;
    unassignedToday: number;
  };
  performance: {
    range: DashboardRange;
    series: Array<{
      day: string;
      revenue: number | null;
      jobsCompleted: number;
      enquiries: number;
      quoteConversion: number;
    }>;
  };
  teamToday: {
    members: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      status: "available" | "on_job" | "unavailable";
    }>;
    available: number;
    onJobs: number;
    unavailable: number;
    conflicts: number;
  };
  marketplaceInsights: Array<{
    id: string;
    title: string;
    description: string;
    tone: "green" | "blue" | "violet" | "orange";
  }>;
  reputation: {
    averageRating: number;
    reviewCount: number;
    newReviews: number;
    responseRate: number;
    topStrengths: string[];
    latestReview: null | {
      feedback: string;
      clientName: string;
      submittedAt: string;
    };
  };
  range: DashboardRange;
  generatedAt: string;
  source: "transactional";
  serverTiming?: { databaseMs: number; aggregationMs: number };
}
