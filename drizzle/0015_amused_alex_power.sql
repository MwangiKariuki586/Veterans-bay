CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"quotation_id" uuid NOT NULL,
	"accepted_quotation_version_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"origin" text DEFAULT 'ACCEPTED_QUOTATION' NOT NULL,
	"status" text NOT NULL,
	"currency" text NOT NULL,
	"total_minor" bigint NOT NULL,
	"deposit_minor" bigint NOT NULL,
	"expected_duration_minutes" integer NOT NULL,
	"proposed_start_at" timestamp with time zone,
	"scope" text NOT NULL,
	"exclusions" text NOT NULL,
	"warranty_terms" text NOT NULL,
	"payment_terms" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_request_unique" UNIQUE("request_id"),
	CONSTRAINT "bookings_quotation_unique" UNIQUE("quotation_id"),
	CONSTRAINT "bookings_accepted_version_unique" UNIQUE("accepted_quotation_version_id"),
	CONSTRAINT "bookings_origin_check" CHECK ("bookings"."origin" in ('ACCEPTED_QUOTATION')),
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('PENDING_CONFIRMATION', 'PENDING_DEPOSIT')),
	CONSTRAINT "bookings_money_check" CHECK ("bookings"."total_minor" >= 0 and "bookings"."deposit_minor" >= 0 and "bookings"."deposit_minor" <= "bookings"."total_minor"),
	CONSTRAINT "bookings_duration_check" CHECK ("bookings"."expected_duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"quotation_version_id" uuid NOT NULL,
	"requirement_type" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_requirements_booking_type_unique" UNIQUE("booking_id","requirement_type"),
	CONSTRAINT "payment_requirements_type_check" CHECK ("payment_requirements"."requirement_type" in ('DEPOSIT', 'BALANCE')),
	CONSTRAINT "payment_requirements_status_check" CHECK ("payment_requirements"."status" in ('PENDING', 'SATISFIED', 'WAIVED', 'CANCELLED')),
	CONSTRAINT "payment_requirements_amount_check" CHECK ("payment_requirements"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quotation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"quotation_version_id" uuid,
	"actor_account_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotation_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_version_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_line_items_position_unique" UNIQUE("quotation_version_id","position"),
	CONSTRAINT "quotation_line_items_category_check" CHECK ("quotation_line_items"."category" in ('LABOUR', 'MATERIAL', 'TRANSPORT', 'ADDITIONAL')),
	CONSTRAINT "quotation_line_items_quantity_check" CHECK ("quotation_line_items"."quantity" > 0),
	CONSTRAINT "quotation_line_items_money_check" CHECK ("quotation_line_items"."unit_price_minor" >= 0 and "quotation_line_items"."total_minor" = "quotation_line_items"."quantity" * "quotation_line_items"."unit_price_minor")
);
--> statement-breakpoint
CREATE TABLE "quotation_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quotation_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"currency" text DEFAULT 'KES' NOT NULL,
	"labour_minor" bigint DEFAULT 0 NOT NULL,
	"materials_minor" bigint DEFAULT 0 NOT NULL,
	"transport_minor" bigint DEFAULT 0 NOT NULL,
	"additional_charges_minor" bigint DEFAULT 0 NOT NULL,
	"subtotal_minor" bigint DEFAULT 0 NOT NULL,
	"discount_minor" bigint DEFAULT 0 NOT NULL,
	"tax_minor" bigint DEFAULT 0 NOT NULL,
	"total_minor" bigint DEFAULT 0 NOT NULL,
	"deposit_minor" bigint DEFAULT 0 NOT NULL,
	"expected_duration_minutes" integer NOT NULL,
	"proposed_start_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"scope" text NOT NULL,
	"exclusions" text NOT NULL,
	"warranty_terms" text NOT NULL,
	"payment_terms" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"viewed_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotation_versions_number_unique" UNIQUE("quotation_id","version_number"),
	CONSTRAINT "quotation_versions_number_check" CHECK ("quotation_versions"."version_number" > 0),
	CONSTRAINT "quotation_versions_status_check" CHECK ("quotation_versions"."status" in ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'REPLACED', 'EXPIRED', 'CANCELLED')),
	CONSTRAINT "quotation_versions_currency_check" CHECK (char_length("quotation_versions"."currency") = 3 and "quotation_versions"."currency" = upper("quotation_versions"."currency")),
	CONSTRAINT "quotation_versions_money_check" CHECK ("quotation_versions"."labour_minor" >= 0
        and "quotation_versions"."materials_minor" >= 0
        and "quotation_versions"."transport_minor" >= 0
        and "quotation_versions"."additional_charges_minor" >= 0
        and "quotation_versions"."subtotal_minor" >= 0
        and "quotation_versions"."discount_minor" >= 0
        and "quotation_versions"."tax_minor" >= 0
        and "quotation_versions"."total_minor" >= 0
        and "quotation_versions"."deposit_minor" >= 0
        and "quotation_versions"."discount_minor" <= "quotation_versions"."subtotal_minor"
        and "quotation_versions"."deposit_minor" <= "quotation_versions"."total_minor"),
	CONSTRAINT "quotation_versions_total_check" CHECK ("quotation_versions"."subtotal_minor" = "quotation_versions"."labour_minor" + "quotation_versions"."materials_minor" + "quotation_versions"."transport_minor" + "quotation_versions"."additional_charges_minor"
        and "quotation_versions"."total_minor" = "quotation_versions"."subtotal_minor" - "quotation_versions"."discount_minor" + "quotation_versions"."tax_minor"),
	CONSTRAINT "quotation_versions_duration_check" CHECK ("quotation_versions"."expected_duration_minutes" > 0),
	CONSTRAINT "quotation_versions_submission_check" CHECK ("quotation_versions"."status" = 'DRAFT' or "quotation_versions"."submitted_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"client_account_id" uuid NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"accepted_by_account_id" uuid,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"current_version_number" integer DEFAULT 1 NOT NULL,
	"accepted_version_number" integer,
	"lock_version" integer DEFAULT 1 NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotations_request_unique" UNIQUE("request_id"),
	CONSTRAINT "quotations_status_check" CHECK ("quotations"."status" in ('DRAFT', 'SUBMITTED', 'VIEWED', 'ACCEPTED', 'DECLINED', 'REVISION_REQUESTED', 'REPLACED', 'EXPIRED', 'CANCELLED')),
	CONSTRAINT "quotations_current_version_check" CHECK ("quotations"."current_version_number" > 0),
	CONSTRAINT "quotations_accepted_version_check" CHECK ("quotations"."accepted_version_number" is null or "quotations"."accepted_version_number" > 0),
	CONSTRAINT "quotations_lock_version_check" CHECK ("quotations"."lock_version" > 0),
	CONSTRAINT "quotations_acceptance_fields_check" CHECK (("quotations"."status" = 'ACCEPTED' and "quotations"."accepted_version_number" is not null and "quotations"."accepted_by_account_id" is not null and "quotations"."accepted_at" is not null)
        or ("quotations"."status" <> 'ACCEPTED' and "quotations"."accepted_version_number" is null and "quotations"."accepted_by_account_id" is null and "quotations"."accepted_at" is null))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_accepted_quotation_version_id_quotation_versions_id_fk" FOREIGN KEY ("accepted_quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requirements" ADD CONSTRAINT "payment_requirements_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_requirements" ADD CONSTRAINT "payment_requirements_quotation_version_id_quotation_versions_id_fk" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_quotation_version_id_quotation_versions_id_fk" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_history" ADD CONSTRAINT "quotation_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotation_version_id_quotation_versions_id_fk" FOREIGN KEY ("quotation_version_id") REFERENCES "public"."quotation_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_quotation_id_quotations_id_fk" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotation_versions" ADD CONSTRAINT "quotation_versions_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_client_account_id_account_profiles_id_fk" FOREIGN KEY ("client_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_accepted_by_account_id_account_profiles_id_fk" FOREIGN KEY ("accepted_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_org_status_idx" ON "bookings" USING btree ("organisation_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "bookings_client_status_idx" ON "bookings" USING btree ("client_account_id","status","created_at","id");--> statement-breakpoint
CREATE INDEX "payment_requirements_booking_idx" ON "payment_requirements" USING btree ("booking_id","status");--> statement-breakpoint
CREATE INDEX "payment_requirements_version_idx" ON "payment_requirements" USING btree ("quotation_version_id");--> statement-breakpoint
CREATE INDEX "quotation_history_quotation_idx" ON "quotation_history" USING btree ("quotation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "quotation_history_version_idx" ON "quotation_history" USING btree ("quotation_version_id");--> statement-breakpoint
CREATE INDEX "quotation_history_actor_idx" ON "quotation_history" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "quotation_line_items_version_idx" ON "quotation_line_items" USING btree ("quotation_version_id","position");--> statement-breakpoint
CREATE INDEX "quotation_versions_quotation_idx" ON "quotation_versions" USING btree ("quotation_id","version_number");--> statement-breakpoint
CREATE INDEX "quotation_versions_created_by_idx" ON "quotation_versions" USING btree ("created_by_account_id");--> statement-breakpoint
CREATE INDEX "quotation_versions_expiry_idx" ON "quotation_versions" USING btree ("status","valid_until","id");--> statement-breakpoint
CREATE INDEX "quotations_org_status_idx" ON "quotations" USING btree ("organisation_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "quotations_client_status_idx" ON "quotations" USING btree ("client_account_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "quotations_created_by_idx" ON "quotations" USING btree ("created_by_account_id");--> statement-breakpoint
CREATE INDEX "quotations_accepted_by_idx" ON "quotations" USING btree ("accepted_by_account_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_submitted_quotation_version_terms_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD.submitted_at IS NOT NULL AND (
		NEW.quotation_id,
		NEW.version_number,
		NEW.currency,
		NEW.labour_minor,
		NEW.materials_minor,
		NEW.transport_minor,
		NEW.additional_charges_minor,
		NEW.subtotal_minor,
		NEW.discount_minor,
		NEW.tax_minor,
		NEW.total_minor,
		NEW.deposit_minor,
		NEW.expected_duration_minutes,
		NEW.proposed_start_at,
		NEW.valid_until,
		NEW.scope,
		NEW.exclusions,
		NEW.warranty_terms,
		NEW.payment_terms,
		NEW.created_by_account_id,
		NEW.created_at
	) IS DISTINCT FROM (
		OLD.quotation_id,
		OLD.version_number,
		OLD.currency,
		OLD.labour_minor,
		OLD.materials_minor,
		OLD.transport_minor,
		OLD.additional_charges_minor,
		OLD.subtotal_minor,
		OLD.discount_minor,
		OLD.tax_minor,
		OLD.total_minor,
		OLD.deposit_minor,
		OLD.expected_duration_minutes,
		OLD.proposed_start_at,
		OLD.valid_until,
		OLD.scope,
		OLD.exclusions,
		OLD.warranty_terms,
		OLD.payment_terms,
		OLD.created_by_account_id,
		OLD.created_at
	) THEN
		RAISE EXCEPTION 'submitted quotation terms are immutable'
			USING ERRCODE = '23514';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotation_versions_terms_immutable
BEFORE UPDATE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_submitted_quotation_version_terms_change();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_submitted_quotation_version_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD.submitted_at IS NOT NULL THEN
		RAISE EXCEPTION 'submitted quotation versions cannot be deleted'
			USING ERRCODE = '23514';
	END IF;
	RETURN OLD;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotation_versions_delete_immutable
BEFORE DELETE ON quotation_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_submitted_quotation_version_delete();--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_draft_quotation_line_items()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_version_id uuid;
BEGIN
	target_version_id := CASE
		WHEN TG_OP = 'DELETE' THEN OLD.quotation_version_id
		ELSE NEW.quotation_version_id
	END;
	IF EXISTS (
		SELECT 1
		FROM quotation_versions
		WHERE id = target_version_id
			AND submitted_at IS NOT NULL
	) THEN
		RAISE EXCEPTION 'submitted quotation line items are immutable'
			USING ERRCODE = '23514';
	END IF;
	IF TG_OP = 'DELETE' THEN
		RETURN OLD;
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER quotation_line_items_draft_only
BEFORE INSERT OR UPDATE OR DELETE ON quotation_line_items
FOR EACH ROW
EXECUTE FUNCTION enforce_draft_quotation_line_items();
