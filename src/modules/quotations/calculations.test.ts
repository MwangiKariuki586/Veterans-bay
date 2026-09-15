import { describe, expect, it } from "vitest";

import { calculateQuotationTotals } from "./calculations";

describe("calculateQuotationTotals", () => {
  it("calculates category subtotals and the authoritative total", () => {
    expect(
      calculateQuotationTotals({
        lineItems: [
          {
            category: "LABOUR",
            description: "Installation",
            quantity: 2,
            unitPriceMinor: 5_000,
          },
          {
            category: "MATERIAL",
            description: "Replacement valve",
            quantity: 1,
            unitPriceMinor: 3_000,
          },
          {
            category: "TRANSPORT",
            description: "Call-out",
            quantity: 1,
            unitPriceMinor: 1_000,
          },
          {
            category: "ADDITIONAL",
            description: "Disposal",
            quantity: 1,
            unitPriceMinor: 500,
          },
        ],
        discountMinor: 500,
        taxMinor: 1_400,
        depositMinor: 5_000,
      }),
    ).toEqual({
      labourMinor: 10_000,
      materialsMinor: 3_000,
      transportMinor: 1_000,
      additionalChargesMinor: 500,
      subtotalMinor: 14_500,
      discountMinor: 500,
      taxMinor: 1_400,
      totalMinor: 15_400,
      depositMinor: 5_000,
    });
  });

  it("rejects discounts and deposits that exceed their authority boundaries", () => {
    const lineItems = [
      {
        category: "LABOUR" as const,
        description: "Labour",
        quantity: 1,
        unitPriceMinor: 1_000,
      },
    ];
    expect(() =>
      calculateQuotationTotals({
        lineItems,
        discountMinor: 1_001,
        taxMinor: 0,
        depositMinor: 0,
      }),
    ).toThrow("QUOTATION_DISCOUNT_EXCEEDS_SUBTOTAL");
    expect(() =>
      calculateQuotationTotals({
        lineItems,
        discountMinor: 0,
        taxMinor: 0,
        depositMinor: 1_001,
      }),
    ).toThrow("QUOTATION_DEPOSIT_EXCEEDS_TOTAL");
  });
});
