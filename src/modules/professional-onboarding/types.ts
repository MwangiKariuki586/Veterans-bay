import type { WorkingHours } from "../../platform/database/schema/professional-onboarding";

export const organisationStatuses = [
  "draft",
  "pending_review",
  "active",
  "requires_changes",
  "suspended",
  "deactivated",
] as const;

export type OrganisationStatus = (typeof organisationStatuses)[number];

export interface OnboardingHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  createdAt: string;
}

export interface VerificationDocumentSummary {
  id: string;
  assetId: string;
  documentType: string;
  fileName: string;
}

export interface OnboardingSummary {
  organisationId: string;
  professionalProfileId: string;
  name: string;
  slug: string;
  status: OrganisationStatus;
  businessType: "independent" | "business" | null;
  primaryCategory: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  operatingLocation: string | null;
  experienceStartedYear: number | null;
  serviceAreas: string[];
  workingHours: WorkingHours;
  logoAssetId: string | null;
  verificationType: string | null;
  verificationReference: string | null;
  verificationStatus: string;
  termsAccepted: boolean;
  submittedAt: string | null;
  documents: VerificationDocumentSummary[];
  history: OnboardingHistoryItem[];
  readiness: {
    complete: boolean;
    completedCount: number;
    totalCount: number;
    missingFields: string[];
  };
  updatedAt: string;
}

export interface AdminProfessionalReviewQueueItem {
  organisationId: string;
  name: string;
  status: OrganisationStatus;
  primaryCategory: string | null;
  operatingLocation: string | null;
  verificationStatus: string;
  submittedAt: string | null;
  updatedAt: string;
  evidenceCount: number;
}

export interface AdminProfessionalReviewQueue {
  items: AdminProfessionalReviewQueueItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
