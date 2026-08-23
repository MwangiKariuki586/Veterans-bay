import { describe, expect, it, vi } from "vitest";

import type {
  PublicCatalogueStore,
  PublicProfessionalRecord,
  PublicServiceRecord,
} from "./public-repository";
import { PublicCatalogueService } from "./public-service";

const professional: PublicProfessionalRecord = {
  organisationId: "organisation-1",
  slug: "digital-qatalyst",
  businessName: "Digital Qatalyst",
  description: "Trusted household repairs.",
  primaryCategory: "Plumbing",
  operatingLocation: "Nairobi, Kenya",
  serviceAreas: ["Westlands"],
  workingHours: {
    monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
    sunday: { enabled: false, opensAt: "08:00", closesAt: "17:00" },
  },
  verificationStatus: "verified",
  logoPublicId: "veterans-bay/logos/logo-1",
};

function service(overrides: Partial<PublicServiceRecord> = {}): PublicServiceRecord {
  return {
    id: "service-1",
    organisationId: "organisation-1",
    slug: "plumbing-inspection-12345678",
    name: "Plumbing inspection",
    category: "Plumbing",
    description: "A complete inspection of household plumbing fixtures.",
    fulfilmentModel: "on_site",
    pricingModel: "fixed",
    priceMinor: 5_000,
    currency: "KES",
    estimatedDurationMinutes: 90,
    serviceAreas: ["Westlands"],
    requirements: ["Provide property access"],
    warrantyDurationDays: 30,
    warrantyTerms: "Workmanship issues are covered.",
    directBookingEnabled: true,
    status: "published",
    moderationStatus: "clear",
    moderationReason: null,
    moderatedByAccountId: null,
    moderatedAt: null,
    version: 2,
    publishedAt: new Date("2026-07-22T18:00:00.000Z"),
    createdAt: new Date("2026-07-22T17:00:00.000Z"),
    updatedAt: new Date("2026-07-22T18:00:00.000Z"),
    ...overrides,
  };
}

function store(): PublicCatalogueStore {
  return {
    findProfessionalBySlug: vi.fn().mockResolvedValue(professional),
    findServiceBySlug: vi.fn().mockResolvedValue({ professional, service: service() }),
    listServices: vi.fn().mockResolvedValue([service()]),
    listPortfolio: vi.fn().mockResolvedValue([]),
    listServiceImages: vi.fn().mockResolvedValue([
      { id: "image-1", publicId: "veterans-bay/services/service-1" },
    ]),
  };
}

describe("PublicCatalogueService", () => {
  it("returns a public service projection without private or internal fields", async () => {
    const result = await new PublicCatalogueService(store(), "demo-cloud").getService(
      "plumbing-inspection-12345678",
    );

    expect(result).toMatchObject({
      slug: "plumbing-inspection-12345678",
      priceMinor: 5_000,
      provider: {
        slug: "digital-qatalyst",
        businessName: "Digital Qatalyst",
        verified: true,
      },
      images: [
        "https://res.cloudinary.com/demo-cloud/image/upload/veterans-bay/services/service-1",
      ],
    });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("organisationId");
    expect(result).not.toHaveProperty("version");
    expect(result.provider).not.toHaveProperty("email");
    expect(result.provider).not.toHaveProperty("phone");
    expect(result.provider).not.toHaveProperty("verificationStatus");
    expect(result.provider).not.toHaveProperty("verificationReference");
  });

  it("does not expose a misleading price for custom quotations", async () => {
    const repository = store();
    vi.mocked(repository.findServiceBySlug).mockResolvedValue({
      professional,
      service: service({ pricingModel: "custom_quote", priceMinor: 99_999 }),
    });
    await expect(new PublicCatalogueService(repository).getService("custom"))
      .resolves.toMatchObject({ pricingModel: "custom_quote", priceMinor: null });
  });

  it("returns an unavailable contract when a public record is absent or incomplete", async () => {
    const missing = store();
    vi.mocked(missing.findServiceBySlug).mockResolvedValue(null);
    await expect(new PublicCatalogueService(missing).getService("missing"))
      .rejects.toMatchObject({ code: "PUBLIC_LISTING_UNAVAILABLE", status: 404 });

    const incomplete = store();
    vi.mocked(incomplete.findServiceBySlug).mockResolvedValue({
      professional,
      service: service({ description: null }),
    });
    await expect(new PublicCatalogueService(incomplete).getService("incomplete"))
      .rejects.toMatchObject({ code: "PUBLIC_LISTING_UNAVAILABLE" });
  });

  it("builds a professional profile from published complete services only", async () => {
    const repository = store();
    vi.mocked(repository.listServices).mockResolvedValue([
      service(),
      service({ id: "incomplete", slug: "incomplete", category: null }),
    ]);
    const result = await new PublicCatalogueService(repository, "demo-cloud")
      .getProfessional("digital-qatalyst");

    expect(result).toMatchObject({
      businessName: "Digital Qatalyst",
      categories: ["Plumbing"],
      availabilitySummary: "Available Mon",
      rating: null,
      reviewCount: 0,
      completedJobs: 0,
    });
    expect(result.services).toHaveLength(1);
    expect(result).not.toHaveProperty("verificationReference");
  });

  it("keeps review totals consistent when the reputation projection is missing", async () => {
    const repository: PublicCatalogueStore = {
      ...store(),
      getReputation: vi.fn().mockResolvedValue(null),
      listReviews: vi.fn().mockResolvedValue([
        {
          id: "review-1",
          clientName: "Amina",
          overallRating: 5,
          feedback: "Excellent work.",
          submittedAt: new Date("2026-08-20T08:00:00.000Z"),
          responseBody: null,
          responseCreatedAt: null,
        },
        {
          id: "review-2",
          clientName: "John",
          overallRating: 4,
          feedback: "Good service.",
          submittedAt: new Date("2026-08-19T08:00:00.000Z"),
          responseBody: null,
          responseCreatedAt: null,
        },
      ]),
    };

    await expect(
      new PublicCatalogueService(repository).getProfessional("digital-qatalyst"),
    ).resolves.toMatchObject({
      rating: 4.5,
      reviewCount: 2,
      reviews: [{ overallRating: 5 }, { overallRating: 4 }],
    });
  });

  it("projects the earliest real slot across eligible direct-booking services", async () => {
    const repository = store();
    vi.mocked(repository.listServices).mockResolvedValue([
      service({ id: "short", estimatedDurationMinutes: 60 }),
      service({ id: "long", estimatedDurationMinutes: 120 }),
      service({
        id: "quote-only",
        directBookingEnabled: false,
        estimatedDurationMinutes: 30,
      }),
    ]);
    const availabilityStore = {
      slotInputsByOrganisation: vi.fn().mockResolvedValue(
        new Map([
          [
            professional.organisationId,
            {
              rules: [
                {
                  membershipId: "member-1",
                  memberName: "Alex Plumber",
                  weekday: 1,
                  startMinute: 9 * 60,
                  endMinute: 17 * 60,
                  timezone: "Africa/Nairobi",
                },
              ],
              blocks: [],
              reservations: [],
            },
          ],
        ]),
      ),
    };

    const result = await new PublicCatalogueService(
      repository,
      undefined,
      availabilityStore,
      () => new Date("2026-08-24T06:00:00.000Z"),
    ).getProfessional("digital-qatalyst");

    expect(result.nextAvailableSlot).toEqual({
      startsAt: "2026-08-24T06:30:00.000Z",
      timezone: "Africa/Nairobi",
    });
    expect(availabilityStore.slotInputsByOrganisation).toHaveBeenCalledWith({
      organisationIds: [professional.organisationId],
      from: new Date("2026-08-24T06:00:00.000Z"),
      to: new Date("2026-09-07T06:00:00.000Z"),
    });
  });

  it("projects one dated opening time when booking rules have not been configured", async () => {
    const repository = store();
    vi.mocked(repository.listServices).mockResolvedValue([
      service({
        directBookingEnabled: false,
        estimatedDurationMinutes: null,
      }),
    ]);
    const availabilityStore = {
      slotInputsByOrganisation: vi.fn().mockResolvedValue(
        new Map([
          [
            professional.organisationId,
            { rules: [], blocks: [], reservations: [] },
          ],
        ]),
      ),
    };

    const result = await new PublicCatalogueService(
      repository,
      undefined,
      availabilityStore,
      () => new Date("2026-08-23T12:00:00.000Z"),
    ).getProfessional("digital-qatalyst");

    expect(result.nextAvailableSlot).toEqual({
      startsAt: "2026-08-24T05:00:00.000Z",
      timezone: "Africa/Nairobi",
    });
  });

  it("orders availability consistently from Monday through Sunday", async () => {
    const repository = store();
    vi.mocked(repository.findProfessionalBySlug).mockResolvedValue({
      ...professional,
      workingHours: {
        friday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
        monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
        sunday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
        wednesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      },
    });

    await expect(
      new PublicCatalogueService(repository).getProfessional("digital-qatalyst"),
    ).resolves.toMatchObject({
      availabilitySummary: "Available Mon, Wed, Fri, Sun",
    });
  });
});
