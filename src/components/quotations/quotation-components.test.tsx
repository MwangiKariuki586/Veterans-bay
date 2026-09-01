import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuotationDetail as QuotationDetailContract } from "@/modules/quotations/types";
import { QuotationDetail } from "./quotation-detail";
import { QuotationVersionView } from "./quotation-view";

const getQuotation = vi.fn();
const getQuotationRequest = vi.fn();
const getQuotationProfessional = vi.fn();
const getQuotationAttachment = vi.fn();
const quotationAction = vi.fn();

vi.mock("./quotation-api", () => ({
  getQuotation: (...args: unknown[]) => getQuotation(...args),
  getQuotationRequest: (...args: unknown[]) => getQuotationRequest(...args),
  getQuotationProfessional: (...args: unknown[]) =>
    getQuotationProfessional(...args),
  getQuotationAttachment: (...args: unknown[]) =>
    getQuotationAttachment(...args),
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
    getQuotationRequest.mockReset();
    getQuotationRequest.mockResolvedValue({
      id: quotation.requestId,
      idempotencyKey: "request-key",
      source: "DIRECT_SERVICE_PAGE",
      category: "Plumbing",
      preferredProfessionalSlug: "trusted-plumbing",
      preferredProfessionalName: "Trusted Plumbing",
      preferredServiceSlug: "plumbing-repair",
      preferredServiceName: "Plumbing repair",
      description: "Repair a leaking valve in the kitchen.",
      location: "Kilimani, Nairobi",
      preferredTime: "Weekday morning",
      budgetMinMinor: 10_000,
      budgetMaxMinor: 20_000,
      urgency: "SOON",
      contactPreference: "IN_APP",
      status: "QUOTED",
      version: 3,
      submittedAt: "2026-07-26T10:00:00.000Z",
      expiresAt: null,
      createdAt: "2026-07-26T09:00:00.000Z",
      updatedAt: "2026-07-27T12:05:00.000Z",
      history: [],
      attachments: [],
    });
    getQuotationProfessional.mockReset();
    getQuotationProfessional.mockResolvedValue({
      slug: "trusted-plumbing",
      businessName: "Trusted Plumbing",
      description: null,
      primaryCategory: "Plumbing",
      categories: ["Plumbing"],
      operatingLocation: "Nairobi",
      serviceAreas: ["Nairobi"],
      availabilitySummary: null,
      nextAvailableSlot: null,
      verified: true,
      logoUrl: null,
      rating: 4.8,
      reviewCount: 24,
      completedJobs: 80,
      responseIndicator: "Responds within 1 hour",
      portfolio: [],
      services: [],
    });
    getQuotationAttachment.mockReset();
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
    render(<QuotationDetail audience="client" quotationId={quotation.id} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Accept quotation" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Accept this quotation?",
    });
    expect(
      within(dialog).getByText(/Version 1.*Ksh.*139\.00/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Accept quotation" }),
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

  it("keeps the awaiting-decision actions together in the quotation status card", async () => {
    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    expect(
      await screen.findByRole("heading", { name: "Awaiting your decision" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accept quotation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request revision" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Decline quotation" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Latest quote received")).not.toBeInTheDocument();
  });

  it("collects revision details in a modal without expanding the summary", async () => {
    quotationAction.mockResolvedValueOnce({
      ...quotation,
      status: "REVISION_REQUESTED",
      lockVersion: 3,
    });
    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Request revision" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Request a quotation revision",
    });
    const submit = within(dialog).getByRole("button", {
      name: "Send revision request",
    });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("What should be revised?"), {
      target: { value: "Please revise the material cost." },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(quotationAction).toHaveBeenCalledWith(
        "client",
        quotation.id,
        "request-revision",
        quotation.lockVersion,
        "Please revise the material cost.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the recorded reason and recovery actions for a revision request", async () => {
    getQuotation.mockResolvedValueOnce({
      ...quotation,
      status: "REVISION_REQUESTED",
      history: [
        ...quotation.history,
        {
          id: "history-revision",
          versionNumber: 1,
          action: "REVISION_REQUESTED",
          fromStatus: "VIEWED",
          toStatus: "REVISION_REQUESTED",
          note: "Please revise the materials cost.",
          createdAt: "2026-09-01T08:00:00.000Z",
        },
      ],
    });

    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    expect(
      await screen.findByRole("heading", { name: "Revision requested" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Please revise the materials cost."),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "View revision request" }),
    ).toHaveAttribute("href", "#quotation-activity");
    expect(
      screen.getByRole("link", { name: "Message professional" }),
    ).toHaveAttribute("href", "#quotation-conversation");
  });

  it("links an accepted quotation status card to its preserved booking", async () => {
    getQuotation.mockResolvedValueOnce({
      ...quotation,
      status: "ACCEPTED",
      acceptedVersionNumber: 1,
      bookingId: "booking-1",
    });

    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    expect(
      await screen.findByRole("heading", { name: "Quotation accepted" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Version 1 preserved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View booking" })).toHaveAttribute(
      "href",
      "/client/bookings/booking-1",
    );
  });

  it("confirms decline in a modal with an optional reason", async () => {
    quotationAction.mockResolvedValueOnce({
      ...quotation,
      status: "DECLINED",
      lockVersion: 3,
    });
    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Decline quotation" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Decline this quotation?",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Decline quotation" }),
    );

    await waitFor(() =>
      expect(quotationAction).toHaveBeenCalledWith(
        "client",
        quotation.id,
        "decline",
        quotation.lockVersion,
        "",
      ),
    );
  });

  it("offers useful next actions after a quotation is declined", async () => {
    getQuotation.mockResolvedValueOnce({
      ...quotation,
      status: "DECLINED",
      history: [
        ...quotation.history,
        {
          id: "history-declined",
          versionNumber: 1,
          action: "DECLINED",
          fromStatus: "VIEWED",
          toStatus: "DECLINED",
          note: "The budget does not work for me.",
          createdAt: "2026-09-01T08:00:00.000Z",
        },
      ],
    });

    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    expect(
      await screen.findByRole("heading", { name: "Quotation declined" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("The budget does not work for me."),
    ).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Browse other professionals" }),
    ).toHaveAttribute("href", "/marketplace?category=Plumbing");
    expect(
      screen.getByRole("link", { name: "Request a new quote" }),
    ).toHaveAttribute("href", "/client/requests/new?category=Plumbing");
  });

  it("renders the related request and professional context", async () => {
    render(<QuotationDetail audience="client" quotationId={quotation.id} />);

    expect(await screen.findByText("Request summary")).toBeInTheDocument();
    expect(await screen.findByText("Kilimani, Nairobi")).toBeInTheDocument();
    expect(await screen.findByText("Weekday morning")).toBeInTheDocument();
    expect(await screen.findByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("Responds within 1 hour")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "download",
      expect.stringMatching(/\.pdf$/),
    );
  });
});
