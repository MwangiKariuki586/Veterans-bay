WITH inserted_reports AS (
  INSERT INTO "moderation_reports" (
    "submitted_by_account_id",
    "organisation_id",
    "category",
    "subject_type",
    "subject_id",
    "summary",
    "details",
    "status",
    "created_at",
    "updated_at"
  )
  SELECT
    review_report."reported_by_account_id",
    review."organisation_id",
    'REVIEW_MANIPULATION',
    'REVIEW',
    review_report."review_id"::text,
    'Verified review reported for moderation',
    left(
      'Review report reason: ' || review_report."reason" || '. ' ||
      coalesce(nullif(trim(review_report."details"), ''), 'The reporter requested administrator review.'),
      4000
    ),
    'OPEN',
    review_report."created_at",
    review_report."created_at"
  FROM "review_reports" AS review_report
  INNER JOIN "reviews" AS review ON review."id" = review_report."review_id"
  WHERE review_report."status" = 'PENDING'
    AND NOT EXISTS (
      SELECT 1
      FROM "moderation_reports" AS moderation_report
      WHERE moderation_report."subject_type" = 'REVIEW'
        AND moderation_report."subject_id" = review_report."review_id"::text
        AND moderation_report."submitted_by_account_id" = review_report."reported_by_account_id"
    )
  RETURNING
    "id",
    "organisation_id",
    "submitted_by_account_id",
    "category",
    "subject_type",
    "subject_id",
    "created_at"
)
INSERT INTO "outbox_events" (
  "event_type",
  "event_version",
  "aggregate_type",
  "aggregate_id",
  "organisation_id",
  "actor_account_id",
  "payload",
  "created_at"
)
SELECT
  'report.submitted',
  1,
  'moderation_report',
  inserted_report."id"::text,
  inserted_report."organisation_id",
  inserted_report."submitted_by_account_id",
  jsonb_build_object(
    'category', inserted_report."category",
    'subjectType', inserted_report."subject_type",
    'subjectId', inserted_report."subject_id"
  ),
  inserted_report."created_at"
FROM inserted_reports AS inserted_report;
