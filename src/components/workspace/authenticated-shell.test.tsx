import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticatedShell } from "./authenticated-shell";

const mocks = vi.hoisted(() => ({
  pathname: "/client/bookings/new",
  replace: vi.fn(),
  search: "service=plumbing",
  session: null as { user: { id: string } } | null,
  sessionPending: true,
  listWorkspaces: vi.fn(),
  selectWorkspace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
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
  getCachedResource: () => "Client workspace",
  setCachedResource: vi.fn(),
}));

vi.mock("@/lib/workspace-entry", () => ({
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
    mocks.listWorkspaces.mockReset();
    mocks.selectWorkspace.mockReset();
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
  });

  it("preserves the protected path and query when sign in is required", async () => {
    mocks.sessionPending = false;
    window.history.replaceState({}, "", `/?${mocks.search}`);

    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Protected booking form</section>
      </AuthenticatedShell>,
    );

    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?redirect=%2Fclient%2Fbookings%2Fnew%3Fservice%3Dplumbing",
    );
  });

  it("sends an account without a professional workspace to onboarding", async () => {
    mocks.pathname = "/professional/enquiries";
    mocks.search = "";
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
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
      expect(mocks.replace).toHaveBeenCalledWith("/professional/onboarding");
    });
    expect(mocks.replace).not.toHaveBeenCalledWith("/workspace/select");
  });
});
