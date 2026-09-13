-- Task location and blocked time name/description
ALTER TABLE "availability_blocks" ADD COLUMN "description" text;
ALTER TABLE "bookings" ADD COLUMN "location" text;
ALTER TABLE "jobs" ADD COLUMN "location_snapshot" text;
--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_description_check" CHECK (char_length(trim("description")) BETWEEN 3 AND 1000 OR "description" IS NULL);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_check" CHECK (char_length(trim("location")) BETWEEN 3 AND 300 OR "location" IS NULL);
