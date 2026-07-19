CREATE TABLE "account_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"primary_email" text NOT NULL,
	"phone" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"privacy_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_profiles_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "account_profiles_primary_email_unique" UNIQUE("primary_email"),
	CONSTRAINT "account_profiles_status_check" CHECK ("account_profiles"."status" in ('active', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "account_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_profile_id" uuid NOT NULL,
	"type" text NOT NULL,
	"reason" text NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_by_account_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_restrictions_type_check" CHECK ("account_restrictions"."type" in ('suspended', 'banned'))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_account_id" uuid,
	"organisation_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"correlation_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"purpose" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"owner_account_id" uuid NOT NULL,
	"organisation_id" uuid,
	"linked_entity_type" text,
	"linked_entity_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_assets_cloudinary_public_id_unique" UNIQUE("cloudinary_public_id"),
	CONSTRAINT "file_assets_visibility_check" CHECK ("file_assets"."visibility" in ('public', 'private')),
	CONSTRAINT "file_assets_status_check" CHECK ("file_assets"."status" in ('pending', 'ready', 'replaced', 'deleted')),
	CONSTRAINT "file_assets_size_bytes_check" CHECK ("file_assets"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "organisation_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"account_profile_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisation_memberships_org_account_unique" UNIQUE("organisation_id","account_profile_id"),
	CONSTRAINT "organisation_memberships_status_check" CHECK ("organisation_memberships"."status" in ('active', 'suspended', 'removed'))
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organisations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organisations_status_check" CHECK ("organisations"."status" in ('draft', 'pending_review', 'active', 'suspended', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"organisation_id" uuid,
	"actor_account_id" uuid,
	"correlation_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"claimed_by" text,
	"last_error_category" text,
	"last_error_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "outbox_events_status_check" CHECK ("outbox_events"."status" in ('pending', 'claimed', 'published', 'failed', 'dead_lettered')),
	CONSTRAINT "outbox_events_version_check" CHECK ("outbox_events"."event_version" > 0),
	CONSTRAINT "outbox_events_attempt_count_check" CHECK ("outbox_events"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platform_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_profile_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_role_assignments_account_role_unique" UNIQUE("account_profile_id","role_id"),
	CONSTRAINT "platform_role_assignments_status_check" CHECK ("platform_role_assignments"."status" in ('active', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"scope" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_scope_key_unique" UNIQUE("scope","key"),
	CONSTRAINT "roles_scope_check" CHECK ("roles"."scope" in ('organisation', 'platform'))
);
--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_account_profile_id_account_profiles_id_fk" FOREIGN KEY ("account_profile_id") REFERENCES "public"."account_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_created_by_account_id_account_profiles_id_fk" FOREIGN KEY ("created_by_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_owner_account_id_account_profiles_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_memberships" ADD CONSTRAINT "organisation_memberships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_memberships" ADD CONSTRAINT "organisation_memberships_account_profile_id_account_profiles_id_fk" FOREIGN KEY ("account_profile_id") REFERENCES "public"."account_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisation_memberships" ADD CONSTRAINT "organisation_memberships_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_actor_account_id_account_profiles_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."account_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_account_profile_id_account_profiles_id_fk" FOREIGN KEY ("account_profile_id") REFERENCES "public"."account_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_profiles_status_idx" ON "account_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "account_restrictions_account_idx" ON "account_restrictions" USING btree ("account_profile_id");--> statement-breakpoint
CREATE INDEX "account_restrictions_active_idx" ON "account_restrictions" USING btree ("account_profile_id","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_account_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_organisation_idx" ON "audit_events" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "file_assets_owner_idx" ON "file_assets" USING btree ("owner_account_id");--> statement-breakpoint
CREATE INDEX "file_assets_organisation_idx" ON "file_assets" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "file_assets_linked_entity_idx" ON "file_assets" USING btree ("linked_entity_type","linked_entity_id");--> statement-breakpoint
CREATE INDEX "organisation_memberships_account_idx" ON "organisation_memberships" USING btree ("account_profile_id");--> statement-breakpoint
CREATE INDEX "organisation_memberships_org_status_idx" ON "organisation_memberships" USING btree ("organisation_id","status");--> statement-breakpoint
CREATE INDEX "organisations_status_idx" ON "organisations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outbox_events_claim_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE INDEX "outbox_events_organisation_idx" ON "outbox_events" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "permissions_key_idx" ON "permissions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "platform_role_assignments_account_idx" ON "platform_role_assignments" USING btree ("account_profile_id");--> statement-breakpoint
CREATE INDEX "roles_scope_idx" ON "roles" USING btree ("scope");--> statement-breakpoint
INSERT INTO "permissions" ("key", "description") VALUES
	('organisation.view', 'View organisation workspace resources'),
	('organisation.manage', 'Manage organisation settings and publication'),
	('organisation.members.manage', 'Manage organisation memberships and roles'),
	('platform.admin', 'Perform platform administration actions');--> statement-breakpoint
INSERT INTO "roles" ("key", "scope", "name", "description") VALUES
	('owner', 'organisation', 'Owner', 'Full control of an organisation'),
	('admin', 'organisation', 'Admin', 'Administrative access within an organisation'),
	('member', 'organisation', 'Member', 'Standard organisation member access'),
	('technician', 'organisation', 'Technician', 'Assigned-work access within an organisation'),
	('platform_admin', 'platform', 'Platform Admin', 'Platform-wide administration');--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE
	(r.key = 'owner' AND r.scope = 'organisation' AND p.key IN ('organisation.view', 'organisation.manage', 'organisation.members.manage'))
	OR (r.key = 'admin' AND r.scope = 'organisation' AND p.key IN ('organisation.view', 'organisation.manage', 'organisation.members.manage'))
	OR (r.key = 'member' AND r.scope = 'organisation' AND p.key = 'organisation.view')
	OR (r.key = 'technician' AND r.scope = 'organisation' AND p.key = 'organisation.view')
	OR (r.key = 'platform_admin' AND r.scope = 'platform' AND p.key = 'platform.admin');
