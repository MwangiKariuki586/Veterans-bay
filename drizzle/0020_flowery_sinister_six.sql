CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_account_id" uuid NOT NULL,
	"organisation_id" uuid,
	"source_event_id" uuid NOT NULL,
	"source_event_type" text NOT NULL,
	"source_aggregate_type" text NOT NULL,
	"source_aggregate_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_target" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_source_recipient_unique" UNIQUE("source_event_id","recipient_account_id"),
	CONSTRAINT "notifications_event_type_check" CHECK (char_length("notifications"."source_event_type") between 1 and 120),
	CONSTRAINT "notifications_title_check" CHECK (char_length(trim("notifications"."title")) between 1 and 160),
	CONSTRAINT "notifications_body_check" CHECK (char_length(trim("notifications"."body")) between 1 and 500),
	CONSTRAINT "notifications_action_target_check" CHECK ("notifications"."action_target" is null
        or ("notifications"."action_target" ~ '^/[a-z0-9/_?=&.%:-]+$'
          and "notifications"."action_target" not like '//%'
          and char_length("notifications"."action_target") <= 500))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_account_id_account_profiles_id_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_account_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_account_id","created_at","id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "notifications_organisation_idx" ON "notifications" USING btree ("organisation_id","created_at");