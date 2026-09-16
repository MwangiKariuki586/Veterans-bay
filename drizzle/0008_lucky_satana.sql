CREATE TABLE "saved_professionals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_profile_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_professionals_account_org_unique" UNIQUE("account_profile_id","organisation_id")
);
--> statement-breakpoint
ALTER TABLE "saved_professionals" ADD CONSTRAINT "saved_professionals_account_profile_id_account_profiles_id_fk" FOREIGN KEY ("account_profile_id") REFERENCES "public"."account_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_professionals" ADD CONSTRAINT "saved_professionals_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_professionals_account_created_idx" ON "saved_professionals" USING btree ("account_profile_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_professionals_organisation_idx" ON "saved_professionals" USING btree ("organisation_id");