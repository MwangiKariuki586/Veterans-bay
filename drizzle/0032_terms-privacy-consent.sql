ALTER TABLE "user" ADD COLUMN "terms_accepted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "privacy_accepted" boolean DEFAULT false NOT NULL;