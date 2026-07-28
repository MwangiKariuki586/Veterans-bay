export type ReviewStatus = "PUBLISHED" | "REPORTED" | "HIDDEN";

export interface ReviewItem {
  id: string;
  jobId: string;
  serviceName: string;
  providerName: string;
  clientName: string;
  overallRating: number;
  serviceQualityRating: number;
  communicationRating: number;
  timelinessRating: number;
  professionalismRating: number;
  valueRating: number;
  feedback: string;
  status: ReviewStatus;
  submittedAt: string;
  response: { body: string; createdAt: string } | null;
}

export interface ReviewEligibility {
  eligible: boolean;
  deadline: string | null;
  reason: string | null;
  review: ReviewItem | null;
}

export interface ReputationProjection {
  verifiedJobs: number;
  reviewCount: number;
  averageRating: number | null;
  responseRate: number;
  completionRate: number;
  repeatRate: number;
  cancellationRate: number;
  warrantyResolutionRate: number;
  disputeRate: number;
  recalculatedAt: string;
}

export interface PublicReview {
  id: string;
  clientName: string;
  overallRating: number;
  feedback: string;
  submittedAt: string;
  response: { body: string; createdAt: string } | null;
}
