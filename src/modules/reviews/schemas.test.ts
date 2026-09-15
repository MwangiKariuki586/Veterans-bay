import { describe, expect, it } from "vitest";

import { submitReviewBodySchema } from "./schemas";

const ratings = {
  serviceQualityRating: 5,
  communicationRating: 5,
  timelinessRating: 5,
  professionalismRating: 5,
  valueRating: 5,
};

describe("review submission schema", () => {
  it("accepts rating-only reviews and normalizes omitted feedback", () => {
    expect(submitReviewBodySchema.parse(ratings)).toEqual({
      ...ratings,
      feedback: "",
      overallRating: 5,
    });
    expect(
      submitReviewBodySchema.parse({ ...ratings, feedback: "   " }).feedback,
    ).toBe("");
  });

  it("still rejects non-empty feedback that is too short", () => {
    expect(() =>
      submitReviewBodySchema.parse({ ...ratings, feedback: "ok" }),
    ).toThrow(/at least 3 characters/i);
  });

  it("derives a fractional overall score from the five categories", () => {
    expect(
      submitReviewBodySchema.parse({
        ...ratings,
        serviceQualityRating: 3,
        communicationRating: 4,
      }).overallRating,
    ).toBe(4.4);
  });
});
