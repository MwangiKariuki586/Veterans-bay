ALTER TABLE "notifications" DROP CONSTRAINT "notifications_action_target_check";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_action_target_check" CHECK (
  "action_target" IS NULL
  OR (
    "action_target" ~ '^/[a-z0-9/_?=&.%:#-]+$'
    AND "action_target" NOT LIKE '//%'
    AND char_length("action_target") <= 500
  )
);

-- A completed job is the authority for completed service work.
UPDATE "bookings" AS b
SET
  "status" = 'COMPLETED',
  "completed_at" = j."completed_at",
  "lock_version" = b."lock_version" + 1,
  "updated_at" = greatest(b."updated_at", j."completed_at")
FROM "jobs" AS j
WHERE j."booking_id" = b."id"
  AND j."status" = 'COMPLETED'
  AND j."completed_at" IS NOT NULL
  AND (
    b."status" <> 'COMPLETED'
    OR b."completed_at" IS DISTINCT FROM j."completed_at"
  );

UPDATE "booking_reservations" AS br
SET
  "status" = 'RELEASED',
  "released_at" = j."completed_at",
  "updated_at" = greatest(br."updated_at", j."completed_at")
FROM "jobs" AS j
WHERE j."booking_id" = br."booking_id"
  AND j."status" = 'COMPLETED'
  AND j."completed_at" IS NOT NULL
  AND br."status" = 'ACTIVE';

-- Reconcile legacy booking-only completion without fabricating fulfilment.
WITH divergent AS (
  SELECT
    b."id",
    b."status" AS "from_status",
    b."starts_at",
    b."ends_at",
    b."assigned_membership_id",
    b."organisation_id",
    CASE
      WHEN j."status" = 'CANCELLED' THEN 'CANCELLED'
      ELSE coalesce(
        (
          SELECT CASE
            WHEN bh."from_status" IN ('CONFIRMED', 'RESCHEDULED')
              THEN bh."from_status"
            ELSE NULL
          END
          FROM "booking_history" AS bh
          WHERE bh."booking_id" = b."id"
            AND bh."to_status" = 'COMPLETED'
          ORDER BY bh."created_at" DESC, bh."id" DESC
          LIMIT 1
        ),
        'CONFIRMED'
      )
    END AS "restored_status",
    j."cancelled_at"
  FROM "bookings" AS b
  INNER JOIN "jobs" AS j ON j."booking_id" = b."id"
  WHERE b."status" = 'COMPLETED'
    AND j."status" <> 'COMPLETED'
), reconciled AS (
  UPDATE "bookings" AS b
  SET
    "status" = d."restored_status",
    "completed_at" = NULL,
    "cancelled_at" = CASE
      WHEN d."restored_status" = 'CANCELLED'
        THEN coalesce(d."cancelled_at", b."cancelled_at", now())
      ELSE b."cancelled_at"
    END,
    "lock_version" = b."lock_version" + 1,
    "updated_at" = now()
  FROM divergent AS d
  WHERE b."id" = d."id"
  RETURNING
    b."id",
    d."from_status",
    d."restored_status",
    d."starts_at",
    d."ends_at",
    d."assigned_membership_id",
    d."organisation_id"
), history AS (
  INSERT INTO "booking_history" (
    "booking_id",
    "action",
    "from_status",
    "to_status",
    "previous_starts_at",
    "previous_ends_at",
    "starts_at",
    "ends_at",
    "membership_id",
    "note"
  )
  SELECT
    r."id",
    'COMPLETION_RECONCILED',
    r."from_status",
    r."restored_status",
    r."starts_at",
    r."ends_at",
    r."starts_at",
    r."ends_at",
    r."assigned_membership_id",
    'Booking-only completion was reconciled to the authoritative job state.'
  FROM reconciled AS r
  RETURNING "booking_id"
)
INSERT INTO "booking_reservations" (
  "booking_id",
  "organisation_id",
  "membership_id",
  "starts_at",
  "ends_at",
  "status",
  "released_at"
)
SELECT
  r."id",
  r."organisation_id",
  r."assigned_membership_id",
  r."starts_at",
  r."ends_at",
  'ACTIVE',
  NULL
FROM reconciled AS r
WHERE r."restored_status" IN ('CONFIRMED', 'RESCHEDULED')
  AND r."assigned_membership_id" IS NOT NULL
  AND r."starts_at" IS NOT NULL
  AND r."ends_at" IS NOT NULL
ON CONFLICT ("booking_id") DO UPDATE SET
  "organisation_id" = excluded."organisation_id",
  "membership_id" = excluded."membership_id",
  "starts_at" = excluded."starts_at",
  "ends_at" = excluded."ends_at",
  "status" = 'ACTIVE',
  "released_at" = NULL,
  "updated_at" = now();
