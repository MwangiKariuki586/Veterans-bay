import { describe, expect, it } from "vitest";

import { AppError } from "../../platform/errors/app-error";
import { enforcePreviewPaymentPolicy } from "./preview-policy";

describe("preview payment policy", () => {
  it("accepts only clearly simulated preview records", () => {
    expect(() =>
      enforcePreviewPaymentPolicy("preview", {
        method: "OTHER",
        transactionReference: "PREVIEW-NO-FUNDS-001",
      }),
    ).not.toThrow();
  });

  it.each([
    { method: "BANK_TRANSFER" as const, transactionReference: "PREVIEW-001" },
    { method: "OTHER" as const, transactionReference: "BANK-001" },
    {
      evidenceAssetId: "3dbf3cc8-a8e3-4a09-94cc-38bf70664cf6",
      method: "OTHER" as const,
      transactionReference: "PREVIEW-001",
    },
  ])("rejects a non-simulated preview record", (input) => {
    expect(() => enforcePreviewPaymentPolicy("preview", input)).toThrowError(
      expect.objectContaining<Partial<AppError>>({
        code: "PREVIEW_PAYMENT_MUST_BE_SIMULATED",
        status: 422,
      }),
    );
  });

  it("does not change the future production policy", () => {
    expect(() =>
      enforcePreviewPaymentPolicy("production", {
        method: "BANK_TRANSFER",
        transactionReference: "BANK-001",
      }),
    ).not.toThrow();
  });
});
