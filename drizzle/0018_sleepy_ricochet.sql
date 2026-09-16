ALTER TABLE "bookings" DROP CONSTRAINT "bookings_origin_fields_check";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "requested_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_requested_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("requested_membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_requested_membership_idx" ON "bookings" USING btree ("requested_membership_id");--> statement-breakpoint
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
        or ("bookings"."origin" = 'PROFESSIONAL_CUSTOMER' and "bookings"."professional_service_id" is not null));