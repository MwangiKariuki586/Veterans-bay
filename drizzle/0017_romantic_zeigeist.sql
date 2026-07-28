CREATE EXTENSION IF NOT EXISTS "btree_gist";--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_blocks_window_check" CHECK ("availability_blocks"."ends_at" > "availability_blocks"."starts_at"),
	CONSTRAINT "availability_blocks_reason_check" CHECK (char_length(trim("availability_blocks"."reason")) between 3 and 240)
);
--> statement-breakpoint
CREATE TABLE "availability_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"timezone" text DEFAULT 'Africa/Nairobi' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_rules_member_window_unique" UNIQUE("membership_id","weekday","start_minute","end_minute"),
	CONSTRAINT "availability_rules_weekday_check" CHECK ("availability_rules"."weekday" between 0 and 6),
	CONSTRAINT "availability_rules_minutes_check" CHECK ("availability_rules"."start_minute" between 0 and 1439
        and "availability_rules"."end_minute" between 1 and 1440
        and "availability_rules"."end_minute" > "availability_rules"."start_minute"),
	CONSTRAINT "availability_rules_timezone_check" CHECK (char_length("availability_rules"."timezone") between 1 and 64)
);
--> statement-breakpoint
CREATE TABLE "booking_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"previous_starts_at" timestamp with time zone,
	"previous_ends_at" timestamp with time zone,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"membership_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_history_schedule_pair_check" CHECK (("booking_history"."starts_at" is null and "booking_history"."ends_at" is null)
        or ("booking_history"."starts_at" is not null
          and "booking_history"."ends_at" is not null
          and "booking_history"."ends_at" > "booking_history"."starts_at"))
);
--> statement-breakpoint
CREATE TABLE "booking_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_reservations_booking_unique" UNIQUE("booking_id"),
	CONSTRAINT "booking_reservations_status_check" CHECK ("booking_reservations"."status" in ('ACTIVE', 'RELEASED')),
	CONSTRAINT "booking_reservations_window_check" CHECK ("booking_reservations"."ends_at" > "booking_reservations"."starts_at"),
	CONSTRAINT "booking_reservations_release_check" CHECK (("booking_reservations"."status" = 'ACTIVE' and "booking_reservations"."released_at" is null)
        or ("booking_reservations"."status" = 'RELEASED' and "booking_reservations"."released_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD CONSTRAINT "booking_reservations_member_overlap_excl"
EXCLUDE USING gist (
	"membership_id" WITH =,
	tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE ("status" = 'ACTIVE');--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_origin_check";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_status_check";--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "request_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "quotation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "accepted_quotation_version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "accepted_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "professional_service_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_booking_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "created_by_account_id" uuid;--> statement-breakpoint
UPDATE "bookings"
SET "created_by_account_id" = "client_account_id"
WHERE "created_by_account_id" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "created_by_account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "assigned_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requested_start_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requested_end_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "timezone" text DEFAULT 'Africa/Nairobi' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_policy" text DEFAULT 'Cancel or request a reschedule at least 24 hours before the scheduled start. Later changes may affect the deposit record.' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "lock_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_history" ADD CONSTRAINT "booking_history_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD CONSTRAINT "booking_reservations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD CONSTRAINT "booking_reservations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD CONSTRAINT "booking_reservations_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_blocks_org_window_idx" ON "availability_blocks" USING btree ("organisation_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "availability_blocks_member_window_idx" ON "availability_blocks" USING btree ("membership_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "availability_blocks_created_by_idx" ON "availability_blocks" USING btree ("created_by_account_id");--> statement-breakpoint
CREATE INDEX "availability_rules_org_day_idx" ON "availability_rules" USING btree ("organisation_id","weekday","active");--> statement-breakpoint
CREATE INDEX "availability_rules_member_day_idx" ON "availability_rules" USING btree ("membership_id","weekday","active");--> statement-breakpoint
CREATE INDEX "availability_rules_created_by_idx" ON "availability_rules" USING btree ("created_by_account_id");--> statement-breakpoint
CREATE INDEX "booking_history_booking_idx" ON "booking_history" USING btree ("booking_id","created_at","id");--> statement-breakpoint
CREATE INDEX "booking_history_actor_idx" ON "booking_history" USING btree ("actor_account_id");--> statement-breakpoint
CREATE INDEX "booking_history_membership_idx" ON "booking_history" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "booking_reservations_org_window_idx" ON "booking_reservations" USING btree ("organisation_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "booking_reservations_member_window_idx" ON "booking_reservations" USING btree ("membership_id","starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_professional_service_id_professional_services_id_fk" FOREIGN KEY ("professional_service_id") REFERENCES "public"."professional_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_booking_id_bookings_id_fk" FOREIGN KEY ("source_booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("assigned_membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_service_idx" ON "bookings" USING btree ("professional_service_id");--> statement-breakpoint
CREATE INDEX "bookings_source_booking_idx" ON "bookings" USING btree ("source_booking_id");--> statement-breakpoint
CREATE INDEX "bookings_created_by_idx" ON "bookings" USING btree ("created_by_account_id");--> statement-breakpoint
CREATE INDEX "bookings_assignment_schedule_idx" ON "bookings" USING btree ("assigned_membership_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "bookings_org_schedule_idx" ON "bookings" USING btree ("organisation_id","starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_fields_check" CHECK (("bookings"."origin" = 'ACCEPTED_QUOTATION'
          and "bookings"."request_id" is not null
          and "bookings"."quotation_id" is not null
          and "bookings"."accepted_quotation_version_id" is not null
          and "bookings"."accepted_at" is not null)
        or ("bookings"."origin" = 'DIRECT_SERVICE' and "bookings"."professional_service_id" is not null)
        or ("bookings"."origin" = 'APPROVED_ASSESSMENT'
          and "bookings"."request_id" is not null
          and "bookings"."professional_service_id" is not null)
        or ("bookings"."origin" = 'REPEAT_BOOKING' and "bookings"."source_booking_id" is not null)
        or ("bookings"."origin" = 'PROFESSIONAL_CUSTOMER' and "bookings"."professional_service_id" is not null));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requested_schedule_check" CHECK (("bookings"."requested_start_at" is null and "bookings"."requested_end_at" is null)
        or ("bookings"."requested_start_at" is not null
          and "bookings"."requested_end_at" is not null
          and "bookings"."requested_end_at" > "bookings"."requested_start_at"));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_schedule_check" CHECK (("bookings"."starts_at" is null and "bookings"."ends_at" is null)
        or ("bookings"."starts_at" is not null
          and "bookings"."ends_at" is not null
          and "bookings"."ends_at" > "bookings"."starts_at"));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_scheduled_status_check" CHECK ("bookings"."status" not in ('CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'NO_SHOW')
        or ("bookings"."starts_at" is not null
          and "bookings"."ends_at" is not null
          and "bookings"."assigned_membership_id" is not null
          and "bookings"."cancellation_acknowledged_at" is not null));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lock_version_check" CHECK ("bookings"."lock_version" > 0);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_origin_check" CHECK ("bookings"."origin" in ('ACCEPTED_QUOTATION', 'DIRECT_SERVICE', 'APPROVED_ASSESSMENT', 'REPEAT_BOOKING', 'PROFESSIONAL_CUSTOMER'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" in ('PENDING_CONFIRMATION', 'PENDING_DEPOSIT', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'));
