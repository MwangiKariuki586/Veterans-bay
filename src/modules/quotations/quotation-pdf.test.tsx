import { describe, expect, it } from "vitest";

import type { QuotationDetail } from "./types";
import { createQuotationPdf } from "./quotation-pdf";

describe("createQuotationPdf", () => {
  it("creates a complete PDF document for the current preserved version", () => {
    const bytes = createQuotationPdf(quotation());
    const text = new TextDecoder().decode(bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("FORMAL QUOTATION");
    expect(text).toContain("Trusted Plumbing");
    expect(text).toContain("xref");
    expect(text.endsWith("%%EOF")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(900);
  });
});

function quotation(): QuotationDetail {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    requestId: "00000000-0000-4000-8000-000000000010",
    organisationId: "00000000-0000-4000-8000-000000000030",
    clientAccountId: "00000000-0000-4000-8000-000000000040",
    status: "VIEWED",
    currentVersionNumber: 1,
    acceptedVersionNumber: null,
    lockVersion: 2,
    providerName: "Trusted Plumbing",
    clientName: "Alex Client",
    requestCategory: "Plumbing",
    currentTotalMinor: 13_900,
    currency: "KES",
    validUntil: "2036-08-30T12:00:00.000Z",
    createdAt: "2026-07-27T12:00:00.000Z",
    updatedAt: "2026-07-27T12:05:00.000Z",
    bookingId: null,
    versions: [
      {
        id: "00000000-0000-4000-8000-000000000050",
        versionNumber: 1,
        status: "VIEWED",
        currency: "KES",
        lineItems: [
          {
            id: "00000000-0000-4000-8000-000000000060",
            category: "LABOUR",
            description: "Replace leaking valve",
            quantity: 2,
            unitPriceMinor: 5_000,
            totalMinor: 10_000,
            position: 0,
          },
        ],
        labourMinor: 10_000,
        materialsMinor: 3_000,
        transportMinor: 0,
        additionalChargesMinor: 0,
        subtotalMinor: 13_000,
        discountMinor: 500,
        taxMinor: 1_400,
        totalMinor: 13_900,
        depositMinor: 5_000,
        expectedDurationMinutes: 180,
        proposedStartAt: "2026-08-02T09:00:00.000Z",
        validUntil: "2036-08-30T12:00:00.000Z",
        scope: "Replace the failed valve and test the connection.",
        exclusions: "Wall finishes are excluded.",
        warrantyTerms: "90-day workmanship warranty.",
        paymentTerms: "Deposit then balance after completion.",
        submittedAt: "2026-07-27T12:00:00.000Z",
        viewedAt: "2026-07-27T12:05:00.000Z",
        respondedAt: null,
        replacedAt: null,
        createdAt: "2026-07-27T11:00:00.000Z",
        updatedAt: "2026-07-27T12:05:00.000Z",
      },
    ],
    history: [],
  };
}
