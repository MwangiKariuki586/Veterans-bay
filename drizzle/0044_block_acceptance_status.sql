-- Block acceptance status for team calendar (Blocked time vs Tasks)
ALTER TABLE "availability_blocks" ADD COLUMN "status" text DEFAULT 'ACCEPTED' NOT NULL;
--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_status_check" CHECK ("availability_blocks"."status" in ('PENDING','ACCEPTED'));
