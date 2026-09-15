CREATE TABLE "warranties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"service_name_snapshot" text NOT NULL,
	"terms_snapshot" text NOT NULL,
	"exclusions_snapshot" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranties_job_unique" UNIQUE("job_id"),
	CONSTRAINT "warranties_status_check" CHECK ("warranties"."status" in ('ACTIVE', 'EXPIRED', 'VOID')),
	CONSTRAINT "warranties_window_check" CHECK ("warranties"."ends_at" > "warranties"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "warranty_claim_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"evidence_type" text DEFAULT 'SUBMISSION' NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranty_claim_evidence_asset_unique" UNIQUE("asset_id"),
	CONSTRAINT "warranty_claim_evidence_type_check" CHECK ("warranty_claim_evidence"."evidence_type" in ('SUBMISSION', 'REVIEW', 'RESOLUTION'))
);
--> statement-breakpoint
CREATE TABLE "warranty_claim_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warranty_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"warranty_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"submitted_by_account_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"preferred_resolution" text,
	"decision_reason" text,
	"reviewed_by_account_id" uuid,
	"return_visit_starts_at" timestamp with time zone,
	"return_visit_ends_at" timestamp with time zone,
	"resolution_notes" text,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"escalated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warranty_claims_sequence_unique" UNIQUE("warranty_id","sequence"),
	CONSTRAINT "warranty_claims_sequence_check" CHECK ("warranty_claims"."sequence" > 0),
	CONSTRAINT "warranty_claims_status_check" CHECK ("warranty_claims"."status" in ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'RETURN_VISIT_SCHEDULED', 'RESOLVED', 'REJECTED', 'ESCALATED')),
	CONSTRAINT "warranty_claims_lock_check" CHECK ("warranty_claims"."lock_version" > 0),
	CONSTRAINT "warranty_claims_schedule_check" CHECK (("warranty_claims"."return_visit_starts_at" is null and "warranty_claims"."return_visit_ends_at" is null)
        or ("warranty_claims"."return_visit_starts_at" is not null and "warranty_claims"."return_visit_ends_at" is not null and "warranty_claims"."return_visit_ends_at" > "warranty_claims"."return_visit_starts_at")),
	CONSTRAINT "warranty_claims_rejection_check" CHECK ("warranty_claims"."status" <> 'REJECTED' or ("warranty_claims"."decision_reason" is not null and "warranty_claims"."rejected_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claim_evidence" ADD CONSTRAINT "warranty_claim_evidence_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claim_evidence" ADD CONSTRAINT "warranty_claim_evidence_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claim_evidence" ADD CONSTRAINT "warranty_claim_evidence_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claim_history" ADD CONSTRAINT "warranty_claim_history_claim_id_warranty_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."warranty_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claim_history" ADD CONSTRAINT "warranty_claim_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_warranty_id_warranties_id_fk" FOREIGN KEY ("warranty_id") REFERENCES "public"."warranties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_submitted_by_account_id_account_profiles_id_fk" FOREIGN KEY ("submitted_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warranty_claims" ADD CONSTRAINT "warranty_claims_reviewed_by_account_id_account_profiles_id_fk" FOREIGN KEY ("reviewed_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "warranties_org_status_idx" ON "warranties" USING btree ("organisation_id","status","ends_at","id");--> statement-breakpoint
CREATE INDEX "warranties_client_status_idx" ON "warranties" USING btree ("client_account_id","status","ends_at","id");--> statement-breakpoint
CREATE INDEX "warranty_claim_evidence_claim_idx" ON "warranty_claim_evidence" USING btree ("claim_id","created_at","id");--> statement-breakpoint
CREATE INDEX "warranty_claim_history_claim_idx" ON "warranty_claim_history" USING btree ("claim_id","created_at","id");--> statement-breakpoint
CREATE INDEX "warranty_claims_warranty_idx" ON "warranty_claims" USING btree ("warranty_id","status","created_at","id");