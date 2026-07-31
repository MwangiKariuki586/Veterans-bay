CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"opened_by_account_id" uuid NOT NULL,
	"assigned_to_account_id" uuid,
	"reason" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"resolution" text,
	"decision_reason" text,
	"evidence_summary" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_status_check" CHECK ("disputes"."status" in ('OPEN', 'INVESTIGATING', 'AWAITING_DECISION', 'RESOLVED', 'DISMISSED')),
	CONSTRAINT "disputes_resolution_check" CHECK (("disputes"."status" not in ('RESOLVED', 'DISMISSED')) or ("disputes"."resolution" is not null and "disputes"."decision_reason" is not null and "disputes"."evidence_summary" is not null and "disputes"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_case_evidence" (
	"case_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_case_evidence_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "moderation_case_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid,
	"organisation_id" uuid,
	"subject_account_id" uuid,
	"case_type" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"opened_by_account_id" uuid NOT NULL,
	"assigned_to_account_id" uuid,
	"resolution" text,
	"decision_reason" text,
	"evidence_summary" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_cases_report_id_unique" UNIQUE("report_id"),
	CONSTRAINT "moderation_cases_status_check" CHECK ("moderation_cases"."status" in ('OPEN', 'INVESTIGATING', 'AWAITING_DECISION', 'RESOLVED', 'DISMISSED')),
	CONSTRAINT "moderation_cases_priority_check" CHECK ("moderation_cases"."priority" in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
	CONSTRAINT "moderation_cases_resolution_check" CHECK (("moderation_cases"."status" not in ('RESOLVED', 'DISMISSED')) or ("moderation_cases"."resolution" is not null and "moderation_cases"."decision_reason" is not null and "moderation_cases"."evidence_summary" is not null and "moderation_cases"."resolved_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submitted_by_account_id" uuid NOT NULL,
	"organisation_id" uuid,
	"category" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"summary" text NOT NULL,
	"details" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_reports_category_check" CHECK ("moderation_reports"."category" in ('MISLEADING_LISTING', 'ABUSIVE_COMMUNICATION', 'FRAUD_CONCERN', 'POOR_SERVICE_CONDUCT', 'PAYMENT_DISAGREEMENT', 'REVIEW_MANIPULATION', 'OFF_PLATFORM_PAYMENT_REQUEST', 'IDENTITY_CONCERN')),
	CONSTRAINT "moderation_reports_status_check" CHECK ("moderation_reports"."status" in ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
	CONSTRAINT "moderation_reports_summary_check" CHECK (char_length(trim("moderation_reports"."summary")) between 3 and 200),
	CONSTRAINT "moderation_reports_details_check" CHECK (char_length(trim("moderation_reports"."details")) between 10 and 4000)
);
--> statement-breakpoint
CREATE TABLE "platform_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"value" jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"reason" text NOT NULL,
	"updated_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_rules_key_unique" UNIQUE("key"),
	CONSTRAINT "platform_rules_status_check" CHECK ("platform_rules"."status" in ('ACTIVE', 'INACTIVE'))
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_account_id_account_profiles_id_fk" FOREIGN KEY ("opened_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_assigned_to_account_id_account_profiles_id_fk" FOREIGN KEY ("assigned_to_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_evidence" ADD CONSTRAINT "moderation_case_evidence_case_id_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_evidence" ADD CONSTRAINT "moderation_case_evidence_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_evidence" ADD CONSTRAINT "moderation_case_evidence_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_history" ADD CONSTRAINT "moderation_case_history_case_id_moderation_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."moderation_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_case_history" ADD CONSTRAINT "moderation_case_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_report_id_moderation_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."moderation_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_subject_account_id_account_profiles_id_fk" FOREIGN KEY ("subject_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_opened_by_account_id_account_profiles_id_fk" FOREIGN KEY ("opened_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assigned_to_account_id_account_profiles_id_fk" FOREIGN KEY ("assigned_to_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_submitted_by_account_id_account_profiles_id_fk" FOREIGN KEY ("submitted_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_reports" ADD CONSTRAINT "moderation_reports_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_rules" ADD CONSTRAINT "platform_rules_updated_by_account_id_account_profiles_id_fk" FOREIGN KEY ("updated_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disputes_queue_idx" ON "disputes" USING btree ("status","opened_at","id");--> statement-breakpoint
CREATE INDEX "disputes_job_idx" ON "disputes" USING btree ("job_id","opened_at");--> statement-breakpoint
CREATE INDEX "moderation_case_evidence_case_idx" ON "moderation_case_evidence" USING btree ("case_id","created_at","asset_id");--> statement-breakpoint
CREATE INDEX "moderation_case_history_case_idx" ON "moderation_case_history" USING btree ("case_id","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_cases_queue_idx" ON "moderation_cases" USING btree ("status","priority","opened_at","id");--> statement-breakpoint
CREATE INDEX "moderation_cases_subject_idx" ON "moderation_cases" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "moderation_reports_queue_idx" ON "moderation_reports" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "moderation_reports_subject_idx" ON "moderation_reports" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "platform_rules_status_idx" ON "platform_rules" USING btree ("status","key");