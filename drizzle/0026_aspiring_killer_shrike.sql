CREATE TABLE "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"author_account_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_notes_body_check" CHECK (char_length(trim("customer_notes"."body")) between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "customer_record_tags" (
	"customer_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"added_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_record_tags_unique" UNIQUE("customer_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "customer_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"account_profile_id" uuid,
	"duplicate_of_customer_id" uuid,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"acquisition_source" text NOT NULL,
	"status" text DEFAULT 'IMPORTED' NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"invited_at" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_records_source_check" CHECK ("customer_records"."acquisition_source" in ('MARKETPLACE_ACQUIRED', 'PROFESSIONAL_INVITED', 'PROFESSIONAL_IMPORTED', 'CLIENT_REFERRAL', 'REPEAT_CLIENT')),
	CONSTRAINT "customer_records_status_check" CHECK ("customer_records"."status" in ('IMPORTED', 'INVITATION_PENDING', 'REGISTERED', 'DUPLICATE_CANDIDATE', 'ARCHIVED')),
	CONSTRAINT "customer_records_contact_check" CHECK ("customer_records"."email" is not null or "customer_records"."phone" is not null or "customer_records"."account_profile_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "customer_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_tags_org_name_unique" UNIQUE("organisation_id","name"),
	CONSTRAINT "customer_tags_name_check" CHECK (char_length(trim("customer_tags"."name")) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customer_records_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_account_id_account_profiles_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_record_tags" ADD CONSTRAINT "customer_record_tags_customer_id_customer_records_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_record_tags" ADD CONSTRAINT "customer_record_tags_tag_id_customer_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."customer_tags"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_record_tags" ADD CONSTRAINT "customer_record_tags_added_by_account_id_account_profiles_id_fk" FOREIGN KEY ("added_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_records" ADD CONSTRAINT "customer_records_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_records" ADD CONSTRAINT "customer_records_account_profile_id_account_profiles_id_fk" FOREIGN KEY ("account_profile_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_records" ADD CONSTRAINT "customer_records_duplicate_of_customer_id_customer_records_id_fk" FOREIGN KEY ("duplicate_of_customer_id") REFERENCES "public"."customer_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_records" ADD CONSTRAINT "customer_records_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id","created_at","id");--> statement-breakpoint
CREATE INDEX "customer_notes_org_idx" ON "customer_notes" USING btree ("organisation_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_records_org_account_unique" ON "customer_records" USING btree ("organisation_id","account_profile_id") WHERE "customer_records"."account_profile_id" is not null;--> statement-breakpoint
CREATE INDEX "customer_records_org_status_idx" ON "customer_records" USING btree ("organisation_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "customer_records_org_email_idx" ON "customer_records" USING btree ("organisation_id","email");--> statement-breakpoint
CREATE INDEX "customer_records_org_phone_idx" ON "customer_records" USING btree ("organisation_id","phone");