import { z } from "zod";

import { storagePurposes } from "../../platform/storage/policies";

export const uploadIntentBodySchema = z.object({
  purpose: z.enum(storagePurposes),
  mimeType: z.string().trim().min(3).max(120),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024),
  organisationId: z.uuid().nullable().optional(),
});

export const completeUploadBodySchema = z.object({
  publicId: z.string().trim().min(1).max(300),
});

export const linkAssetBodySchema = z.object({
  linkedEntityType: z.string().trim().min(1).max(80),
  linkedEntityId: z.string().trim().min(1).max(120),
});

export const replaceAssetBodySchema = z.object({
  replacementAssetId: z.uuid(),
});
