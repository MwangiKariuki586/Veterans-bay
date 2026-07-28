import { z } from "zod";

const rating = z.number().int().min(1).max(5);
export const reviewIdSchema = z.string().uuid();
export const submitReviewBodySchema = z.object({
  overallRating: rating,
  serviceQualityRating: rating,
  communicationRating: rating,
  timelinessRating: rating,
  professionalismRating: rating,
  valueRating: rating,
  feedback: z.string().trim().min(3).max(4000),
});
export const respondReviewBodySchema = z.object({
  body: z.string().trim().min(2).max(2000),
});
export const reportReviewBodySchema = z.object({
  reason: z.enum(["ABUSIVE", "FALSE_INFORMATION", "PERSONAL_INFORMATION", "SPAM", "OTHER"]),
  details: z.string().trim().min(3).max(1000).optional(),
});
