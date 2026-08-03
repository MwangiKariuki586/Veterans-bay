export type DashboardRange = { from: string; to: string };

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
    timeRange: string;
    serviceName: string;
    clientName: string;
    location: string;
    status: string;
    assignmentName: string;
    href: string;
    action: string;
  }>;
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
