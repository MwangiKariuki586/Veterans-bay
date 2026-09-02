import type { PageResult } from "../../platform/http/pagination";

export const warrantyStatuses = ["ACTIVE", "EXPIRED", "VOID"] as const;
export const warrantyClaimStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "RETURN_VISIT_SCHEDULED",
  "RESOLVED",
  "REJECTED",
  "ESCALATED",
] as const;

export type WarrantyStatus = (typeof warrantyStatuses)[number];
export type WarrantyClaimStatus = (typeof warrantyClaimStatuses)[number];
export type WarrantyPage = PageResult<WarrantySummary> & { summary: ClientWarrantySummary; services: string[] };

export interface ClientWarrantySummary {
  activeWarranties: number;
  expiringSoon: number;
  openClaims: number;
  resolvedClaims: number;
}

export interface WarrantySummary {
  id: string;
  jobId: string;
  serviceName: string;
  providerName: string;
  providerSlug: string;
  organisationId: string;
  clientName: string;
  status: WarrantyStatus;
  startsAt: string;
  endsAt: string;
  openClaimCount: number;
  latestClaimStatus: WarrantyClaimStatus | null;
  latestClaimSubject: string | null;
}

export interface WarrantyClaimEvidenceItem {
  id: string;
  assetId: string;
  evidenceType: "SUBMISSION" | "REVIEW" | "RESOLUTION";
  caption: string | null;
  createdAt: string;
}

export interface WarrantyClaimHistoryItem {
  id: string;
  action: string;
  fromStatus: WarrantyClaimStatus | null;
  toStatus: WarrantyClaimStatus;
  reason: string | null;
  createdAt: string;
}

export interface WarrantyClaim {
  id: string;
  sequence: number;
  status: WarrantyClaimStatus;
  subject: string;
  description: string;
  preferredResolution: string | null;
  decisionReason: string | null;
  returnVisitStartsAt: string | null;
  returnVisitEndsAt: string | null;
  resolutionNotes: string | null;
  lockVersion: number;
  submittedAt: string;
  reviewedAt: string | null;
  resolvedAt: string | null;
  rejectedAt: string | null;
  escalatedAt: string | null;
  evidence: WarrantyClaimEvidenceItem[];
  history: WarrantyClaimHistoryItem[];
}

export interface WarrantyDetail extends WarrantySummary {
  organisationId: string;
  clientAccountId: string;
  termsSnapshot: string;
  exclusionsSnapshot: string;
  claims: WarrantyClaim[];
}
