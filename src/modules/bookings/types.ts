export const bookingStatuses = [
  "PENDING_CONFIRMATION",
  "PENDING_DEPOSIT",
  "CONFIRMED",
  "RESCHEDULE_REQUESTED",
  "RESCHEDULED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
] as const;

export type BookingStatus = (typeof bookingStatuses)[number];

export const bookingOrigins = [
  "ACCEPTED_QUOTATION",
  "DIRECT_SERVICE",
  "APPROVED_ASSESSMENT",
  "REPEAT_BOOKING",
  "PROFESSIONAL_CUSTOMER",
] as const;

export type BookingOrigin = (typeof bookingOrigins)[number];

export type BookingBucket =
  | "pending"
  | "scheduled"
  | "needs-action"
  | "closed";

export type BookingSort =
  | "updated_desc"
  | "updated_asc"
  | "starts_desc"
  | "starts_asc"
  | "total_desc"
  | "total_asc";

export interface BookingSummaryStats {
  total: number;
  pending: number;
  scheduled: number;
  needsAction: number;
  closed: number;
}

export interface BookingSummary {
  id: string;
  origin: BookingOrigin;
  status: BookingStatus;
  serviceName: string;
  serviceSlug: string | null;
  providerName: string;
  providerSlug: string | null;
  clientName: string;
  startsAt: string | null;
  endsAt: string | null;
  requestedStartAt: string | null;
  timezone: string;
  totalMinor: number;
  currency: string;
  assignmentName: string | null;
  updatedAt: string;
  professionalServiceId: string | null;
  jobId: string | null;
}

export interface BookingHistoryItem {
  id: string;
  action: string;
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus;
  previousStartsAt: string | null;
  previousEndsAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  membershipId: string | null;
  note: string | null;
  createdAt: string;
}

export interface BookingPaymentRequirement {
  id: string;
  requirementType: "DEPOSIT" | "BALANCE";
  status: "PENDING" | "SATISFIED" | "WAIVED" | "CANCELLED";
  amountMinor: number;
  currency: string;
  dueAt: string | null;
}

export interface BookingDetail extends BookingSummary {
  requestId: string | null;
  quotationId: string | null;
  professionalServiceId: string | null;
  sourceBookingId: string | null;
  organisationId: string;
  clientAccountId: string;
  createdByAccountId: string;
  assignedMembershipId: string | null;
  requestedMembershipId: string | null;
  proposedStartAt: string | null;
  requestedEndAt: string | null;
  cancellationPolicy: string;
  cancellationAcknowledgedAt: string | null;
  cancellationReason: string | null;
  scope: string;
  exclusions: string;
  warrantyTerms: string;
  paymentTerms: string;
  depositMinor: number;
  expectedDurationMinutes: number;
  lockVersion: number;
  createdAt: string;
  history: BookingHistoryItem[];
  paymentRequirements: BookingPaymentRequirement[];
}

export interface AvailabilityRule {
  id: string;
  membershipId: string;
  memberName: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
  active: boolean;
}

export interface AvailabilityBlock {
  id: string;
  membershipId: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface SchedulingMember {
  membershipId: string;
  accountProfileId: string;
  displayName: string;
  roleName: string;
}

export interface AvailabilityConfiguration {
  members: SchedulingMember[];
  rules: AvailabilityRule[];
  blocks: AvailabilityBlock[];
}

export interface BookingSlot {
  membershipId: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface CalendarEntry {
  id: string;
  serviceName: string;
  clientName: string;
  status: BookingStatus;
  membershipId: string;
  assignmentName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
}

export interface DirectBookingInput {
  origin: "DIRECT_SERVICE";
  professionalSlug: string;
  serviceSlug: string;
  membershipId: string;
  requestedStartAt: string;
  timezone: string;
  cancellationPolicyAcknowledged: true;
}

export interface RepeatBookingInput {
  origin: "REPEAT_BOOKING";
  sourceBookingId: string;
  membershipId: string;
  requestedStartAt: string;
  timezone: string;
  cancellationPolicyAcknowledged: true;
}

export type ClientCreateBookingInput =
  | DirectBookingInput
  | RepeatBookingInput;

export type ProfessionalCreateBookingInput =
  | {
      origin: "APPROVED_ASSESSMENT";
      requestId: string;
      serviceId: string;
      membershipId: string;
      requestedStartAt: string;
      timezone: string;
      cancellationPolicyAcknowledged: true;
    }
  | {
      origin: "PROFESSIONAL_CUSTOMER";
      clientAccountId: string;
      serviceId: string;
      membershipId: string;
      requestedStartAt: string;
      timezone: string;
      cancellationPolicyAcknowledged: true;
    }
  | {
      origin: "REPEAT_BOOKING";
      customerId: string;
      sourceBookingId: string;
      serviceId: string;
      membershipId: string;
      requestedStartAt: string;
      timezone: string;
      cancellationPolicyAcknowledged: true;
    };
