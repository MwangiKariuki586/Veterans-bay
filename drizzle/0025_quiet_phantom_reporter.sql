CREATE TABLE "professional_reputation" (
	"organisation_id" uuid PRIMARY KEY NOT NULL,
	"verified_jobs" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"average_rating_hundredths" integer,
	"response_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"completion_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"repeat_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"cancellation_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"warranty_resolution_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"dispute_rate_basis_points" integer DEFAULT 0 NOT NULL,
	"recalculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_reputation_counts_check" CHECK ("professional_reputation"."verified_jobs" >= 0 and "professional_reputation"."review_count" >= 0),
	CONSTRAINT "professional_reputation_rating_check" CHECK ("professional_reputation"."average_rating_hundredths" is null or "professional_reputation"."average_rating_hundredths" between 100 and 500),
	CONSTRAINT "professional_reputation_rates_check" CHECK ("professional_reputation"."response_rate_basis_points" between 0 and 10000 and "professional_reputation"."completion_rate_basis_points" between 0 and 10000 and "professional_reputation"."repeat_rate_basis_points" between 0 and 10000 and "professional_reputation"."cancellation_rate_basis_points" between 0 and 10000 and "professional_reputation"."warranty_resolution_rate_basis_points" between 0 and 10000 and "professional_reputation"."dispute_rate_basis_points" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "review_moderation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"reported_by_account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "review_reports_reporter_unique" UNIQUE("review_id","reported_by_account_id"),
	CONSTRAINT "review_reports_status_check" CHECK ("review_reports"."status" in ('PENDING', 'RESOLVED', 'DISMISSED'))
);
--> statement-breakpoint
CREATE TABLE "review_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"author_account_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_responses_review_unique" UNIQUE("review_id"),
	CONSTRAINT "review_responses_body_check" CHECK (char_length(trim("review_responses"."body")) between 2 and 2000)
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"overall_rating" integer NOT NULL,
	"service_quality_rating" integer NOT NULL,
	"communication_rating" integer NOT NULL,
	"timeliness_rating" integer NOT NULL,
	"professionalism_rating" integer NOT NULL,
	"value_rating" integer NOT NULL,
	"feedback" text NOT NULL,
	"status" text DEFAULT 'PUBLISHED' NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reported_at" timestamp with time zone,
	"moderated_at" timestamp with time zone,
	"moderation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_job_unique" UNIQUE("job_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."overall_rating" between 1 and 5 and "reviews"."service_quality_rating" between 1 and 5 and "reviews"."communication_rating" between 1 and 5 and "reviews"."timeliness_rating" between 1 and 5 and "reviews"."professionalism_rating" between 1 and 5 and "reviews"."value_rating" between 1 and 5),
	CONSTRAINT "reviews_feedback_check" CHECK (char_length(trim("reviews"."feedback")) between 3 and 4000),
	CONSTRAINT "reviews_status_check" CHECK ("reviews"."status" in ('PUBLISHED', 'REPORTED', 'HIDDEN'))
);
--> statement-breakpoint
ALTER TABLE "professional_reputation" ADD CONSTRAINT "professional_reputation_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderation_history" ADD CONSTRAINT "review_moderation_history_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_moderation_history" ADD CONSTRAINT "review_moderation_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_reported_by_account_id_account_profiles_id_fk" FOREIGN KEY ("reported_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_responses" ADD CONSTRAINT "review_responses_author_account_id_account_profiles_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_moderation_history_review_idx" ON "review_moderation_history" USING btree ("review_id","created_at","id");--> statement-breakpoint
CREATE INDEX "review_reports_status_idx" ON "review_reports" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "reviews_org_status_idx" ON "reviews" USING btree ("organisation_id","status","submitted_at","id");--> statement-breakpoint
CREATE INDEX "reviews_client_idx" ON "reviews" USING btree ("client_account_id","submitted_at","id");