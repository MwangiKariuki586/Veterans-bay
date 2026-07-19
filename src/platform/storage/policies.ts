export const storagePurposes = [
  "AVATAR",
  "PROFESSIONAL_LOGO",
  "PORTFOLIO_IMAGE",
  "SERVICE_IMAGE",
  "REQUEST_ATTACHMENT",
  "JOB_EVIDENCE",
  "VERIFICATION_DOCUMENT",
  "MESSAGE_ATTACHMENT",
  "PAYMENT_EVIDENCE",
  "WARRANTY_EVIDENCE",
  "DISPUTE_EVIDENCE",
] as const;

export type StoragePurpose = (typeof storagePurposes)[number];

export type StorageResourceType = "image" | "raw";

export interface StoragePurposePolicy {
  purpose: StoragePurpose;
  folder: string;
  resourceType: StorageResourceType;
  visibility: "public" | "private";
  maxBytes: number;
  allowedMimeTypes: readonly string[];
  allowsReplacement: boolean;
  historicalEvidence: boolean;
  requiresOrganisation: boolean;
}

const imageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const documentTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const storagePurposePolicies: Record<StoragePurpose, StoragePurposePolicy> =
  {
    AVATAR: {
      purpose: "AVATAR",
      folder: "veterans-bay/avatars",
      resourceType: "image",
      visibility: "public",
      maxBytes: 2 * 1024 * 1024,
      allowedMimeTypes: imageTypes,
      allowsReplacement: true,
      historicalEvidence: false,
      requiresOrganisation: false,
    },
    PROFESSIONAL_LOGO: {
      purpose: "PROFESSIONAL_LOGO",
      folder: "veterans-bay/logos",
      resourceType: "image",
      visibility: "public",
      maxBytes: 2 * 1024 * 1024,
      allowedMimeTypes: imageTypes,
      allowsReplacement: true,
      historicalEvidence: false,
      requiresOrganisation: true,
    },
    PORTFOLIO_IMAGE: {
      purpose: "PORTFOLIO_IMAGE",
      folder: "veterans-bay/portfolio",
      resourceType: "image",
      visibility: "public",
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: imageTypes,
      allowsReplacement: true,
      historicalEvidence: false,
      requiresOrganisation: true,
    },
    SERVICE_IMAGE: {
      purpose: "SERVICE_IMAGE",
      folder: "veterans-bay/services",
      resourceType: "image",
      visibility: "public",
      maxBytes: 5 * 1024 * 1024,
      allowedMimeTypes: imageTypes,
      allowsReplacement: true,
      historicalEvidence: false,
      requiresOrganisation: true,
    },
    REQUEST_ATTACHMENT: {
      purpose: "REQUEST_ATTACHMENT",
      folder: "veterans-bay/requests",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: false,
    },
    JOB_EVIDENCE: {
      purpose: "JOB_EVIDENCE",
      folder: "veterans-bay/jobs",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: true,
    },
    VERIFICATION_DOCUMENT: {
      purpose: "VERIFICATION_DOCUMENT",
      folder: "veterans-bay/verification",
      resourceType: "raw",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png"],
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: true,
    },
    MESSAGE_ATTACHMENT: {
      purpose: "MESSAGE_ATTACHMENT",
      folder: "veterans-bay/messages",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: false,
    },
    PAYMENT_EVIDENCE: {
      purpose: "PAYMENT_EVIDENCE",
      folder: "veterans-bay/payments",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: true,
    },
    WARRANTY_EVIDENCE: {
      purpose: "WARRANTY_EVIDENCE",
      folder: "veterans-bay/warranties",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: true,
    },
    DISPUTE_EVIDENCE: {
      purpose: "DISPUTE_EVIDENCE",
      folder: "veterans-bay/disputes",
      resourceType: "image",
      visibility: "private",
      maxBytes: 8 * 1024 * 1024,
      allowedMimeTypes: documentTypes,
      allowsReplacement: false,
      historicalEvidence: true,
      requiresOrganisation: true,
    },
  };

export function getStoragePurposePolicy(purpose: StoragePurpose): StoragePurposePolicy {
  return storagePurposePolicies[purpose];
}
