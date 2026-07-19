import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn(() => ({
  data: null as null | { user: { name: string; email: string } },
  isPending: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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
    expect(
      screen.getAllByRole("link", { name: "Become a Professional" })[0],
    ).toHaveAttribute("href", "/become-a-professional");
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

  it("shows utility destinations when signed in", () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: "Alex Rivera", email: "alex@example.com" },
      },
      isPending: false,
    });

    render(<SiteHeader />);

    expect(screen.getAllByRole("link", { name: "Messages" })[0]).toHaveAttribute(
      "href",
      "/messages",
    );
    expect(
      screen.getAllByRole("link", { name: "Saved professionals" })[0],
    ).toHaveAttribute("href", "/saved");
    expect(screen.getAllByRole("link", { name: "Notifications" })[0]).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("opens an accessible mobile navigation sheet", () => {
    render(<SiteHeader />);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    expect(screen.getByRole("dialog", { name: "Veterans Bay" })).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeVisible();
  });

  it("submits service searches to the marketplace route", () => {
    render(<SiteHeader />);

    const search = screen.getAllByRole("search")[0];
    expect(search).toHaveAttribute("action", "/marketplace");
    expect(screen.getAllByLabelText("Search services")[0]).toHaveAttribute(
      "name",
      "query",
    );
  });
});
