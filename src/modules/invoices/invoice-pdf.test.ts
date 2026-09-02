import { describe, expect, it } from "vitest";

import type { InvoiceDetail } from "./types";
import { createInvoicePdf } from "./invoice-pdf";

describe("createInvoicePdf", () => {
  it("creates a downloadable invoice with balances and manual-payment context", () => {
    const bytes = createInvoicePdf(invoice());
    const text = new TextDecoder().decode(bytes);

    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("INVOICE");
    expect(text).toContain("Balance due: KES 150.00");
    expect(text).toContain("manual records entered by the professional");
    expect(text.endsWith("%%EOF")).toBe(true);
  });
});

function invoice(): InvoiceDetail {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    invoiceNumber: "INV-2026-ABCD1234",
    jobId: "22222222-2222-4222-8222-222222222222",
    bookingId: "88888888-8888-4888-8888-888888888888",
    organisationId: "33333333-3333-4333-8333-333333333333",
    clientAccountId: "44444444-4444-4444-8444-444444444444",
    serviceName: "Electrical safety inspection",
    providerName: "Veterans Bay Electrical",
    clientName: "Amina Client",
    status: "PARTIALLY_PAID",
    currency: "KES",
    subtotalMinor: 25_000,
    taxMinor: 0,
    totalMinor: 25_000,
    paidMinor: 10_000,
    balanceMinor: 15_000,
    notes: null,
    paymentTermsSnapshot: "Payment after confirmation.",
    issuedAt: "2026-07-28T08:00:00.000Z",
    dueAt: "2026-08-11T08:00:00.000Z",
    updatedAt: "2026-07-28T08:00:00.000Z",
    lockVersion: 3,
    items: [{
      id: "55555555-5555-4555-8555-555555555555",
      sourceType: "JOB_BASE",
      description: "Electrical safety inspection",
      quantity: 1,
      unitPriceMinor: 25_000,
      totalMinor: 25_000,
      paidMinor: 10_000,
      balanceMinor: 15_000,
    }],
    payments: [],
  };
}
