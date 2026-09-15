CREATE TABLE "service_request_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_request_attachments_asset_unique" UNIQUE("asset_id")
);
--> statement-breakpoint
CREATE TABLE "service_request_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"client_visible_note" text,
	"private_professional_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_account_id" uuid NOT NULL,
	"organisation_id" uuid,
	"preferred_service_id" uuid,
	"idempotency_key" uuid NOT NULL,
	"source" text NOT NULL,
	"category" text,
	"description" text,
	"location" text,
	"preferred_time" text,
	"budget_min_minor" bigint,
	"budget_max_minor" bigint,
	"currency" text DEFAULT 'KES' NOT NULL,
	"urgency" text,
	"contact_preference" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_client_idempotency_unique" UNIQUE("client_account_id","idempotency_key"),
	CONSTRAINT "service_requests_source_check" CHECK ("service_requests"."source" in ('MARKETPLACE_DISCOVERY', 'PROFESSIONAL_BOOKING_LINK', 'PROFESSIONAL_IMPORTED', 'REPEAT_CLIENT', 'DIRECT_SERVICE_PAGE')),
	CONSTRAINT "service_requests_status_check" CHECK ("service_requests"."status" in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ASSESSMENT_REQUIRED', 'QUOTED', 'CONVERTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
	CONSTRAINT "service_requests_urgency_check" CHECK ("service_requests"."urgency" is null or "service_requests"."urgency" in ('FLEXIBLE', 'SOON', 'URGENT')),
	CONSTRAINT "service_requests_contact_preference_check" CHECK ("service_requests"."contact_preference" is null or "service_requests"."contact_preference" in ('IN_APP', 'PHONE', 'EMAIL')),
	CONSTRAINT "service_requests_budget_min_check" CHECK ("service_requests"."budget_min_minor" is null or "service_requests"."budget_min_minor" >= 0),
	CONSTRAINT "service_requests_budget_max_check" CHECK ("service_requests"."budget_max_minor" is null or "service_requests"."budget_max_minor" >= 0),
	CONSTRAINT "service_requests_budget_order_check" CHECK ("service_requests"."budget_min_minor" is null or "service_requests"."budget_max_minor" is null or "service_requests"."budget_min_minor" <= "service_requests"."budget_max_minor"),
	CONSTRAINT "service_requests_version_check" CHECK ("service_requests"."version" > 0)
);
--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_asset_id_file_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."file_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_history" ADD CONSTRAINT "service_request_history_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_history" ADD CONSTRAINT "service_request_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_preferred_service_id_professional_services_id_fk" FOREIGN KEY ("preferred_service_id") REFERENCES "public"."professional_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_attachments_request_idx" ON "service_request_attachments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "service_request_history_request_idx" ON "service_request_history" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "service_requests_client_status_idx" ON "service_requests" USING btree ("client_account_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "service_requests_org_status_idx" ON "service_requests" USING btree ("organisation_id","status","updated_at");
