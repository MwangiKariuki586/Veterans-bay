CREATE TABLE "analytics_daily_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"event_type" text NOT NULL,
	"organisation_id" uuid,
	"scope_key" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_counts_scope_unique" UNIQUE("day","event_type","scope_key"),
	CONSTRAINT "analytics_daily_counts_value_check" CHECK ("analytics_daily_counts"."event_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "analytics_daily_counts" ADD CONSTRAINT "analytics_daily_counts_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_counts_range_idx" ON "analytics_daily_counts" USING btree ("day","event_type");--> statement-breakpoint
CREATE INDEX "analytics_daily_counts_org_idx" ON "analytics_daily_counts" USING btree ("organisation_id","day");