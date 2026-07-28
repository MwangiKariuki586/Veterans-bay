import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvoiceDetail } from "@/modules/invoices/types";
import { InvoiceDetail as InvoiceDetailView } from "./invoice-detail";
import { InvoiceList } from "./invoice-list";
import { PaymentList } from "./payment-list";

const detail: InvoiceDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  invoiceNumber: "INV-2026-ABCD1234",
  jobId: "22222222-2222-4222-8222-222222222222",
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
  items: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      sourceType: "JOB_BASE",
      description: "Electrical safety inspection",
      quantity: 1,
      unitPriceMinor: 25_000,
      totalMinor: 25_000,
      paidMinor: 10_000,
      balanceMinor: 15_000,
    },
  ],
  payments: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      status: "ALLOCATED",
      amountMinor: 10_000,
      currency: "KES",
      method: "BANK_TRANSFER",
      transactionReference: "BANK-001",
      notes: "Recorded at reception.",
      evidenceAssetId: null,
      paidAt: "2026-07-28T08:00:00.000Z",
      createdAt: "2026-07-28T08:00:00.000Z",
      allocations: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          invoiceItemId: "55555555-5555-4555-8555-555555555555",
          amountMinor: 10_000,
          adjustedMinor: 0,
        },
      ],
      adjustments: [],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("invoice workspaces", () => {
  it("shows balances and manual-record language in the professional list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            items: [detail],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        }),
      ),
    );
    render(<InvoiceList audience="professional" />);
    expect(
      await screen.findByText("Electrical safety inspection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Manual payment record")).toBeInTheDocument();
    expect(screen.getByText(/150\.00 due/)).toBeInTheDocument();
  });

  it("renders client-safe detail and professional allocation controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: detail })),
    );
    const { rerender } = render(
      <InvoiceDetailView audience="client" invoiceId={detail.id} />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Electrical safety inspection",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Manual financial record")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Record manual payment" }),
    ).not.toBeInTheDocument();

    rerender(
      <InvoiceDetailView audience="professional" invoiceId={detail.id} />,
    );
    expect(
      await screen.findByRole("button", { name: "Record manual payment" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Item allocations")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reverse remaining" }),
    ).toBeInTheDocument();
  });

  it("renders the organisation payment ledger", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            items: [
              {
                id: detail.payments[0]!.id,
                clientName: detail.clientName,
                amountMinor: 10_000,
                allocatedMinor: 10_000,
                adjustedMinor: 0,
                currency: "KES",
                method: "BANK_TRANSFER",
                status: "ALLOCATED",
                transactionReference: "BANK-001",
                paidAt: "2026-07-28T08:00:00.000Z",
              },
            ],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        }),
      ),
    );
    render(<PaymentList />);
    expect(await screen.findByText("Amina Client")).toBeInTheDocument();
    expect(screen.getByText(/100\.00 allocated/)).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
