import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QuotationDetail, QuotationSummary } from "@/modules/quotations/types";

import { QuotationList } from "./quotation-list";

const replaceState = vi.spyOn(window.history, "replaceState");
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/client/quotations",
  useSearchParams: () => currentSearch,
}));

const quotation: QuotationSummary = {
  id: "00000000-0000-4000-8000-000000000020",
  requestId: "00000000-0000-4000-8000-000000000010",
  organisationId: "00000000-0000-4000-8000-000000000030",
  clientAccountId: "00000000-0000-4000-8000-000000000040",
  status: "VIEWED",
  currentVersionNumber: 2,
  acceptedVersionNumber: null,
  lockVersion: 3,
  providerName: "Local Flow Plumbing",
  clientName: "Alex Client",
  requestCategory: "Plumbing",
  currentTotalMinor: 500_000,
  currency: "KES",
  validUntil: "2030-09-05T12:00:00.000Z",
  createdAt: "2026-08-27T12:00:00.000Z",
  updatedAt: "2026-08-28T12:05:00.000Z",
};

const detail: QuotationDetail = {
  ...quotation,
  bookingId: null,
  versions: [
    {
      id: "00000000-0000-4000-8000-000000000050",
      versionNumber: 2,
      status: "VIEWED",
      currency: "KES",
      lineItems: [
        {
          id: "00000000-0000-4000-8000-000000000060",
          category: "LABOUR",
          description: "Replace damaged pipework",
          quantity: 1,
          unitPriceMinor: 500_000,
          totalMinor: 500_000,
          position: 0,
        },
      ],
      labourMinor: 500_000,
      materialsMinor: 0,
      transportMinor: 0,
      additionalChargesMinor: 0,
      subtotalMinor: 500_000,
      discountMinor: 0,
      taxMinor: 0,
      totalMinor: 500_000,
      depositMinor: 100_000,
      expectedDurationMinutes: 180,
      proposedStartAt: "2030-09-10T08:00:00.000Z",
      validUntil: quotation.validUntil,
      scope: "Replace the damaged pipework and test the repaired system.",
      exclusions: "Wall finishes are excluded.",
      warrantyTerms: "Thirty-day workmanship warranty.",
      paymentTerms: "Deposit on acceptance and balance after completion.",
      submittedAt: "2026-08-28T12:00:00.000Z",
      viewedAt: "2026-08-28T12:05:00.000Z",
      respondedAt: null,
      replacedAt: null,
      createdAt: "2026-08-28T11:00:00.000Z",
      updatedAt: "2026-08-28T12:05:00.000Z",
    },
  ],
  history: [],
};

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("client quotation list", () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    window.history.replaceState(window.history.state, "", "/client/quotations");
    replaceState.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => ({
        ok: true,
        json: async () => ({
          data: input.includes(`/client/quotations/${quotation.id}`)
            ? detail
            : {
                items: [quotation],
                page: 1,
                pageSize: 10,
                totalItems: 18,
                totalPages: 2,
                summary: {
                  total: 18,
                  awaitingDecision: 4,
                  accepted: 6,
                  expiringSoon: 2,
                  inRevision: 1,
                  closed: 7,
                },
                categories: ["Electrical", "Plumbing"],
              },
        }),
      })),
    );
  });

  it("renders quotation KPIs, desktop table, and mobile record content", async () => {
    render(<QuotationList audience="client" />, { wrapper: Wrapper });

    expect(
      screen.getByRole("heading", { name: "Your quotations" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("Local Flow Plumbing")).not.toHaveLength(0);
    const summary = within(
      screen.getByRole("region", { name: "Quotation summary" }),
    );
    expect(summary.getByText("Total received").parentElement).toHaveTextContent("18");
    expect(summary.getByText("Awaiting decision").parentElement).toHaveTextContent("4");
    expect(summary.getByText("Accepted").parentElement).toHaveTextContent("6");
    expect(summary.getByText("Expiring soon").parentElement).toHaveTextContent("2");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText(/5,000\.00/).length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/client/quotations?page=1&pageSize=10&sort=updated_desc",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("writes tabs and filters to the URL", async () => {
    render(<QuotationList audience="client" />, { wrapper: Wrapper });
    await screen.findAllByText("Local Flow Plumbing");

    fireEvent.click(
      screen.getByRole("button", { name: "Awaiting decision4" }),
    );
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      "",
      "/client/quotations?bucket=awaiting-decision",
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "Plumbing" },
    });
    await waitFor(() =>
      expect(replaceState).toHaveBeenLastCalledWith(
        window.history.state,
        "",
        "/client/quotations?bucket=awaiting-decision&category=Plumbing",
      ),
    );
  });

  it("opens a responsive summary drawer and keeps decisions on the full route", async () => {
    render(<QuotationList audience="client" />, { wrapper: Wrapper });
    await screen.findAllByText("Local Flow Plumbing");

    fireEvent.click(
      screen.getByRole("row", {
        name: "View quotation for Plumbing from Local Flow Plumbing",
      }),
    );

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveClass("w-[min(31rem,94vw)]", "overflow-hidden");
    expect(await within(drawer).findByText("Replace damaged pipework")).toBeInTheDocument();
    expect(within(drawer).getByText("Thirty-day workmanship warranty.")).toBeInTheDocument();
    expect(
      within(drawer).getByRole("link", { name: "Review and decide" }),
    ).toHaveAttribute("href", `/client/quotations/${quotation.id}`);
    expect(
      within(drawer).queryByRole("button", { name: /accept/i }),
    ).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/client/quotations/${quotation.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("treats an elapsed validity date as closed before the expiry job runs", async () => {
    const expired = {
      ...quotation,
      validUntil: "2025-12-31T12:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            items: [expired],
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            summary: {
              total: 1,
              awaitingDecision: 0,
              accepted: 0,
              expiringSoon: 0,
              inRevision: 0,
              closed: 1,
            },
            categories: ["Plumbing"],
          },
        }),
      }),
    );

    render(<QuotationList audience="client" />, { wrapper: Wrapper });

    expect(await screen.findAllByText("Expired")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Closed1" })).toBeInTheDocument();
    const actionMenu = screen.getAllByRole("button", {
      name: "More actions for Plumbing",
    })[0];
    actionMenu.focus();
    fireEvent.keyDown(actionMenu, { key: "Enter" });
    expect(
      await screen.findByRole("menuitem", { name: "Open quotation" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Review and decide" }),
    ).not.toBeInTheDocument();
  });
});
