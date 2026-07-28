import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuotationDetail as QuotationDetailContract } from "@/modules/quotations/types";
import { QuotationDetail } from "./quotation-detail";
import { QuotationVersionView } from "./quotation-view";

const getQuotation = vi.fn();
const quotationAction = vi.fn();

vi.mock("./quotation-api", () => ({
  getQuotation: (...args: unknown[]) => getQuotation(...args),
  quotationAction: (...args: unknown[]) => quotationAction(...args),
}));

vi.mock("@/components/conversations/engagement-conversation", () => ({
  EngagementConversation: () => <div>Conversation surface</div>,
}));

const quotation: QuotationDetailContract = {
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
  validUntil: "2026-08-30T12:00:00.000Z",
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
      validUntil: "2026-08-30T12:00:00.000Z",
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
  history: [
    {
      id: "history-1",
      versionNumber: 1,
      action: "VIEWED",
      fromStatus: "SUBMITTED",
      toStatus: "VIEWED",
      note: null,
      createdAt: "2026-07-27T12:05:00.000Z",
    },
  ],
};

describe("quotation components", () => {
  beforeEach(() => {
    getQuotation.mockReset();
    getQuotation.mockResolvedValue(quotation);
    quotationAction.mockReset();
    quotationAction.mockResolvedValue({
      ...quotation,
      status: "ACCEPTED",
      acceptedVersionNumber: 1,
      lockVersion: 3,
      bookingId: "booking-1",
    });
  });

  it("renders authoritative totals and commercial terms", () => {
    render(<QuotationVersionView version={quotation.versions[0]} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Replace leaking valve")).toHaveLength(2);
    expect(screen.getByText("Scope")).toBeInTheDocument();
    expect(
      screen.getByText("Replace the failed valve and test the connection."),
    ).toBeInTheDocument();
    expect(screen.getByText(/139/)).toBeInTheDocument();
  });

  it("uses the structured acceptance action for the current version", async () => {
    render(
      <QuotationDetail
        audience="client"
        quotationId={quotation.id}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Accept current version" }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Confirm accept" }),
    );
    await waitFor(() =>
      expect(quotationAction).toHaveBeenCalledWith(
        "client",
        quotation.id,
        "accept",
        quotation.lockVersion,
        "",
      ),
    );
    expect(await screen.findByText("Quotation accepted")).toBeInTheDocument();
  });
});
