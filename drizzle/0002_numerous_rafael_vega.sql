CREATE TABLE "dead_letter_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"consumer_name" text NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"failure_category" text NOT NULL,
	"attempt_count" integer NOT NULL,
	"payload" jsonb,
	"resolution_state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "dead_letter_events_resolution_check" CHECK ("dead_letter_events"."resolution_state" in ('open', 'retried', 'discarded')),
	CONSTRAINT "dead_letter_events_attempt_count_check" CHECK ("dead_letter_events"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "outbox_proof_effects" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"marker" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_events" (
	"event_id" uuid NOT NULL,
	"consumer_name" text NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_events_event_id_consumer_name_pk" PRIMARY KEY("event_id","consumer_name")
);
--> statement-breakpoint
CREATE INDEX "dead_letter_events_open_idx" ON "dead_letter_events" USING btree ("resolution_state","created_at");--> statement-breakpoint
CREATE INDEX "processed_events_consumer_idx" ON "processed_events" USING btree ("consumer_name","processed_at");