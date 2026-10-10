import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn(() => ({
  data: null as null | { user: { id: string } },
  isPending: false,
}));
const usePathnameMock = vi.fn(() => "/");

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
  },
}));

import AboutPage from "./about/page";
import CancellationPage from "./cancellation/page";
import HowItWorksPage from "./how-it-works/page";
import PricingPage from "./pricing/page";
import SafetyPage from "./safety/page";

describe.each([
  ["about", AboutPage],
  ["how it works", HowItWorksPage],
  ["safety", SafetyPage],
  ["pricing", PricingPage],
  ["cancellation", CancellationPage],
] as const)("public info page %s", (_name, Page) => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    usePathnameMock.mockReturnValue("/");
  });

  it("renders real content without stub or placeholder links", () => {
    render(<Page />);

    expect(
      screen.queryByText("This destination is not available yet"),
    ).not.toBeInTheDocument();

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("#");
      expect(href).not.toBe("");
      expect(href.startsWith("/help")).toBe(false);
      expect(href.startsWith("/contact")).toBe(false);
    }
  });
});

describe("public info pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    usePathnameMock.mockReturnValue("/");
  });

  it("explains the service journey with working destinations", () => {
    render(<HowItWorksPage />);

    const main = within(screen.getByRole("main"));
    expect(
      main.getByRole("heading", { name: "One connected service journey." }),
    ).toBeInTheDocument();
    expect(
      main.getByRole("link", { name: /browse the marketplace/i }),
    ).toHaveAttribute("href", "/marketplace");
    expect(
      main.getByRole("link", { name: "Become a Professional" }),
    ).toHaveAttribute("href", "/become-a-professional");
  });

  it("publishes an honest about page with working destinations", () => {
    render(<AboutPage />);

    const main = within(screen.getByRole("main"));
    expect(
      main.getByRole("heading", { name: "Home services you can trust." }),
    ).toBeInTheDocument();
    expect(
      main.getByRole("link", { name: "Become a Professional" }),
    ).toHaveAttribute("href", "/become-a-professional");
  });

  it("publishes safety, pricing, and cancellation guidance", () => {
    render(<SafetyPage />);
    expect(
      screen.getByRole("heading", { name: "Safety and trust standards" }),
    ).toBeInTheDocument();
  });

  it("publishes pricing guidance", () => {
    render(<PricingPage />);
    expect(
      screen.getByRole("heading", { name: "Pricing and fees" }),
    ).toBeInTheDocument();
  });

  it("publishes changes and cancellation guidance", () => {
    render(<CancellationPage />);
    expect(
      screen.getByRole("heading", { name: "Changes and cancellation" }),
    ).toBeInTheDocument();
  });
});
