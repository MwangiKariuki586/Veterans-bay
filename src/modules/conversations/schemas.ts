import { z } from "zod";

export const conversationRequestIdSchema = z.string().uuid();

export const sendConversationMessageBodySchema = z.object({
  idempotencyKey: z.string().uuid(),
  body: z.string().trim().min(1).max(4_000),
  assetIds: z.array(z.string().uuid()).max(5).default([]),
});

export const conversationAttachmentIdSchema = z.string().uuid();
