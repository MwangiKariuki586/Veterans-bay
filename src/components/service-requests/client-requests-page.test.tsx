import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientServiceRequest } from "@/modules/service-requests/types";

import { ClientRequestsPage } from "./client-requests-page";

const replaceState = vi.spyOn(window.history, "replaceState");
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/client/requests",
  useSearchParams: () => currentSearch,
  useRouter: () => ({ replace: vi.fn() }),
}));

const request: ClientServiceRequest = {
  id: "00000000-0000-4000-8000-000000000010",
  idempotencyKey: "00000000-0000-4000-8000-000000000020",
  source: "MARKETPLACE_DISCOVERY",
  category: "Plumbing",
  preferredProfessionalSlug: "local-flow",
  preferredProfessionalName: "Local Flow",
  preferredServiceSlug: "sink-repair",
  preferredServiceName: "Kitchen sink repair",
  description: "Repair a leaking kitchen sink and inspect the pipework.",
  location: "Westlands, Nairobi",
  preferredTime: "Weekday morning",
  budgetMinMinor: 500_000,
  budgetMaxMinor: 500_000,
  urgency: "SOON",
  contactPreference: "IN_APP",
  status: "QUOTED",
  version: 2,
  submittedAt: "2026-08-20T08:00:00.000Z",
  expiresAt: null,
  createdAt: "2026-08-20T08:00:00.000Z",
  updatedAt: "2026-08-24T07:24:00.000Z",
  history: [],
  attachments: [],
};

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("client requests page", () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    window.history.replaceState(window.history.state, "", "/client/requests");
    replaceState.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (input: string) => ({
        ok: true,
        json: async () =>
          input.includes("/options")
            ? { data: { categories: ["Plumbing"], professionals: [] } }
            : input.includes(`/api/v1/client/requests/${request.id}`)
              ? { data: request }
            : {
                data: {
                  items: [request],
                  page: 1,
                  pageSize: 10,
                  totalItems: 27,
                  totalPages: 3,
                  summary: {
                    total: 27,
                    active: 6,
                    needsAction: 3,
                    drafts: 2,
                    closed: 4,
                  },
                },
              },
      })),
    );
  });

  it("renders authoritative KPIs and the responsive request table", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });

    expect(
      screen.getByRole("heading", { name: "Your service requests" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByText("Kitchen sink repair")).not.toHaveLength(0);
    const summary = within(screen.getByRole("region", { name: "Request summary" }));
    expect(summary.getByText("Total requests").parentElement).toHaveTextContent("27");
    expect(summary.getByText("Active requests").parentElement).toHaveTextContent("6");
    expect(summary.getByText("Needs action").parentElement).toHaveTextContent("3");
    expect(summary.getByText("Drafts").parentElement).toHaveTextContent("2");
    expect(
      summary.getByText("Total requests").parentElement?.parentElement
        ?.parentElement,
    ).toHaveClass("h-[128px]");
    expect(
      within(summary.getByText("Total requests").parentElement?.parentElement
        ?.parentElement as HTMLElement).getByRole("link", {
        name: /View requests/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByText("Quote received").length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/client/requests?page=1&pageSize=10&sort=updated_desc",
      expect.objectContaining({
        credentials: "include",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("opens cached request details in a drawer when a row is clicked", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    fireEvent.click(
      screen.getByRole("row", {
        name: "View details for Kitchen sink repair",
      }),
    );

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveClass("w-[min(31rem,94vw)]", "overflow-hidden");
    expect(within(drawer).getByText("Kitchen sink repair")).toBeInTheDocument();
    expect(within(drawer).getByText("Repair a leaking kitchen sink and inspect the pipework.")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/client/requests/${request.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const footer = within(drawer).getByLabelText("Request actions");
    expect(footer).toHaveClass("shrink-0", "border-t");
    expect(within(footer).getByRole("link", { name: "View professional" })).toHaveAttribute("href", "/professionals/local-flow");
    expect(within(footer).getByRole("link", { name: "Review quote" })).toHaveAttribute("href", "/client/quotations");
    expect(within(drawer).queryByRole("link", { name: "Open full details" })).not.toBeInTheDocument();
  });

  it("opens a legacy request detail link in the drawer", async () => {
    currentSearch = new URLSearchParams({ requestId: request.id });
    window.history.replaceState(
      window.history.state,
      "",
      `/client/requests?requestId=${request.id}`,
    );

    render(<ClientRequestsPage />, { wrapper: Wrapper });

    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Kitchen sink repair")).toBeInTheDocument();
    expect(within(drawer).getByLabelText("Request actions")).toBeInTheDocument();
  });

  it("opens request creation in a drawer and closes back to the list", async () => {
    currentSearch = new URLSearchParams({ editor: "new" });
    window.history.replaceState(
      window.history.state,
      "",
      "/client/requests?editor=new",
    );

    render(<ClientRequestsPage />, { wrapper: Wrapper });

    const drawer = await screen.findByRole("dialog");
    expect(drawer).toHaveClass("w-[min(31rem,94vw)]", "overflow-hidden");
    expect(
      within(drawer).getByRole("heading", { name: "New service request" }),
    ).toBeInTheDocument();
    expect(
      within(drawer).getByRole("combobox", { name: "Service category *" }),
    ).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Save draft" })).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: "Submit request" })).toBeInTheDocument();
    expect(within(drawer).queryByText("Request summary")).not.toBeInTheDocument();
    const editorFooter = within(drawer).getByLabelText("Request editor actions");
    expect(editorFooter).toHaveClass(
      "shrink-0",
      "border-t",
    );
    expect(editorFooter.previousElementSibling).toHaveClass("overflow-y-auto");

    fireEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      "",
      "/client/requests",
    );
  });

  it("opens the creation drawer immediately from the list action", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    fireEvent.click(screen.getByRole("button", { name: "New request" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      "",
      "/client/requests?editor=new",
    );
  });

  it("uses only a kebab menu for row actions", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    expect(screen.queryByRole("link", { name: "Review request" })).not.toBeInTheDocument();
    const actionMenu = screen.getAllByRole("button", {
      name: "More actions for Kitchen sink repair",
    })[0];
    actionMenu.focus();
    fireEvent.keyDown(actionMenu, { key: "Enter" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "View details" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Review quote" })).toBeInTheDocument();
  });

  it("writes tab and filter state to the URL", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    fireEvent.click(screen.getByRole("button", { name: "Active6" }));
    expect(replaceState).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/client/requests?bucket=active",
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "Plumbing" },
    });
    await waitFor(() =>
      expect(replaceState).toHaveBeenCalledWith(
        window.history.state,
        "",
        "/client/requests?bucket=active&category=Plumbing",
      ),
    );
  });

  it("collapses rapid search input into one request", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");
    replaceState.mockClear();

    const search = screen.getByRole("textbox", { name: "Search requests" });
    fireEvent.change(search, { target: { value: "l" } });
    fireEvent.change(search, { target: { value: "le" } });
    fireEvent.change(search, { target: { value: "leak" } });

    expect(replaceState).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Searching");
    expect(screen.getAllByText("Kitchen sink repair").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(replaceState).toHaveBeenCalledWith(
        window.history.state,
        "",
        "/client/requests?search=leak",
      ),
    );
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(fetch).mock.calls.filter(([input]) =>
        String(input).includes("search=leak"),
      ),
    ).toHaveLength(1);
  });

  it("filters cached rows immediately and restores them when search is cleared", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");
    replaceState.mockClear();

    const search = screen.getByRole("textbox", { name: "Search requests" });
    fireEvent.change(search, { target: { value: "electrical" } });

    expect(screen.queryByText("Kitchen sink repair")).not.toBeInTheDocument();
    expect(screen.getByText("Checking all requests")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Searching");
    expect(replaceState).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: "" } });

    expect(screen.getAllByText("Kitchen sink repair").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("restores cached unfiltered results immediately when filters are cleared", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    vi.mocked(fetch).mockImplementation(async (input) => ({
      ok: true,
      json: async () =>
        String(input).includes("/options")
          ? { data: { categories: ["Plumbing"], professionals: [] } }
          : {
              data: {
                items: [],
                page: 1,
                pageSize: 10,
                totalItems: 0,
                totalPages: 1,
                summary: {
                  total: 27,
                  active: 6,
                  needsAction: 3,
                  drafts: 2,
                  closed: 4,
                },
              },
            },
    }) as Response);

    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "Plumbing" },
    });
    expect(
      await screen.findByText("No requests match these filters"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getAllByText("Kitchen sink repair").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(
      window.history.state,
      "",
      "/client/requests",
    );
  });

  it("shows immediate progress feedback while filtered results refresh", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    vi.mocked(fetch).mockImplementation(
      () => new Promise(() => undefined),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "Plumbing" },
    });

    expect(screen.getAllByText("Kitchen sink repair").length).toBeGreaterThan(0);
    expect(await screen.findByText("Updating requests…")).toBeInTheDocument();
  });

  it("narrows cached rows immediately for discrete filters", async () => {
    render(<ClientRequestsPage />, { wrapper: Wrapper });
    await screen.findAllByText("Kitchen sink repair");

    vi.mocked(fetch).mockImplementation(
      () => new Promise(() => undefined),
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "DRAFT" },
    });

    expect(screen.queryByText("Kitchen sink repair")).not.toBeInTheDocument();
    expect(screen.getByText("Checking all requests")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Updating requests");
  });
});
