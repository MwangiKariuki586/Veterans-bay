import type { PageResult } from "../../platform/http/pagination";

export const jobStatuses = [
  "CREATED",
  "SCHEDULED",
  "TEAM_ASSIGNED",
  "EN_ROUTE",
  "IN_PROGRESS",
  "ON_HOLD",
  "AWAITING_CLIENT_CONFIRMATION",
  "COMPLETED",
  "RETURN_VISIT_REQUIRED",
  "CANCELLED",
  "DISPUTED",
] as const;

export type JobStatus = (typeof jobStatuses)[number];
export type JobAudience = "client" | "professional";
export type JobPage = PageResult<JobSummary>;

export interface JobSummary {
  id: string;
  bookingId: string;
  serviceName: string;
  status: JobStatus;
  providerName: string;
  clientName: string;
  scheduledStartsAt: string | null;
  scheduledEndsAt: string | null;
  timezone: string;
  totalMinor: number;
  currency: string;
  assignmentNames: string[];
  updatedAt: string;
}

export interface JobAssignment {
  id: string;
  membershipId: string;
  displayName: string;
  active: boolean;
  assignedAt: string;
  unassignedAt: string | null;
  reason: string | null;
}

export interface JobHistoryItem {
  id: string;
  action: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus;
  reason: string | null;
  createdAt: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  required: boolean;
  position: number;
  completed: boolean;
  resultNote: string | null;
  completedAt: string | null;
}

export interface JobUpdate {
  id: string;
  updateType: "PROGRESS" | "NOTE" | "MATERIAL" | "EXPENSE" | "CLARIFICATION";
  visibility: "CLIENT" | "PROFESSIONAL";
  content: string;
  quantity: number | null;
  amountMinor: number | null;
  currency: string | null;
  createdAt: string;
}

export interface JobEvidenceItem {
  id: string;
  assetId: string;
  evidenceType: "BEFORE" | "PROGRESS" | "AFTER" | "VARIATION" | "COMPLETION";
  visibility: "CLIENT" | "PROFESSIONAL";
  caption: string | null;
  createdAt: string;
}

export interface JobVariation {
  id: string;
  sequence: number;
  status: "DRAFT" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  description: string;
  reason: string;
  additionalAmountMinor: number;
  currency: string;
  scheduleImpactMinutes: number;
  submittedAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  responseComment: string | null;
}

export interface JobCompletionResponse {
  id: string;
  attempt: number;
  responseType:
    | "CONFIRMED"
    | "CONFIRMED_WITH_COMMENTS"
    | "UNRESOLVED"
    | "CLARIFICATION_REQUESTED"
    | "AUTO_CONFIRMED";
  comments: string | null;
  createdAt: string;
}

export interface JobDetail extends JobSummary {
  organisationId: string;
  clientAccountId: string;
  lockVersion: number;
  scopeSnapshot: string;
  exclusionsSnapshot: string;
  warrantyTermsSnapshot: string;
  paymentTermsSnapshot: string;
  baseTotalMinor: number;
  approvedVariationTotalMinor: number;
  checkedInAt: string | null;
  startedAt: string | null;
  awaitingConfirmationAt: string | null;
  completedAt: string | null;
  assignments: JobAssignment[];
  checklist: JobChecklistItem[];
  updates: JobUpdate[];
  evidence: JobEvidenceItem[];
  variations: JobVariation[];
  history: JobHistoryItem[];
  completionResponses: JobCompletionResponse[];
  conversationId: string | null;
}
