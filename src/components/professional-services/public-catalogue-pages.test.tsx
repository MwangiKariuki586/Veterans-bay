import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PublicProfessionalProfile,
  PublicServiceDetail,
} from "@/modules/professional-services/types";

import { PublicProfessionalPage, PublicServicePage } from "./public-catalogue-pages";

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
    vi.stubGlobal("fetch", vi.fn());
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
    expect(screen.getByText("Custom quote")).toBeInTheDocument();
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

  it("uses explicit new-professional states instead of fabricated metrics", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: profile }),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<PublicProfessionalPage slug={profile.slug} />);
    expect(await screen.findByRole("heading", { name: profile.businessName })).toBeInTheDocument();
    expect(screen.getByText("No verified reviews yet")).toBeInTheDocument();
    expect(screen.getByText("Not enough activity yet")).toBeInTheDocument();
    expect(screen.getByText("Portfolio coming soon")).toBeInTheDocument();
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
