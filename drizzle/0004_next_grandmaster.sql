CREATE TABLE "organisation_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_jobs_only" boolean DEFAULT false NOT NULL,
	"financial_data_access" boolean DEFAULT false NOT NULL,
	"invited_by_account_id" uuid NOT NULL,
	"accepted_by_account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisation_invitations_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "organisation_invitations_status_check" CHECK ("organisation_invitations"."status" in ('pending', 'accepted', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "organisation_membership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor_account_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisation_membership_history_from_status_check" CHECK ("organisation_membership_history"."from_status" is null or "organisation_membership_history"."from_status" in ('active', 'suspended', 'removed')),
	CONSTRAINT "organisation_membership_history_to_status_check" CHECK ("organisation_membership_history"."to_status" in ('active', 'suspended', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "organisation_membership_role_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"organisation_id" uuid NOT NULL,
	"from_role_id" uuid,
	"to_role_id" uuid NOT NULL,
	"actor_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organisation_memberships" ADD COLUMN "assigned_jobs_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisation_memberships" ADD COLUMN "financial_data_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_invited_by_account_id_account_profiles_id_fk" FOREIGN KEY ("invited_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_invitations" ADD CONSTRAINT "organisation_invitations_accepted_by_account_id_account_profiles_id_fk" FOREIGN KEY ("accepted_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_history" ADD CONSTRAINT "organisation_membership_history_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_history" ADD CONSTRAINT "organisation_membership_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_history" ADD CONSTRAINT "organisation_membership_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_role_history" ADD CONSTRAINT "organisation_membership_role_history_membership_id_organisation_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."organisation_memberships"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_role_history" ADD CONSTRAINT "organisation_membership_role_history_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_role_history" ADD CONSTRAINT "organisation_membership_role_history_from_role_id_roles_id_fk" FOREIGN KEY ("from_role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_role_history" ADD CONSTRAINT "organisation_membership_role_history_to_role_id_roles_id_fk" FOREIGN KEY ("to_role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_membership_role_history" ADD CONSTRAINT "organisation_membership_role_history_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organisation_invitations_pending_email_unique" ON "organisation_invitations" USING btree ("organisation_id","email") WHERE "organisation_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "organisation_invitations_org_status_idx" ON "organisation_invitations" USING btree ("organisation_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "organisation_membership_history_member_idx" ON "organisation_membership_history" USING btree ("membership_id","created_at");--> statement-breakpoint
CREATE INDEX "organisation_membership_history_org_idx" ON "organisation_membership_history" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "organisation_membership_role_history_member_idx" ON "organisation_membership_role_history" USING btree ("membership_id","created_at");--> statement-breakpoint
CREATE INDEX "organisation_membership_role_history_org_idx" ON "organisation_membership_role_history" USING btree ("organisation_id","created_at");--> statement-breakpoint
UPDATE "roles" SET "key" = 'manager', "name" = 'Manager', "description" = 'Runs daily operations and manages the team without ownership control', "updated_at" = now()
WHERE "scope" = 'organisation' AND "key" = 'admin';--> statement-breakpoint
UPDATE "roles" SET "key" = 'receptionist', "name" = 'Receptionist', "description" = 'Handles enquiries, customers, and appointment coordination', "updated_at" = now()
WHERE "scope" = 'organisation' AND "key" = 'member';--> statement-breakpoint
INSERT INTO "roles" ("key", "scope", "name", "description") VALUES
	('dispatcher', 'organisation', 'Dispatcher', 'Coordinates requests, bookings, and assignments'),
	('accountant', 'organisation', 'Accountant', 'Manages payment records and financial reports')
ON CONFLICT ("scope", "key") DO UPDATE SET "name" = excluded."name", "description" = excluded."description", "updated_at" = now();--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES
	('services.view', 'View organisation services'),
	('services.manage', 'Manage organisation services'),
	('enquiries.view', 'View organisation enquiries'),
	('enquiries.manage', 'Manage organisation enquiries'),
	('quotations.view', 'View organisation quotations'),
	('quotations.manage', 'Manage organisation quotations'),
	('bookings.view', 'View organisation bookings'),
	('bookings.manage', 'Manage organisation bookings'),
	('assignments.manage', 'Assign organisation jobs'),
	('jobs.view', 'View organisation jobs within membership restrictions'),
	('jobs.manage', 'Update organisation jobs within membership restrictions'),
	('customers.view', 'View organisation customers within membership restrictions'),
	('customers.manage', 'Manage organisation customers'),
	('payments.view', 'View organisation payment records'),
	('payments.manage', 'Manage organisation payment records'),
	('reports.view', 'View non-financial organisation reports'),
	('reports.financial.view', 'View financial organisation reports')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";--> statement-breakpoint
DELETE FROM "role_permissions"
WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "scope" = 'organisation');--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.scope = 'organisation' AND (
	r.key = 'owner'
	OR (r.key = 'manager' AND p.key IN ('organisation.view', 'organisation.manage', 'organisation.members.manage', 'services.view', 'services.manage', 'enquiries.view', 'enquiries.manage', 'quotations.view', 'quotations.manage', 'bookings.view', 'bookings.manage', 'assignments.manage', 'jobs.view', 'jobs.manage', 'customers.view', 'customers.manage', 'reports.view'))
	OR (r.key = 'dispatcher' AND p.key IN ('organisation.view', 'enquiries.view', 'enquiries.manage', 'quotations.view', 'bookings.view', 'bookings.manage', 'assignments.manage', 'jobs.view', 'customers.view'))
	OR (r.key = 'technician' AND p.key IN ('organisation.view', 'jobs.view', 'jobs.manage', 'customers.view'))
	OR (r.key = 'receptionist' AND p.key IN ('organisation.view', 'enquiries.view', 'enquiries.manage', 'bookings.view', 'bookings.manage', 'customers.view', 'customers.manage'))
	OR (r.key = 'accountant' AND p.key IN ('organisation.view', 'quotations.view', 'customers.view', 'payments.view', 'payments.manage', 'reports.view', 'reports.financial.view'))
);--> statement-breakpoint
UPDATE "organisation_memberships" m
SET "assigned_jobs_only" = (r."key" = 'technician'),
	"financial_data_access" = (r."key" IN ('owner', 'accountant'))
FROM "roles" r
WHERE m."role_id" = r."id";--> statement-breakpoint
INSERT INTO "organisation_membership_history" ("membership_id", "organisation_id", "from_status", "to_status", "actor_account_id", "reason", "created_at")
SELECT m."id", m."organisation_id", NULL, m."status", m."account_profile_id", 'Membership history baseline', m."created_at"
FROM "organisation_memberships" m;--> statement-breakpoint
INSERT INTO "organisation_membership_role_history" ("membership_id", "organisation_id", "from_role_id", "to_role_id", "actor_account_id", "created_at")
SELECT m."id", m."organisation_id", NULL, m."role_id", m."account_profile_id", m."created_at"
FROM "organisation_memberships" m;
