CREATE TABLE "job_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"assigned_by_account_id" uuid NOT NULL,
	"unassigned_by_account_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"reason" text,
	CONSTRAINT "job_assignments_lifecycle_check" CHECK (("job_assignments"."active" = true and "job_assignments"."unassigned_at" is null and "job_assignments"."unassigned_by_account_id" is null)
        or ("job_assignments"."active" = false and "job_assignments"."unassigned_at" is not null and "job_assignments"."unassigned_by_account_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "job_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"label" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_by_account_id" uuid,
	"completed_at" timestamp with time zone,
	"result_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_checklist_position_unique" UNIQUE("job_id","position"),
	CONSTRAINT "job_checklist_position_check" CHECK ("job_checklist_items"."position" >= 0),
	CONSTRAINT "job_checklist_completion_check" CHECK (("job_checklist_items"."completed" = false and "job_checklist_items"."completed_at" is null and "job_checklist_items"."completed_by_account_id" is null)
        or ("job_checklist_items"."completed" = true and "job_checklist_items"."completed_at" is not null and "job_checklist_items"."completed_by_account_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "job_commercial_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"variation_id" uuid,
	"entry_type" text NOT NULL,
	"description_snapshot" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"total_after_minor" bigint NOT NULL,
	"approved_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_commercial_variation_unique" UNIQUE("variation_id"),
	CONSTRAINT "job_commercial_entry_type_check" CHECK ("job_commercial_history"."entry_type" in ('BOOKING_SNAPSHOT', 'APPROVED_VARIATION')),
	CONSTRAINT "job_commercial_amount_check" CHECK ("job_commercial_history"."amount_minor" >= 0 and "job_commercial_history"."total_after_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_completion_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"response_type" text NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_completion_attempt_unique" UNIQUE("job_id","attempt"),
	CONSTRAINT "job_completion_attempt_check" CHECK ("job_completion_responses"."attempt" > 0),
	CONSTRAINT "job_completion_response_check" CHECK ("job_completion_responses"."response_type" in ('CONFIRMED', 'CONFIRMED_WITH_COMMENTS', 'UNRESOLVED', 'CLARIFICATION_REQUESTED', 'AUTO_CONFIRMED'))
);
--> statement-breakpoint
CREATE TABLE "job_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"evidence_type" text NOT NULL,
	"visibility" text DEFAULT 'CLIENT' NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_evidence_asset_unique" UNIQUE("asset_id"),
	CONSTRAINT "job_evidence_type_check" CHECK ("job_evidence"."evidence_type" in ('BEFORE', 'PROGRESS', 'AFTER', 'VARIATION', 'COMPLETION')),
	CONSTRAINT "job_evidence_visibility_check" CHECK ("job_evidence"."visibility" in ('CLIENT', 'PROFESSIONAL'))
);
--> statement-breakpoint
CREATE TABLE "job_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"reason" text,
	"client_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"update_type" text NOT NULL,
	"visibility" text DEFAULT 'CLIENT' NOT NULL,
	"content" text NOT NULL,
	"quantity" integer,
	"amount_minor" bigint,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_updates_type_check" CHECK ("job_updates"."update_type" in ('PROGRESS', 'NOTE', 'MATERIAL', 'EXPENSE', 'CLARIFICATION')),
	CONSTRAINT "job_updates_visibility_check" CHECK ("job_updates"."visibility" in ('CLIENT', 'PROFESSIONAL')),
	CONSTRAINT "job_updates_content_check" CHECK (char_length(trim("job_updates"."content")) between 1 and 4000),
	CONSTRAINT "job_updates_quantity_check" CHECK ("job_updates"."quantity" is null or "job_updates"."quantity" > 0),
	CONSTRAINT "job_updates_amount_check" CHECK ("job_updates"."amount_minor" is null or "job_updates"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "job_variations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"description" text NOT NULL,
	"reason" text NOT NULL,
	"additional_amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"schedule_impact_minutes" integer DEFAULT 0 NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"responded_by_account_id" uuid,
	"responded_at" timestamp with time zone,
	"response_comment" text,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_variations_sequence_unique" UNIQUE("job_id","sequence"),
	CONSTRAINT "job_variations_sequence_check" CHECK ("job_variations"."sequence" > 0),
	CONSTRAINT "job_variations_status_check" CHECK ("job_variations"."status" in ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED')),
	CONSTRAINT "job_variations_amount_check" CHECK ("job_variations"."additional_amount_minor" >= 0),
	CONSTRAINT "job_variations_currency_check" CHECK (char_length("job_variations"."currency") = 3 and "job_variations"."currency" = upper("job_variations"."currency"))
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"service_name" text NOT NULL,
	"scope_snapshot" text NOT NULL,
	"exclusions_snapshot" text NOT NULL,
	"warranty_terms_snapshot" text NOT NULL,
	"payment_terms_snapshot" text NOT NULL,
	"currency" text NOT NULL,
	"base_total_minor" bigint NOT NULL,
	"approved_variation_total_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint NOT NULL,
	"scheduled_starts_at" timestamp with time zone,
	"scheduled_ends_at" timestamp with time zone,
	"timezone" text DEFAULT 'Africa/Nairobi' NOT NULL,
	"checked_in_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"awaiting_confirmation_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_booking_unique" UNIQUE("booking_id"),
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" in ('CREATED', 'SCHEDULED', 'TEAM_ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'ON_HOLD', 'AWAITING_CLIENT_CONFIRMATION', 'COMPLETED', 'RETURN_VISIT_REQUIRED', 'CANCELLED', 'DISPUTED')),
	CONSTRAINT "jobs_lock_version_check" CHECK ("jobs"."lock_version" > 0),
	CONSTRAINT "jobs_currency_check" CHECK (char_length("jobs"."currency") = 3 and "jobs"."currency" = upper("jobs"."currency")),
	CONSTRAINT "jobs_totals_check" CHECK ("jobs"."base_total_minor" >= 0
        and "jobs"."approved_variation_total_minor" >= 0
        and "jobs"."total_minor" = "jobs"."base_total_minor" + "jobs"."approved_variation_total_minor"),
	CONSTRAINT "jobs_schedule_check" CHECK (("jobs"."scheduled_starts_at" is null and "jobs"."scheduled_ends_at" is null)
        or ("jobs"."scheduled_starts_at" is not null and "jobs"."scheduled_ends_at" is not null and "jobs"."scheduled_ends_at" > "jobs"."scheduled_starts_at"))
);
--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_assigned_by_account_id_account_profiles_id_fk" FOREIGN KEY ("assigned_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignments" ADD CONSTRAINT "job_assignments_unassigned_by_account_id_account_profiles_id_fk" FOREIGN KEY ("unassigned_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checklist_items" ADD CONSTRAINT "job_checklist_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_checklist_items" ADD CONSTRAINT "job_checklist_items_completed_by_account_id_account_profiles_id_fk" FOREIGN KEY ("completed_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_commercial_history" ADD CONSTRAINT "job_commercial_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_commercial_history" ADD CONSTRAINT "job_commercial_history_variation_id_job_variations_id_fk" FOREIGN KEY ("variation_id") REFERENCES "public"."job_variations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_commercial_history" ADD CONSTRAINT "job_commercial_history_approved_by_account_id_account_profiles_id_fk" FOREIGN KEY ("approved_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_completion_responses" ADD CONSTRAINT "job_completion_responses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_completion_responses" ADD CONSTRAINT "job_completion_responses_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_evidence" ADD CONSTRAINT "job_evidence_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_history" ADD CONSTRAINT "job_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_history" ADD CONSTRAINT "job_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_updates" ADD CONSTRAINT "job_updates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_updates" ADD CONSTRAINT "job_updates_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_variations" ADD CONSTRAINT "job_variations_responded_by_account_id_account_profiles_id_fk" FOREIGN KEY ("responded_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "job_assignments_active_member_unique" ON "job_assignments" USING btree ("job_id","membership_id") WHERE "job_assignments"."active" = true;--> statement-breakpoint
CREATE INDEX "job_assignments_job_idx" ON "job_assignments" USING btree ("job_id","active","assigned_at");--> statement-breakpoint
CREATE INDEX "job_assignments_member_idx" ON "job_assignments" USING btree ("membership_id","active","assigned_at");--> statement-breakpoint
CREATE INDEX "job_checklist_job_idx" ON "job_checklist_items" USING btree ("job_id","position");--> statement-breakpoint
CREATE INDEX "job_commercial_job_idx" ON "job_commercial_history" USING btree ("job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_completion_job_idx" ON "job_completion_responses" USING btree ("job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_evidence_job_idx" ON "job_evidence" USING btree ("job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_history_job_idx" ON "job_history" USING btree ("job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_history_actor_idx" ON "job_history" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "job_updates_job_idx" ON "job_updates" USING btree ("job_id","created_at","id");--> statement-breakpoint
CREATE INDEX "job_variations_job_idx" ON "job_variations" USING btree ("job_id","status","sequence");--> statement-breakpoint
CREATE INDEX "job_variations_expiry_idx" ON "job_variations" USING btree ("status","expires_at","id");--> statement-breakpoint
CREATE INDEX "jobs_org_status_idx" ON "jobs" USING btree ("organisation_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "jobs_client_status_idx" ON "jobs" USING btree ("client_account_id","status","updated_at","id");
--> statement-breakpoint
INSERT INTO "jobs" (
	"booking_id",
	"organisation_id",
	"client_account_id",
	"created_by_account_id",
	"status",
	"service_name",
	"scope_snapshot",
	"exclusions_snapshot",
	"warranty_terms_snapshot",
	"payment_terms_snapshot",
	"currency",
	"base_total_minor",
	"total_minor",
	"scheduled_starts_at",
	"scheduled_ends_at",
	"timezone"
)
SELECT
	b."id",
	b."organisation_id",
	b."client_account_id",
	b."created_by_account_id",
	CASE
		WHEN b."assigned_membership_id" IS NOT NULL THEN 'TEAM_ASSIGNED'
		WHEN b."starts_at" IS NOT NULL THEN 'SCHEDULED'
		ELSE 'CREATED'
	END,
	coalesce(ps."name", sr."category", 'Service job'),
	b."scope",
	b."exclusions",
	b."warranty_terms",
	b."payment_terms",
	b."currency",
	b."total_minor",
	b."total_minor",
	b."starts_at",
	b."ends_at",
	b."timezone"
FROM "bookings" b
LEFT JOIN "professional_services" ps ON ps."id" = b."professional_service_id"
LEFT JOIN "service_requests" sr ON sr."id" = b."request_id"
WHERE b."status" IN ('CONFIRMED', 'RESCHEDULED')
ON CONFLICT ("booking_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_assignments" (
	"job_id",
	"organisation_id",
	"membership_id",
	"assigned_by_account_id",
	"reason"
)
SELECT
	j."id",
	j."organisation_id",
	b."assigned_membership_id",
	b."created_by_account_id",
	'Copied from the confirmed booking assignment.'
FROM "jobs" j
JOIN "bookings" b ON b."id" = j."booking_id"
WHERE b."assigned_membership_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_checklist_items" ("job_id", "label", "required", "position")
SELECT
	j."id",
	item."label",
	true,
	item."position"
FROM "jobs" j
CROSS JOIN LATERAL (
	VALUES
		('Confirm ' || lower(j."service_name") || ' requirements with the client', 0),
		('Complete the agreed service scope', 1),
		('Review the work area, results, and safety', 2)
) AS item("label", "position")
ON CONFLICT ("job_id", "position") DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_commercial_history" (
	"job_id",
	"entry_type",
	"description_snapshot",
	"amount_minor",
	"currency",
	"total_after_minor"
)
SELECT
	j."id",
	'BOOKING_SNAPSHOT',
	j."scope_snapshot",
	j."base_total_minor",
	j."currency",
	j."total_minor"
FROM "jobs" j
WHERE NOT EXISTS (
	SELECT 1
	FROM "job_commercial_history" h
	WHERE h."job_id" = j."id" AND h."entry_type" = 'BOOKING_SNAPSHOT'
);
--> statement-breakpoint
INSERT INTO "engagement_conversations" ("context_type", "context_id")
SELECT 'JOB', j."id"::text
FROM "jobs" j
ON CONFLICT ("context_type", "context_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "job_history" (
	"job_id",
	"actor_account_id",
	"action",
	"from_status",
	"to_status",
	"reason"
)
SELECT
	j."id",
	j."created_by_account_id",
	'CREATED',
	NULL,
	j."status",
	'Backfilled from a confirmed booking during Phase 03 migration.'
FROM "jobs" j
WHERE NOT EXISTS (
	SELECT 1
	FROM "job_history" h
	WHERE h."job_id" = j."id" AND h."action" = 'CREATED'
);
