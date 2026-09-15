ALTER TABLE "engagement_messages" DROP CONSTRAINT "engagement_messages_sender_idempotency_unique";--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" DROP CONSTRAINT "engagement_conversation_reads_conversation_id_account_id_pk";--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ADD COLUMN "participant_role" text;--> statement-breakpoint
ALTER TABLE "engagement_messages" ADD COLUMN "sender_role" text;--> statement-breakpoint
UPDATE "engagement_messages" em
SET "sender_role" = CASE
	WHEN sr."client_account_id" = em."sender_account_id" THEN 'CLIENT'
	ELSE 'PROFESSIONAL'
END
FROM "engagement_conversations" c
INNER JOIN "service_requests" sr
	ON c."context_type" = 'SERVICE_REQUEST'
	AND c."context_id" = sr."id"::text
WHERE em."conversation_id" = c."id";--> statement-breakpoint
UPDATE "engagement_conversation_reads" cr
SET "participant_role" = CASE
	WHEN sr."client_account_id" = cr."account_id" THEN 'CLIENT'
	ELSE 'PROFESSIONAL'
END
FROM "engagement_conversations" c
INNER JOIN "service_requests" sr
	ON c."context_type" = 'SERVICE_REQUEST'
	AND c."context_id" = sr."id"::text
WHERE cr."conversation_id" = c."id";--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ALTER COLUMN "participant_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_messages" ALTER COLUMN "sender_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ADD CONSTRAINT "engagement_conversation_reads_conversation_id_account_id_participant_role_pk" PRIMARY KEY("conversation_id","account_id","participant_role");--> statement-breakpoint
ALTER TABLE "engagement_messages" ADD CONSTRAINT "engagement_messages_sender_idempotency_unique" UNIQUE("conversation_id","sender_account_id","sender_role","idempotency_key");--> statement-breakpoint
ALTER TABLE "engagement_conversation_reads" ADD CONSTRAINT "engagement_conversation_reads_participant_role_check" CHECK ("engagement_conversation_reads"."participant_role" in ('CLIENT', 'PROFESSIONAL'));--> statement-breakpoint
ALTER TABLE "engagement_messages" ADD CONSTRAINT "engagement_messages_sender_role_check" CHECK ("engagement_messages"."sender_role" in ('CLIENT', 'PROFESSIONAL'));
