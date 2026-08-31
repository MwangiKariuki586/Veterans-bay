import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn(() => ({
  data: null as null | { user: { name: string; email: string } },
  isPending: false,
}));
const usePathnameMock = vi.fn(() => "/services/leak-repair");

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
    signOut: vi.fn(),
  },
}));

import { SiteHeader } from "./site-header";

describe("site header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    usePathnameMock.mockReturnValue("/services/leak-repair");
  });

  it("shows guest marketing destinations when signed out", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Veterans Bay home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link", { name: "How It Works" })[0]).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    const professionalLink = screen.getAllByRole("link", {
      name: "Become a Professional",
    })[0];
    expect(professionalLink).toHaveAttribute("href", "/become-a-professional");
    expect(professionalLink).toHaveClass(
      "text-sm",
      "font-semibold",
      "text-foreground",
      "transition-colors",
      "hover:text-[#5f7f00]",
    );
    expect(professionalLink).not.toHaveClass("rounded-full", "border-black/8");
    expect(screen.getAllByRole("link", { name: "Log In" })[0]).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getAllByRole("link", { name: "Find Services" })[0]).toHaveAttribute(
      "href",
      "/marketplace",
    );
    expect(screen.queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
  });

  it("removes self-referencing marketing actions from destination pages", () => {
    usePathnameMock.mockReturnValue("/become-a-professional");
    const { rerender } = render(<SiteHeader variant="marketing" />);

    expect(
      screen.queryByRole("link", { name: "Become a Professional" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Find Services" })).toHaveLength(2);

    usePathnameMock.mockReturnValue("/marketplace");
    rerender(<SiteHeader variant="marketing" marketplace />);

    expect(
      screen.queryByRole("link", { name: "Find Services" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("search")).toHaveLength(2);
  });

  it("shows dashboard utilities instead of client-only links on signed-in public pages", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Alex Rivera", email: "alex@example.com" },
      },
      isPending: false,
    });

    render(<SiteHeader />);

    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/workspace/select");
    expect(dashboardLink).toHaveClass(
      "text-sm",
      "font-semibold",
      "transition-colors",
      "hover:text-[#5f7f00]",
    );
    expect(dashboardLink).not.toHaveClass("rounded-full", "border-black/8");
    expect(screen.queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Saved professionals" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Notifications" })[0]).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("provides the complete account menu", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Alex Rivera", email: "alex@example.com" },
      },
      isPending: false,
    });

    render(<SiteHeader variant="marketing" />);
    const accountTrigger = screen.getByRole("button", {
      name: /Welcome,\s*Alex/i,
    });
    accountTrigger.focus();
    fireEvent.keyDown(accountTrigger, { key: "Enter" });
    const accountMenu = screen.getByRole("menu");

    expect(within(accountMenu).getByRole("menuitem", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/workspace/select",
    );
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Switch workspace" }),
    ).toHaveAttribute("href", "/workspace/select");
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Account settings" }),
    ).toHaveAttribute("href", "/account/profile");
    expect(
      within(accountMenu).getByRole("menuitem", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("uses client destinations on desktop and in the mobile sheet", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Alex Rivera", email: "alex@example.com" },
      },
      isPending: false,
    });

    render(
      <SiteHeader
        variant="workspace"
        workspaceContext={{ kind: "client", label: "Alex" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/messages",
    );
    expect(screen.getByRole("link", { name: "Saved professionals" })).toHaveAttribute(
      "href",
      "/client/saved",
    );
    expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/client",
    );
  });

  it("uses professional destinations on desktop and in the mobile sheet", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Grace Wanjiku", email: "grace@example.com" },
      },
      isPending: false,
    });

    render(
      <SiteHeader
        variant="workspace"
        workspaceContext={{ kind: "professional", label: "Sparkle Clean" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/messages",
    );
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute(
      "href",
      "/professional/calendar",
    );
    expect(
      screen.queryByRole("link", { name: "Saved professionals" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/professional",
    );
  });

  it("does not expose client or professional shortcuts in the admin header", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Platform Admin", email: "admin@example.com" },
      },
      isPending: false,
    });

    render(
      <SiteHeader
        variant="workspace"
        workspaceContext={{ kind: "admin", label: "Administration" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.queryByRole("link", { name: "Messages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Calendar" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Saved professionals" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("opens an accessible mobile navigation sheet", () => {
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("dialog", { name: "Veterans Bay" })).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  });

  it("does not expose guest destinations while the session is resolving", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });

    render(<SiteHeader variant="marketing" />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading account navigation…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Log In" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Become a Professional" }),
    ).not.toBeInTheDocument();
  });

  it("submits service searches to the marketplace route", () => {
    render(<SiteHeader />);

    const search = screen.getAllByRole("search")[0];
    expect(search).toHaveAttribute("action", "/marketplace");
    expect(screen.getAllByLabelText("Search services")[0]).toHaveAttribute(
      "name",
      "q",
    );
  });
});
