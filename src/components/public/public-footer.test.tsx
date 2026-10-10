import { render, screen, within } from "@testing-library/react";
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

  it("links only to working destinations without grouped columns", () => {
    render(<PublicFooter />);

    const footer = screen.getByRole("navigation", {
      name: "Footer",
    });
    expect(
      within(footer).getByRole("link", { name: "Find Services" }),
    ).toHaveAttribute("href", "/marketplace");
    expect(
      within(footer).getByRole("link", { name: "How It Works" }),
    ).toHaveAttribute("href", "/how-it-works");
    expect(
      within(footer).getByRole("link", { name: "Become a Professional" }),
    ).toHaveAttribute("href", "/become-a-professional");
    expect(
      within(footer).getByRole("link", { name: "About Us" }),
    ).toHaveAttribute("href", "/about");
    expect(within(footer).getAllByRole("link")).toHaveLength(4);

    expect(
      screen.queryByRole("navigation", { name: "Footer Explore links" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer Support links" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer Company links" }),
    ).not.toBeInTheDocument();
    for (const name of [
      "For Businesses",
      "Service Categories",
      "Help Center",
      "Safety & Trust",
      "Pricing & Fees",
      "Cancellation Policy",
      "Contact Support",
      "About Veterans Bay",
      "Our Mission",
      "Careers",
      "Press & Media",
      "Partners",
      "Facebook",
      "Instagram",
      "LinkedIn",
      "YouTube",
    ]) {
      expect(
        screen.queryByRole("link", { name }),
      ).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("img", { name: "Facebook" }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Contact Us" })).toHaveAttribute(
      "href",
      "/support",
    );
    expect(screen.getByText("Background Verified")).toBeInTheDocument();
    expect(screen.getByText("Rated & Reviewed")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "/terms");
  });

  it("keeps the public marketplace footer for signed-out visitors", () => {
    render(<PublicFooter marketplace />);

    expect(
      screen.getByRole("navigation", { name: "Footer" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Us" })).toBeInTheDocument();
  });

  it("uses the compact workspace footer on the marketplace when signed in", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "user-1" } },
      isPending: false,
    });

    render(<PublicFooter marketplace />);

    expect(screen.getByText("You're protected. We've got your back.")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Contact Us" }),
    ).not.toBeInTheDocument();
  });

  it("does not flash the public marketplace footer while the session resolves", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: true });

    render(<PublicFooter marketplace />);

    expect(screen.getByTestId("marketplace-footer-loading")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Footer" }),
    ).not.toBeInTheDocument();
  });
});
