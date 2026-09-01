import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PublicProfessionalProfile,
  PublicServiceDetail,
} from "@/modules/professional-services/types";

import { PublicProfessionalPage, PublicServicePage } from "./public-catalogue-pages";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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
    window.history.replaceState(null, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) } as Response),
    );
  });

  it("renders an authoritative custom-quotation service without a numeric total", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: service }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<PublicServicePage slug={service.slug} />);
    expect(await screen.findByRole("heading", { name: service.name })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Check availability" })).toHaveAttribute(
      "href",
      expect.stringContaining("/client/requests/new"),
    );
    expect(screen.getAllByRole("link", { name: "Book Now" })[0]).toHaveClass(
      "border-0",
      "shadow-none",
      "ring-0",
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
    expect(screen.getAllByText("Select service")).toHaveLength(2);
    expect(screen.getAllByText("Confirm & pay")).toHaveLength(2);

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
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<PublicServicePage slug={service.slug} />);

    expect(
      await screen.findByRole("link", { name: "Book this service" }),
    ).toHaveAttribute(
      "href",
      "/client/bookings/new?professionalSlug=digital-qatalyst&serviceSlug=custom-home-repair&serviceName=Custom%20home%20repair&providerName=Digital%20Qatalyst",
    );
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
