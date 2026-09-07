import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedShell } from "./authenticated-shell";
import { useClientDashboard, useClientSpending } from "./client-dashboard-context";

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const mocks = vi.hoisted(() => ({
  pathname: "/client/bookings/new",
  router: { replace: vi.fn() },
  search: "service=plumbing",
  session: null as { user: { id: string } } | null,
  sessionPending: true,
  cachedLabel: "Client workspace" as string | null,
  currentWorkspace: vi.fn(),
  listWorkspaces: vi.fn(),
  selectWorkspace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => mocks.router,
}));

vi.mock("@/components/public/site-header", () => ({
  SiteHeader: () => <header>Workspace header</header>,
}));

vi.mock("@/components/workspace/workspace-sidebar", () => ({
  WorkspaceSidebar: () => <aside>Workspace navigation</aside>,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.sessionPending,
    }),
  },
}));

vi.mock("@/lib/client-resource-cache", () => ({
  clearAllClientResourceCaches: vi.fn(),
  getCachedResource: () => mocks.cachedLabel,
  setCachedResource: vi.fn(),
}));

vi.mock("@/lib/workspace-entry", () => ({
  WorkspaceEntryError: class WorkspaceEntryError extends Error {
    constructor(
      readonly code: string,
      readonly status: number,
    ) {
      super(code);
    }
  },
  getCurrentWorkspace: mocks.currentWorkspace,
  listAvailableWorkspaces: mocks.listWorkspaces,
  selectWorkspace: mocks.selectWorkspace,
}));

describe("authenticated shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/client/bookings/new";
    mocks.search = "service=plumbing";
    window.history.replaceState({}, "", `/?${mocks.search}`);
    mocks.session = null;
    mocks.sessionPending = true;
    mocks.cachedLabel = "Client workspace";
    mocks.currentWorkspace.mockReset();
    mocks.listWorkspaces.mockReset();
    mocks.selectWorkspace.mockReset();
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });

  it.each(["/client", "/client/requests", "/client/bookings"])(
    "loads dashboard data after workspace resolution on %s",
    async (pathname) => {
      mocks.pathname = pathname;
      mocks.session = { user: { id: "user-1" } };
      mocks.sessionPending = false;
      let resolveWorkspace!: (value: { id: string; kind: string; label: string }) => void;
      mocks.currentWorkspace.mockReturnValue(new Promise((resolve) => {
        resolveWorkspace = resolve;
      }));
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        data: { summary: { openRequests: 7 } },
      }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      function DashboardProbe() {
        const dashboard = useClientDashboard();
        return <section>{dashboard?.loading ? "Loading dashboard" : `Open requests: ${dashboard?.data?.summary.openRequests}`}</section>;
      }

      try {
        renderWithClient(<AuthenticatedShell kind="client" hideIntro><DashboardProbe /></AuthenticatedShell>);
        expect(screen.getByText("Loading dashboard")).toBeInTheDocument();
        expect(fetchMock).not.toHaveBeenCalled();
        resolveWorkspace({ id: "client:profile-1", kind: "client", label: "Personal account" });
        expect(await screen.findByText("Open requests: 7")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/api/v1/client/dashboard?"),
          expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    },
  );

  it("isolates delayed spending range changes from dashboard consumers and reuses cached ranges", async () => {
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
    mocks.currentWorkspace.mockResolvedValue({ id: "client:profile-1", kind: "client", label: "Personal account" });
    let resolveRange!: (response: Response) => void;
    const response = (count: number, spend: number) => new Response(JSON.stringify({
      data: { summary: { openRequests: count }, spending: { currentMonthMinor: spend } },
    }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(7, 100))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRange = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const dashboardRender = vi.fn();
    function SpendingProbe() {
      const spending = useClientSpending();
      return <><select aria-label="Period" value={spending.range} onChange={(event) => spending.setRange(event.target.value as "month" | "30-days")}><option value="month">Month</option><option value="30-days">30 days</option></select><p>{spending.loading ? "Loading spending" : `Spend: ${spending.data?.currentMonthMinor}`}</p></>;
    }
    function DashboardProbe() {
      const dashboard = useClientDashboard();
      dashboardRender();
      return <><p>Requests: {dashboard?.data?.summary.openRequests}</p>{dashboard?.data ? <SpendingProbe /> : null}</>;
    }
    try {
      renderWithClient(<AuthenticatedShell kind="client" hideIntro><DashboardProbe /></AuthenticatedShell>);
      expect(await screen.findByText("Spend: 100")).toBeInTheDocument();
      const renders = dashboardRender.mock.calls.length;
      const period = screen.getByRole("combobox", { name: "Period" });
      period.focus();
      fireEvent.change(period, { target: { value: "30-days" } });
      expect(await screen.findByText("Loading spending")).toBeInTheDocument();
      expect(screen.getByText("Requests: 7")).toBeInTheDocument();
      expect(period).toHaveFocus();
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      resolveRange(response(99, 300));
      expect(await screen.findByText("Spend: 300")).toBeInTheDocument();
      expect(screen.getByText("Requests: 7")).toBeInTheDocument();
      expect(dashboardRender).toHaveBeenCalledTimes(renders);
      fireEvent.change(period, { target: { value: "month" } });
      expect(await screen.findByText("Spend: 100")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("pins the shared footer after short workspace content", () => {
    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Short page content</section>
      </AuthenticatedShell>,
    );

    const footer = screen.getByRole("contentinfo");

    expect(footer.parentElement).toHaveClass(
      "flex",
      "min-h-full",
      "flex-col",
      "gap-6",
    );
    expect(footer).toHaveClass("mt-auto");
    expect(screen.getByText("Short page content")).toBeInTheDocument();

    const main = screen.getByRole("main");
    const viewportShell = main.parentElement?.parentElement?.parentElement;
    expect(viewportShell).toHaveClass("fixed", "inset-0", "overflow-hidden");
    expect(viewportShell).not.toHaveClass("min-h-screen");
  });

  it("locks root document scrolling while the workspace shell is mounted", () => {
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "visible";
    document.documentElement.scrollTop = 92;
    document.body.scrollTop = 92;

    const { unmount } = render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Requests</section>
      </AuthenticatedShell>,
    );

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);

    unmount();

    expect(document.documentElement.style.overflow).toBe("auto");
    expect(document.body.style.overflow).toBe("visible");
  });

  it("resets the shared workspace scroll pane only when the pathname changes", () => {
    const { rerender } = render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Booking list</section>
      </AuthenticatedShell>,
    );
    const main = screen.getByRole("main");
    main.scrollTop = 640;
    document.documentElement.scrollTop = 72;
    document.body.scrollTop = 72;

    window.history.replaceState({}, "", "/?status=confirmed");
    rerender(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Filtered booking list</section>
      </AuthenticatedShell>,
    );

    expect(main.scrollTop).toBe(640);
    expect(document.documentElement.scrollTop).toBe(72);
    expect(document.body.scrollTop).toBe(72);

    mocks.pathname = "/client/bookings/booking-1";
    rerender(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Booking details</section>
      </AuthenticatedShell>,
    );

    expect(main.scrollTop).toBe(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it("leaves cross-route hash navigation to the browser", () => {
    const { rerender } = render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Booking list</section>
      </AuthenticatedShell>,
    );
    const main = screen.getByRole("main");
    main.scrollTop = 320;

    window.history.replaceState({}, "", "/#service-progress");
    mocks.pathname = "/client/bookings/booking-1";
    rerender(
      <AuthenticatedShell kind="client" hideIntro>
        <section id="service-progress">Service progress</section>
      </AuthenticatedShell>,
    );

    expect(main.scrollTop).toBe(320);
  });

  it("preserves the protected path and query when sign in is required", async () => {
    mocks.sessionPending = false;
    window.history.replaceState({}, "", `/?${mocks.search}`);

    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Protected booking form</section>
      </AuthenticatedShell>,
    );

    expect(mocks.router.replace).toHaveBeenCalledWith(
      "/login?redirect=%2Fclient%2Fbookings%2Fnew%3Fservice%3Dplumbing",
    );
  });

  it("mounts page content while the current workspace is validated", () => {
    mocks.cachedLabel = null;
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
    mocks.currentWorkspace.mockReturnValue(new Promise(() => undefined));

    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Client bookings</section>
      </AuthenticatedShell>,
    );

    expect(screen.getByText("Client bookings")).toBeInTheDocument();
    expect(mocks.currentWorkspace).toHaveBeenCalledOnce();
    expect(mocks.listWorkspaces).not.toHaveBeenCalled();
    expect(mocks.selectWorkspace).not.toHaveBeenCalled();
  });

  it("uses the current workspace without listing or selecting it again", async () => {
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
    mocks.currentWorkspace.mockResolvedValue({
      id: "client:profile-1",
      kind: "client",
      label: "Personal account",
    });

    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Client dashboard</section>
      </AuthenticatedShell>,
    );

    await waitFor(() => expect(mocks.currentWorkspace).toHaveBeenCalledOnce());
    expect(mocks.listWorkspaces).not.toHaveBeenCalled();
    expect(mocks.selectWorkspace).not.toHaveBeenCalled();
  });

  it("recovers a mismatched workspace and remounts page data loaders", async () => {
    const mounted = vi.fn();
    function PageLoader() {
      useEffect(() => {
        mounted();
      }, []);
      return <section>Professional enquiries</section>;
    }

    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
    mocks.currentWorkspace.mockResolvedValue({
      id: "client:profile-1",
      kind: "client",
      label: "Personal account",
    });
    mocks.listWorkspaces.mockResolvedValue([
      {
        id: "organisation:organisation-1",
        kind: "organisation",
        label: "Emkay Ltd",
      },
    ]);
    mocks.selectWorkspace.mockResolvedValue({
      id: "organisation:organisation-1",
      kind: "organisation",
      label: "Emkay Ltd",
    });

    render(
      <AuthenticatedShell kind="professional" hideIntro>
        <PageLoader />
      </AuthenticatedShell>,
    );

    await waitFor(() => expect(mounted).toHaveBeenCalledTimes(2));
    expect(mocks.listWorkspaces).toHaveBeenCalledOnce();
    expect(mocks.selectWorkspace).toHaveBeenCalledWith(
      "organisation:organisation-1",
      expect.any(AbortSignal),
    );
  });

  it("sends an account without a professional workspace to onboarding", async () => {
    mocks.pathname = "/professional/enquiries";
    mocks.search = "";
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
    mocks.currentWorkspace.mockResolvedValue({
      id: "client:profile-1",
      kind: "client",
      label: "Personal account",
    });
    mocks.listWorkspaces.mockResolvedValue([
      {
        id: "client:profile-1",
        kind: "client",
        label: "Personal account",
        href: "/client",
      },
    ]);

    render(
      <AuthenticatedShell kind="professional" hideIntro>
        <section>Professional enquiries</section>
      </AuthenticatedShell>,
    );

    await waitFor(() => {
      expect(mocks.router.replace).toHaveBeenCalledWith(
        "/professional/onboarding",
      );
    });
    expect(mocks.router.replace).not.toHaveBeenCalledWith("/workspace/select");
  });
});
