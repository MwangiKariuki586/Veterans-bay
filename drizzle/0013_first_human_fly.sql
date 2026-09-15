CREATE TABLE "engagement_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"activity_type" text NOT NULL,
	"actor_account_id" uuid,
	"summary" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engagement_activities_source_unique" UNIQUE("conversation_id","source_type","source_id")
);
--> statement-breakpoint
ALTER TABLE "engagement_activities" ADD CONSTRAINT "engagement_activities_conversation_id_engagement_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."engagement_conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagement_activities" ADD CONSTRAINT "engagement_activities_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engagement_activities_timeline_idx" ON "engagement_activities" USING btree ("conversation_id","occurred_at","id");--> statement-breakpoint
INSERT INTO "engagement_conversations" ("context_type", "context_id")
SELECT 'SERVICE_REQUEST', sr."id"::text
FROM "service_requests" sr
WHERE sr."organisation_id" IS NOT NULL
  AND sr."status" <> 'DRAFT'
ON CONFLICT ("context_type", "context_id") DO NOTHING;--> statement-breakpoint
INSERT INTO "engagement_activities" (
	"conversation_id",
	"source_type",
	"source_id",
	"activity_type",
	"actor_account_id",
	"summary",
	"metadata",
	"occurred_at"
)
SELECT
	c."id",
	'SERVICE_REQUEST_HISTORY',
	h."id"::text,
	h."action",
	h."actor_account_id",
	initcap(replace(lower(h."action"), '_', ' ')) || '.' ||
		CASE
			WHEN h."from_status" IS NOT NULL AND h."from_status" <> h."to_status"
			THEN ' Status changed from ' || replace(lower(h."from_status"), '_', ' ') ||
				' to ' || replace(lower(h."to_status"), '_', ' ') || '.'
			ELSE ''
		END ||
		CASE
			WHEN h."client_visible_note" IS NOT NULL
			THEN ' ' || h."client_visible_note"
			ELSE ''
		END,
	jsonb_build_object(
		'fromStatus', h."from_status",
		'toStatus', h."to_status"
	),
	h."created_at"
FROM "service_request_history" h
INNER JOIN "service_requests" sr ON sr."id" = h."request_id"
INNER JOIN "engagement_conversations" c
	ON c."context_type" = 'SERVICE_REQUEST'
	AND c."context_id" = sr."id"::text
WHERE h."action" <> 'PRIVATE_NOTE_ADDED'
ON CONFLICT ("conversation_id", "source_type", "source_id") DO NOTHING;
