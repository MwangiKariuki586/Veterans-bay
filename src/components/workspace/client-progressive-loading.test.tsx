import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingList } from "@/components/bookings/booking-list";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { QuotationList } from "@/components/quotations/quotation-list";
import { ClientRequestsPage } from "@/components/service-requests/client-requests-page";
import { WarrantyList } from "@/components/warranties/warranty-list";

let pathname = "/client/requests";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/components/workspace/workspace-shell-context", () => ({
  useWorkspaceShell: () => ({ workspaceId: "workspace-1", workspaceLabel: "Workspace", userId: "user-1" }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user-1" } } }) },
}));

afterEach(() => vi.unstubAllGlobals());

const pages = [
  { name: "requests", heading: "Your service requests", metric: "Total requests", empty: "No service requests yet", element: <ClientRequestsPage /> },
  { name: "quotations", heading: "Your quotations", metric: "Total received", empty: "No quotations yet", element: <QuotationList audience="client" /> },
  { name: "bookings", heading: "Your bookings", metric: "Total bookings", empty: "No bookings yet", element: <BookingList audience="client" /> },
  { name: "invoices", heading: "Your invoices", metric: "Total invoices", empty: "No invoices available", element: <InvoiceList audience="client" /> },
  { name: "warranties", heading: "Warranties", metric: "Active warranties", empty: "No warranties yet", element: <WarrantyList audience="client" /> },
];

describe("client progressive loading", () => {
  it.each(pages)("keeps $name structure and search mounted through a slow response", async ({ name, heading, metric, empty, element }) => {
    pathname = `/client/${name}`;
    window.history.replaceState(null, "", pathname);
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => { resolveResponse = resolve; });
    vi.stubGlobal("fetch", vi.fn(async () => (await response).clone()));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);

    expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
    expect(screen.getByText(metric)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: `Loading ${metric.toLowerCase()}` })).toBeInTheDocument();
    expect(screen.getByText(`Loading ${name}`)).toHaveAttribute("role", "status");
    expect(screen.queryByText(empty)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(1);

    const search = screen.getByRole("textbox", { name: `Search ${name}` });
    search.focus();
    fireEvent.change(search, { target: { value: "plumbing" } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining("search=plumbing"), expect.any(Object)));

    await act(async () => resolveResponse(new Response(JSON.stringify({ data: {
      items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0,
      categories: [], professionals: [], origins: [], services: [],
      summary: {
        total: 0, active: 0, needsAction: 0, drafts: 0, closed: 0,
        awaitingDecision: 0, accepted: 0, inRevision: 0, expiringSoon: 0,
        pending: 0, scheduled: 0, upcoming: 0, past: 0,
        outstanding: 0, overdue: 0, settled: 0, amounts: [],
        activeWarranties: 0, openClaims: 0, resolvedClaims: 0,
      },
    } }), { status: 200 })));

    expect(await screen.findByText(empty)).toBeInTheDocument();
    expect(screen.queryByText(`Loading ${name}`)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: `Search ${name}` })).toBe(search);
    expect(search).toHaveValue("plumbing");
    expect(search).toHaveFocus();
    unmount();
    client.clear();
  });
});
