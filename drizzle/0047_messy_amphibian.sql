CREATE TABLE "public_enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"inquiry_type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"message" text NOT NULL,
	"account_id" uuid,
	"status" text DEFAULT 'NEW' NOT NULL,
	"resolution" text,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_enquiries_reference_unique" UNIQUE("reference"),
	CONSTRAINT "public_enquiries_type_check" CHECK ("public_enquiries"."inquiry_type" in ('BOOKING', 'PAYMENTS', 'WARRANTY', 'PROFESSIONAL', 'GENERAL')),
	CONSTRAINT "public_enquiries_status_check" CHECK ("public_enquiries"."status" in ('NEW', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
	CONSTRAINT "public_enquiries_name_check" CHECK (char_length(trim("public_enquiries"."name")) between 2 and 80),
	CONSTRAINT "public_enquiries_message_check" CHECK (char_length(trim("public_enquiries"."message")) between 10 and 2000),
	CONSTRAINT "public_enquiries_resolution_check" CHECK (("public_enquiries"."status" not in ('RESOLVED', 'DISMISSED')) or ("public_enquiries"."resolution" is not null and "public_enquiries"."resolved_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "public_enquiries" ADD CONSTRAINT "public_enquiries_account_id_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "public_enquiries_queue_idx" ON "public_enquiries" USING btree ("status","opened_at","id");--> statement-breakpoint
CREATE INDEX "public_enquiries_email_idx" ON "public_enquiries" USING btree ("email","opened_at");