ALTER TABLE "reviews" DROP CONSTRAINT "reviews_feedback_check";
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_feedback_check" CHECK (
  char_length(trim("feedback")) = 0
  OR char_length(trim("feedback")) BETWEEN 3 AND 4000
);
