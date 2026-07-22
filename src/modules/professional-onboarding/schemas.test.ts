import { describe, expect, it } from "vitest";

import {
  onboardingReviewDecisionBodySchema,
  updateOnboardingBodySchema,
} from "./schemas";

describe("updateOnboardingBodySchema", () => {
  it("accepts normal phone formatting and rejects alphabetic characters", () => {
    expect(
      updateOnboardingBodySchema.safeParse({ phone: "+254 700 000 000" }).success,
    ).toBe(true);
    expect(
      updateOnboardingBodySchema.safeParse({ phone: "2099292w" }).success,
    ).toBe(false);
  });
});

describe("onboardingReviewDecisionBodySchema", () => {
  it("requires an explicit decision and a meaningful reason", () => {
    expect(
      onboardingReviewDecisionBodySchema.safeParse({
        decision: "approve",
        reason: "Evidence reviewed and accepted.",
      }).success,
    ).toBe(true);
    expect(
      onboardingReviewDecisionBodySchema.safeParse({
        decision: "approve",
        reason: "ok",
      }).success,
    ).toBe(false);
    expect(
      onboardingReviewDecisionBodySchema.safeParse({
        decision: "restore",
        reason: "Evidence reviewed and accepted.",
      }).success,
    ).toBe(false);
  });
});
