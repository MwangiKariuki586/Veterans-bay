export interface ClientContextProfile {
  client: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    primaryEmail: string;
    phone: string | null;
    location: string | null;
    bio: string | null;
    verified: boolean;
    memberSince: string;
    preferredContactMethod: string | null;
  };
  relationship: {
    hasLegitimateRelationship: boolean;
    activeJob: {
      id: string;
      status: string;
      serviceName: string;
      scheduledStartsAt: string | null;
    } | null;
    completedJobsCount: number;
    totalJobsCount: number;
    lastCompletedAt: string | null;
    bookingsCount: number;
    quotationsCount: number;
  };
  jobLocation: {
    serviceLocation: string | null;
    bookingId: string | null;
    jobId: string | null;
    scheduledStartsAt: string | null;
  } | null;
  permissions: {
    canViewContact: boolean;
    canViewLocation: boolean;
    limitedView: boolean;
    limitedReason: string | null;
  };
}

export interface ClientContextQuery {
  organisationId: string;
  clientAccountId: string;
  actorAccountId: string;
  assignedJobsOnly: boolean;
  membershipId: string | null;
  contextId?: string | null;
  contextType?: "job" | "booking" | "request" | "customer" | null;
}
