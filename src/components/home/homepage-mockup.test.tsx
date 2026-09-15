import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  session: { user: { id: "user-1", name: "Alex" } } as object | null,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: mocks.session, isPending: false }),
  },
}));

import { HomepageMockup } from "./homepage-mockup";

describe("HomepageMockup role routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { user: { id: "user-1", name: "Alex" } };
  });

  it("opens the homepage for the signed-in user's selected professional role", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "organisation:org-1",
            kind: "organisation",
            href: "/professional",
          },
        }),
      }),
    );

    render(<HomepageMockup />);

    expect(screen.getByText("Opening your workspace")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Find Trusted Home Service Professionals.",
      }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/professional"));
  });

  it("enters the primary workspace when no current workspace can be resolved", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: { code: "WORKSPACE_REQUIRED" } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              id: "client:profile-1",
              kind: "client",
              href: "/client",
            },
          }),
        }),
    );

    render(<HomepageMockup />);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/client"));
  });

  it("uses the focused guest navigation on the public landing page", () => {
    mocks.session = null;

    render(<HomepageMockup />);

    const guestNavigation = screen.getByRole("navigation", { name: "Guest navigation" });
    expect(guestNavigation).toBeInTheDocument();
    expect(within(guestNavigation).getByRole("link", { name: "How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(within(guestNavigation).getByRole("link", { name: "Log In" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByRole("link", { name: "Contact support" })).not.toBeInTheDocument();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Featured professional Amina K\. Electricals/i }),
    ).toHaveAttribute("href", "/professionals/amina-k-electricals");
    expect(screen.getByRole("heading", { name: "Popular Services" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Run every job from one place." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Grow your business" })).toHaveAttribute(
      "href",
      "/become-a-professional",
    );
    expect(
      screen.getByAltText("Professional managing work with Veterans Bay"),
    ).toHaveAttribute("src", expect.stringContaining("featured-professional.png"));
    expect(
      screen.queryByRole("heading", { name: "Popular Categories" }),
    ).not.toBeInTheDocument();
  });
});
