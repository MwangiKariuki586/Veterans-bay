import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedShell } from "./authenticated-shell";

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
