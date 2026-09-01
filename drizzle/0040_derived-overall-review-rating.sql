ALTER TABLE "reviews" DROP CONSTRAINT "reviews_rating_check";
ALTER TABLE "reviews"
  ALTER COLUMN "overall_rating" TYPE numeric(2, 1)
  USING "overall_rating"::numeric(2, 1);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK (
  "overall_rating" BETWEEN 1 AND 5
  AND "service_quality_rating" BETWEEN 1 AND 5
  AND "communication_rating" BETWEEN 1 AND 5
  AND "timeliness_rating" BETWEEN 1 AND 5
  AND "professionalism_rating" BETWEEN 1 AND 5
  AND "value_rating" BETWEEN 1 AND 5
);
