CREATE TABLE "service_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"recipient_account_id" uuid,
	"created_by_account_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"cancelled_by_account_id" uuid,
	"cancelled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_reminders_reason_check" CHECK (char_length(trim("service_reminders"."reason")) between 3 and 500),
	CONSTRAINT "service_reminders_status_check" CHECK ("service_reminders"."status" in ('SCHEDULED', 'CANCELLED', 'SENT')),
	CONSTRAINT "service_reminders_lifecycle_check" CHECK (("service_reminders"."status" = 'SCHEDULED' and "service_reminders"."cancelled_at" is null and "service_reminders"."sent_at" is null) or ("service_reminders"."status" = 'CANCELLED' and "service_reminders"."cancelled_at" is not null and "service_reminders"."cancelled_by_account_id" is not null and "service_reminders"."sent_at" is null) or ("service_reminders"."status" = 'SENT' and "service_reminders"."sent_at" is not null and "service_reminders"."cancelled_at" is null))
);
--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_customer_id_customer_records_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_recipient_account_id_account_profiles_id_fk" FOREIGN KEY ("recipient_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_reminders" ADD CONSTRAINT "service_reminders_cancelled_by_account_id_account_profiles_id_fk" FOREIGN KEY ("cancelled_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_reminders_due_idx" ON "service_reminders" USING btree ("status","due_at","id");--> statement-breakpoint
CREATE INDEX "service_reminders_customer_idx" ON "service_reminders" USING btree ("customer_id","due_at","id");