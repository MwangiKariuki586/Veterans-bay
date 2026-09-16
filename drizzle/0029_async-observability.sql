CREATE TABLE "event_processing_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"consumer_name" text NOT NULL,
	"event_type" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"outcome" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_processing_attempts_outcome_check" CHECK ("event_processing_attempts"."outcome" in ('ack','duplicate','retry','dead_letter')),
	CONSTRAINT "event_processing_attempts_values_check" CHECK ("event_processing_attempts"."attempt_number" > 0 and "event_processing_attempts"."duration_ms" >= 0)
);
--> statement-breakpoint
CREATE INDEX "event_processing_attempts_consumer_idx" ON "event_processing_attempts" USING btree ("consumer_name","created_at");--> statement-breakpoint
CREATE INDEX "event_processing_attempts_event_idx" ON "event_processing_attempts" USING btree ("event_id","created_at");