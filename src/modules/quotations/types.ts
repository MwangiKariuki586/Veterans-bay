export const quotationStatuses = [
  "DRAFT",
  "SUBMITTED",
  "VIEWED",
  "ACCEPTED",
  "DECLINED",
  "REVISION_REQUESTED",
  "REPLACED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type QuotationStatus = (typeof quotationStatuses)[number];

export const quotationLineItemCategories = [
  "LABOUR",
  "MATERIAL",
  "TRANSPORT",
  "ADDITIONAL",
] as const;

export type QuotationLineItemCategory =
  (typeof quotationLineItemCategories)[number];

export interface QuotationLineItemInput {
  category: QuotationLineItemCategory;
  description: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface QuotationDraftValues {
  currency: string;
  lineItems: QuotationLineItemInput[];
  discountMinor: number;
  taxMinor: number;
  depositMinor: number;
  expectedDurationMinutes: number;
  proposedStartAt: string | null;
  validUntil: string;
  scope: string;
  exclusions: string;
  warrantyTerms: string;
  paymentTerms: string;
}

export interface QuotationLineItem extends QuotationLineItemInput {
  id: string;
  totalMinor: number;
  position: number;
}

export interface QuotationHistoryItem {
  id: string;
  versionNumber: number | null;
  action: string;
  fromStatus: QuotationStatus | null;
  toStatus: QuotationStatus;
  note: string | null;
  createdAt: string;
}

export interface QuotationVersion {
  id: string;
  versionNumber: number;
  status: QuotationStatus;
  currency: string;
  lineItems: QuotationLineItem[];
  labourMinor: number;
  materialsMinor: number;
  transportMinor: number;
  additionalChargesMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositMinor: number;
  expectedDurationMinutes: number;
  proposedStartAt: string | null;
  validUntil: string | null;
  scope: string;
  exclusions: string;
  warrantyTerms: string;
  paymentTerms: string;
  submittedAt: string | null;
  viewedAt: string | null;
  respondedAt: string | null;
  replacedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationSummary {
  id: string;
  requestId: string;
  organisationId: string;
  clientAccountId: string;
  status: QuotationStatus;
  currentVersionNumber: number;
  acceptedVersionNumber: number | null;
  lockVersion: number;
  providerName: string;
  clientName: string;
  requestCategory: string;
  currentTotalMinor: number;
  currency: string;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationDetail extends QuotationSummary {
  versions: QuotationVersion[];
  history: QuotationHistoryItem[];
  bookingId: string | null;
}

export interface QuotationComparison {
  from: QuotationVersion;
  to: QuotationVersion;
  totalDifferenceMinor: number;
  depositDifferenceMinor: number;
  durationDifferenceMinutes: number;
}
