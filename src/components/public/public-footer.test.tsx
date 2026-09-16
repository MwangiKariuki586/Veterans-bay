import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn(() => ({
  data: null as null | { user: { id: string } },
  isPending: false,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
  },
}));

import { PublicFooter } from "./public-footer";

describe("public footer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({ data: null, isPending: false });
  });

  it("renders explore support company and trust content", () => {
    render(<PublicFooter />);

    expect(
      screen.getByRole("navigation", { name: "Footer Explore links" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer Support links" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer Company links" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Support" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByText("Background Verified")).toBeInTheDocument();
    expect(screen.getByText("Rated & Reviewed")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
  });

  it("keeps the public marketplace footer for signed-out visitors", () => {
    render(<PublicFooter marketplace />);

    expect(
      screen.getByRole("navigation", { name: "Footer Explore links" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Support" })).toBeInTheDocument();
  });

  it("uses the compact workspace footer on the marketplace when signed in", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });

    render(<PublicFooter marketplace />);

    expect(screen.getByText("You're protected. We've got your back.")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer Explore links" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Contact Support" }),
    ).not.toBeInTheDocument();
  });

  it("does not flash the public marketplace footer while the session resolves", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });

    render(<PublicFooter marketplace />);

    expect(screen.getByTestId("marketplace-footer-loading")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer Explore links" }),
    ).not.toBeInTheDocument();
  });
});
