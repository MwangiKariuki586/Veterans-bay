export const serviceRequestSources = [
  "MARKETPLACE_DISCOVERY",
  "PROFESSIONAL_BOOKING_LINK",
  "PROFESSIONAL_IMPORTED",
  "REPEAT_CLIENT",
  "DIRECT_SERVICE_PAGE",
] as const;

export const serviceRequestStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ASSESSMENT_REQUIRED",
  "QUOTED",
  "CONVERTED",
  "DECLINED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type ServiceRequestSource = (typeof serviceRequestSources)[number];
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number];
export type ServiceRequestUrgency = "FLEXIBLE" | "SOON" | "URGENT";
export type ServiceRequestContactPreference = "IN_APP" | "PHONE" | "EMAIL";

export interface ServiceRequestValues {
  source: ServiceRequestSource;
  category: string | null;
  preferredProfessionalSlug: string | null;
  preferredServiceSlug: string | null;
  description: string | null;
  location: string | null;
  preferredTime: string | null;
  budgetMinMinor: number | null;
  budgetMaxMinor: number | null;
  urgency: ServiceRequestUrgency | null;
  contactPreference: ServiceRequestContactPreference | null;
}

export interface ClientServiceRequest extends ServiceRequestValues {
  id: string;
  idempotencyKey: string;
  status: ServiceRequestStatus;
  version: number;
  preferredProfessionalName: string | null;
  preferredServiceName: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: ServiceRequestHistoryItem[];
  attachments: ServiceRequestAttachment[];
}

export interface ServiceRequestHistoryItem {
  id: string;
  action: string;
  fromStatus: ServiceRequestStatus | null;
  toStatus: ServiceRequestStatus;
  note: string | null;
  createdAt: string;
}

export interface ProfessionalServiceRequest
  extends Omit<ClientServiceRequest, "history"> {
  client: {
    displayName: string;
    primaryEmail: string;
    phone: string | null;
  };
  conversionEligible: boolean;
  history: Array<
    ServiceRequestHistoryItem & { privateProfessionalNote: string | null }
  >;
}

export interface ServiceRequestAttachment {
  id: string;
  assetId: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ServiceRequestOptions {
  categories: string[];
}
