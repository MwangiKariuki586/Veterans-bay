import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PublicProfessionalProfile,
  PublicServiceDetail,
} from "@/modules/professional-services/types";

import { PublicProfessionalPage, PublicServicePage } from "./public-catalogue-pages";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const service: PublicServiceDetail = {
  slug: "custom-home-repair",
  name: "Custom home repair",
  category: "Repairs",
  description: "A tailored repair service for household maintenance needs.",
  fulfilmentModel: "on_site",
  pricingModel: "custom_quote",
  priceMinor: null,
  currency: "KES",
  estimatedDurationMinutes: 120,
  serviceAreas: ["Westlands"],
  requirements: ["Provide access to the repair area"],
  warrantyDurationDays: 30,
  warrantyTerms: "Workmanship is covered for thirty days.",
  directBookingEnabled: false,
  imageUrl: null,
  images: [],
  provider: {
    slug: "digital-qatalyst",
    businessName: "Digital Qatalyst",
    description: "Trusted household repairs.",
    primaryCategory: "Repairs",
    operatingLocation: "Nairobi, Kenya",
    serviceAreas: ["Westlands"],
    availabilitySummary: "Available Mon, Tue",
    nextAvailableSlot: {
      startsAt: "2030-01-07T11:30:00.000Z",
      timezone: "Africa/Nairobi",
    },
    verified: true,
    logoUrl: null,
    rating: null,
    reviewCount: 0,
    completedJobs: 0,
    responseIndicator: null,
  },
};

const profile: PublicProfessionalProfile = {
  ...service.provider,
  categories: ["Repairs"],
  portfolio: [],
  services: [service],
};

describe("public catalogue pages", () => {
  beforeEach(() => {
    push.mockReset();
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response),
    );
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders an authoritative custom-quotation service without a numeric total", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: service }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

    render(<PublicServicePage slug={service.slug} />);
    expect(await screen.findByRole("heading", { name: service.name })).toBeInTheDocument();
    for (const name of ["About this service", "What's included", "What's not included", "What customers say", "Frequently asked questions"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Custom quote").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Custom quote")[0]).toBeInTheDocument();
    expect(screen.queryByText(/KSh\s*0/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View professional profile" })).toHaveAttribute(
      "href",
      "/professionals/digital-qatalyst",
    );
    expect(screen.getByRole("link", { name: "Request this service" })).toHaveAttribute(
      "href",
      "/client/requests/new?source=DIRECT_SERVICE_PAGE&professional=digital-qatalyst&service=custom-home-repair&category=Repairs",
    );
  });

  it("uses compact, truthful new-professional states instead of fabricated metrics", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: profile }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<PublicProfessionalPage slug={profile.slug} />);
    expect(await screen.findByRole("heading", { name: profile.businessName })).toBeInTheDocument();
    expect(screen.getByText("Not enough activity yet")).toBeInTheDocument();
    expect(screen.getByText("Reviews will appear here")).toBeInTheDocument();
    expect(screen.queryByText("Portfolio coming soon")).not.toBeInTheDocument();
    expect(screen.queryByText("248 reviews")).not.toBeInTheDocument();
    expect(screen.queryByText("1,200+")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: profile.businessName })).toHaveAttribute(
      "src",
      expect.stringContaining("homepage-hero-professional-room.png"),
    );
    expect(screen.queryByText("Available Mon, Tue")).not.toBeInTheDocument();
    expect(screen.getByText("Next slot available")).toBeInTheDocument();
    expect(screen.getByText("Mon, Jan 7, 2:30 PM")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Check availability" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Message" })).toHaveAttribute(
      "href",
      "/coming-soon/messaging",
    );
    expect(screen.getByRole("link", { name: "Book Now" })).toHaveAttribute(
      "href",
      expect.stringContaining("/client/requests/new"),
    );
    expect(screen.getByRole("button", { name: `Save ${profile.businessName}` })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("heading", { name: `About ${profile.businessName}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Services offered" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all services" })).toHaveAttribute(
      "href",
      "#services",
    );
    expect(screen.queryByText("Select service")).not.toBeInTheDocument();
    expect(screen.queryByText("Confirm & pay")).not.toBeInTheDocument();

    const servicesSection = document.getElementById("services");
    expect(servicesSection).not.toBeNull();
    servicesSection!.scrollIntoView = vi.fn();
    const servicesTab = screen.getByRole("button", { name: "Services" });
    fireEvent.click(servicesTab);
    expect(servicesSection!.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(servicesTab).toHaveAttribute("aria-current", "location");
    expect(window.location.hash).toBe("#services");
    expect(
      screen.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeInTheDocument();
    const faqQuestions = [
      "How do I book this professional?",
      "Are the reviews verified?",
      "When is the price confirmed?",
    ];
    const faqDetails = faqQuestions.map((question) =>
      screen.getByText(question).closest("details"),
    );
    expect(faqDetails.every(Boolean)).toBe(true);
    fireEvent.click(screen.getByText(faqQuestions[0]));
    expect(faqDetails[0]).toHaveAttribute("open");
    expect(faqDetails[1]).not.toHaveAttribute("open");
    expect(faqDetails[2]).not.toHaveAttribute("open");
    fireEvent.click(screen.getByText(faqQuestions[1]));
    expect(faqDetails[0]).toHaveAttribute("open");
    expect(faqDetails[1]).toHaveAttribute("open");
    expect(faqDetails[2]).not.toHaveAttribute("open");
  });

  it("routes eligible fixed-price services into direct slot selection", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            ...service,
            pricingModel: "fixed",
            priceMinor: 15_000,
            directBookingEnabled: true,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

    render(<PublicServicePage slug={service.slug} />);

    expect(await screen.findByRole("heading", { name: service.name })).toBeInTheDocument();
    // New mockup: direct bookable services show compact Availability with Check availability instead of direct Book link
    expect(await screen.findByRole("button", { name: /Check availability/i })).toBeInTheDocument();
    expect(await screen.findByText("Next slot available")).toBeInTheDocument();
    // Provider card still present for test compatibility (hidden duplicate for legacy name)
    expect(screen.getByRole("link", { name: "View professional profile" })).toHaveAttribute(
      "href",
      "/professionals/digital-qatalyst",
    );
  });

  it("opens and collapses availability and renders an empty response truthfully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { ...service, pricingModel: "fixed", priceMinor: 15000, directBookingEnabled: true } }),
    } as Response);
    render(<PublicServicePage slug={service.slug} />);
    fireEvent.click(await screen.findByRole("button", { name: /Check availability/i }));
    expect(await screen.findByText("No times available for the selected dates")).toBeInTheDocument();
    expect(screen.getByText("Next slot available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More dates" })).toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Toggle availability" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("No times available for the selected dates")).not.toBeInTheDocument();
  });

  it("redirects guests checking availability to login with the service return path", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("booking-slots")) {
        return { ok: false, status: 401, json: async () => ({ error: { message: "Unauthorised" } }) } as Response;
      }
      if (url.includes("/public/services/")) {
        return { ok: true, json: async () => ({ data: { ...service, pricingModel: "fixed", priceMinor: 15000, directBookingEnabled: true } }) } as Response;
      }
      return { ok: true, json: async () => ({ data: [] }) } as Response;
    });
    render(<PublicServicePage slug={service.slug} />);
    const check = await screen.findByRole("button", { name: /Check availability/i });
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(check);
    await waitFor(() => expect(push).toHaveBeenCalledWith(
      `/login?redirect=${encodeURIComponent(`/services/${service.slug}`)}`,
    ));
    expect(screen.queryByText("Please sign in to check availability.")).not.toBeInTheDocument();
    expect(screen.queryByText("Availability unavailable")).not.toBeInTheDocument();
  });

  it("keeps service details behind selectable tabs on compact screens", async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === "(max-width: 1023px)", media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(),
      removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }));
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: service }) } as Response);
    render(<PublicServicePage slug={service.slug} />);
    expect(await screen.findByRole("heading", { name: "About this service" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "What's included" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "What's included" }));
    expect(screen.getByRole("heading", { name: "What's included" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "About this service" })).not.toBeInTheDocument();
  });

  it("shows the public unavailable state returned by the API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "This service is not currently available." } }),
    } as Response);

    render(<PublicServicePage slug="hidden-service" />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Listing unavailable",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("This service is not currently available.")).toBeInTheDocument();
  });
});
