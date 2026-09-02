import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvoiceDetail } from "@/modules/invoices/types";
import { InvoiceDetail as InvoiceDetailView } from "./invoice-detail";
import { InvoiceList } from "./invoice-list";
import { PaymentList } from "./payment-list";

vi.mock("next/navigation", () => ({
  usePathname: () => "/client/invoices",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const detail: InvoiceDetail = {
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
  it("gives professionals an accounts-focused invoice workspace", async () => {
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
            summary: {
              total: 1,
              outstanding: 1,
              overdue: 0,
              paid: 0,
              drafts: 0,
              settled: 0,
              amounts: [{ currency: "KES", totalMinor: 25_000, paidMinor: 10_000, outstandingMinor: 15_000 }],
            },
          },
        }),
      ),
    );
    render(<InvoiceList audience="professional" />, { wrapper: Wrapper });
    expect(
      (await screen.findAllByText("Electrical safety inspection")).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByText("Outstanding balance")).toBeInTheDocument();
    expect(screen.getByText("Payments recorded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Payment ledger/i })).toHaveAttribute(
      "href",
      "/professional/payments",
    );
    expect(screen.getByPlaceholderText(/service or client/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outstanding: 1" })).toBeInTheDocument();
    expect(screen.getAllByText(/150\.00/).length).toBeGreaterThan(0);
  });

  it("prioritises client balances and hides professional-only draft controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            items: [detail],
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            summary: {
              total: 1,
              outstanding: 1,
              overdue: 0,
              paid: 0,
              drafts: 0,
              settled: 0,
              amounts: [{ currency: "KES", totalMinor: 25_000, paidMinor: 10_000, outstandingMinor: 15_000 }],
            },
          },
        }),
      ),
    );
    render(<InvoiceList audience="client" />, { wrapper: Wrapper });
    expect(
      await screen.findByRole("heading", { name: "Your invoices" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Balance remaining")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "To pay: 1" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/service or professional/i)).toBeInTheDocument();
    expect(screen.queryByText("Draft invoices")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Payment ledger/i })).not.toBeInTheDocument();
  });

  it("opens the complete client invoice drawer with workflow actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        return url.includes(detail.id)
          ? jsonResponse({ data: detail })
          : jsonResponse({
              data: {
                items: [detail],
                page: 1,
                pageSize: 10,
                totalItems: 1,
                totalPages: 1,
                summary: {
                  total: 1,
                  outstanding: 1,
                  overdue: 0,
                  paid: 0,
                  drafts: 0,
                  settled: 0,
                  amounts: [{ currency: "KES", totalMinor: 25_000, paidMinor: 10_000, outstandingMinor: 15_000 }],
                },
              },
            });
      }),
    );
    render(<InvoiceList audience="client" />, { wrapper: Wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));

    const drawer = await screen.findByRole("dialog");
    expect(
      await within(drawer).findByText("1. Financial summary"),
    ).toBeInTheDocument();
    expect(within(drawer).getByText("3. Line items")).toBeInTheDocument();
    expect(within(drawer).getByText("4. Payment history")).toBeInTheDocument();
    expect(within(drawer).getByText("5. Timeline / status")).toBeInTheDocument();
    expect(within(drawer).getByText(/does not confirm or process/i)).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /Download invoice/i })).toHaveAttribute(
      "href",
      `/api/v1/client/invoices/${detail.id}/download`,
    );
    expect(within(drawer).queryByRole("button", { name: /Copy reference/i })).not.toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: /View service record/i })).toHaveAttribute(
      "href",
      `/client/bookings/${detail.bookingId}#service-progress`,
    );
    expect(within(drawer).queryByText(/View full details/i)).not.toBeInTheDocument();
    expect(within(drawer).queryByText(/Contact support/i)).not.toBeInTheDocument();
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
      screen.queryByRole("button", { name: "Record simulated payment" }),
    ).not.toBeInTheDocument();

    rerender(
      <InvoiceDetailView audience="professional" invoiceId={detail.id} />,
    );
    expect(
      await screen.findByRole("button", { name: "Record simulated payment" }),
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
