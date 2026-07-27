import { describe, expect, it, vi } from "vitest";

import type {
  ProfessionalServiceRecord,
  ProfessionalServicesStore,
} from "./repository";
import { createProfessionalServiceBodySchema } from "./schemas";
import { ProfessionalServicesService } from "./service";

function record(overrides: Partial<ProfessionalServiceRecord> = {}): ProfessionalServiceRecord {
  return {
    id: "service-1",
    organisationId: "organisation-1",
    slug: "plumbing-inspection-12345678",
    name: "Plumbing inspection",
    category: "Plumbing",
    description: null,
    fulfilmentModel: null,
    pricingModel: null,
    priceMinor: null,
    currency: "KES",
    estimatedDurationMinutes: null,
    serviceAreas: [],
    requirements: [],
    warrantyDurationDays: null,
    warrantyTerms: null,
    directBookingEnabled: false,
    status: "draft",
    moderationStatus: "clear",
    moderationReason: null,
    moderatedByAccountId: null,
    moderatedAt: null,
    version: 1,
    publishedAt: null,
    createdAt: new Date("2026-07-22T18:00:00.000Z"),
    updatedAt: new Date("2026-07-22T18:00:00.000Z"),
    ...overrides,
  };
}

function store(status = "active"): ProfessionalServicesStore {
  return {
    getOrganisationStatus: vi.fn().mockResolvedValue(status),
    isActiveCategory: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(record()),
    createDraft: vi.fn().mockResolvedValue(record()),
    update: vi.fn().mockResolvedValue(record({ version: 2 })),
    publish: vi.fn().mockResolvedValue(record({ status: "published", version: 2 })),
    unpublish: vi.fn().mockResolvedValue(record({ status: "unpublished", version: 2 })),
    getManagedProfile: vi.fn().mockResolvedValue(null),
    updateManagedProfile: vi.fn().mockResolvedValue(null),
    attachLogo: vi.fn().mockResolvedValue(undefined),
    listPortfolio: vi.fn().mockResolvedValue([]),
    addPortfolioItem: vi.fn(),
    removePortfolioItem: vi.fn(),
    listServiceImages: vi.fn().mockResolvedValue([]),
    addServiceImage: vi.fn(),
    removeServiceImage: vi.fn(),
  };
}

describe("ProfessionalServicesService", () => {
  it("creates a private draft for an active approved organisation", async () => {
    const repository = store();
    const service = new ProfessionalServicesService(repository);

    await expect(
      service.createDraft({
        organisationId: "organisation-1",
        actorAccountId: "account-1",
        values: { name: "Plumbing inspection", currency: "KES" },
        correlationId: "request-1",
      }),
    ).resolves.toMatchObject({ name: "Plumbing inspection", status: "draft" });
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "organisation-1",
        actorAccountId: "account-1",
        slug: expect.stringMatching(/^plumbing-inspection-[0-9a-f]{8}$/),
      }),
    );
  });

  it("blocks service creation for an organisation that is not active", async () => {
    const repository = store("suspended");
    await expect(
      new ProfessionalServicesService(repository).createDraft({
        organisationId: "organisation-1",
        actorAccountId: "account-1",
        values: { name: "Plumbing inspection", currency: "KES" },
      }),
    ).rejects.toMatchObject({ code: "ORGANISATION_NOT_ELIGIBLE" });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it("reports the fields required before publication", async () => {
    const repository = store();
    vi.mocked(repository.get).mockResolvedValue(record({ category: null }));
    const service = new ProfessionalServicesService(repository);

    await expect(service.publish({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
    })).rejects.toMatchObject({
      code: "SERVICE_NOT_READY",
      issues: expect.arrayContaining([
        { code: "required", path: "category" },
        { code: "required", path: "description" },
        { code: "required", path: "fulfilmentModel" },
        { code: "required", path: "pricingModel" },
      ]),
    });
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("publishes a complete service for an active organisation", async () => {
    const repository = store();
    vi.mocked(repository.get).mockResolvedValue(record({
      category: "Plumbing",
      description: "A complete inspection of household plumbing fixtures.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 5_000,
    }));

    await expect(new ProfessionalServicesService(repository).publish({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
    })).resolves.toMatchObject({ status: "published", version: 2 });
    expect(repository.publish).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1 }));
  });

  it("blocks publication into an inactive marketplace category", async () => {
    const repository = store();
    vi.mocked(repository.get).mockResolvedValue(
      record({
        category: "Retired category",
        description: "A complete service description for policy validation.",
        fulfilmentModel: "on_site",
        pricingModel: "fixed",
        priceMinor: 5_000,
      }),
    );
    vi.mocked(repository.isActiveCategory).mockResolvedValue(false);

    await expect(
      new ProfessionalServicesService(repository).publish({
        organisationId: "organisation-1",
        serviceId: "service-1",
        actorAccountId: "account-1",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CATEGORY_NOT_AVAILABLE" });
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("blocks publication when the organisation is suspended", async () => {
    const repository = store("suspended");
    await expect(new ProfessionalServicesService(repository).publish({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
    })).rejects.toMatchObject({ code: "ORGANISATION_NOT_ELIGIBLE" });
    expect(repository.publish).not.toHaveBeenCalled();
  });

  it("requires published services to be unpublished before editing", async () => {
    const repository = store();
    vi.mocked(repository.get).mockResolvedValue(record({ status: "published" }));
    await expect(new ProfessionalServicesService(repository).update({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
      values: { name: "Changed name" },
    })).rejects.toMatchObject({ code: "SERVICE_PUBLISHED" });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("maps a failed optimistic update to a stale conflict", async () => {
    const repository = store();
    vi.mocked(repository.update).mockResolvedValue(null);
    await expect(new ProfessionalServicesService(repository).update({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
      values: { name: "Changed name" },
    })).rejects.toMatchObject({ code: "STALE_CONFLICT" });
  });

  it("unpublishes only a currently published service", async () => {
    const repository = store();
    await expect(new ProfessionalServicesService(repository).unpublish({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
    })).rejects.toMatchObject({ code: "SERVICE_NOT_PUBLISHED" });
    vi.mocked(repository.get).mockResolvedValue(record({ status: "published" }));
    await expect(new ProfessionalServicesService(repository).unpublish({
      organisationId: "organisation-1",
      serviceId: "service-1",
      actorAccountId: "account-1",
      expectedVersion: 1,
    })).resolves.toMatchObject({ status: "unpublished" });
  });

  it("projects the managed profile with only public catalogue assets", async () => {
    const repository = store();
    vi.mocked(repository.getManagedProfile).mockResolvedValue({
      organisationId: "organisation-1",
      professionalProfileId: "profile-1",
      slug: "veterans-plumbing",
      businessName: "Veterans Plumbing",
      organisationStatus: "active",
      description: "Trusted residential plumbing repairs and maintenance.",
      primaryCategory: "Plumbing",
      operatingLocation: "Nairobi",
      serviceAreas: ["Westlands"],
      workingHours: {
        monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
      },
      verificationStatus: "verified",
      logoAssetId: "logo-1",
      logoPublicId: "veterans-bay/logos/logo-1",
      updatedAt: new Date("2026-07-23T08:00:00.000Z"),
    });
    vi.mocked(repository.listPortfolio).mockResolvedValue([
      {
        id: "portfolio-1",
        assetId: "asset-1",
        title: "Kitchen refit",
        description: null,
        publicId: "veterans-bay/portfolio/asset-1",
      },
    ]);

    await expect(
      new ProfessionalServicesService(repository, "demo-cloud").getManagedProfile(
        "organisation-1",
      ),
    ).resolves.toMatchObject({
      businessName: "Veterans Plumbing",
      availabilitySummary: "Available 1 day a week",
      logoUrl:
        "https://res.cloudinary.com/demo-cloud/image/upload/veterans-bay/logos/logo-1",
      portfolio: [
        {
          id: "portfolio-1",
          imageUrl:
            "https://res.cloudinary.com/demo-cloud/image/upload/veterans-bay/portfolio/asset-1",
        },
      ],
    });
  });

  it("blocks public catalogue mutations for a suspended organisation", async () => {
    const repository = store("suspended");
    await expect(
      new ProfessionalServicesService(repository).addServiceImage({
        organisationId: "organisation-1",
        serviceId: "service-1",
        actorAccountId: "account-1",
        assetId: "asset-1",
      }),
    ).rejects.toMatchObject({ code: "ORGANISATION_NOT_ELIGIBLE" });
    expect(repository.addServiceImage).not.toHaveBeenCalled();
  });
});

describe("createProfessionalServiceBodySchema", () => {
  it("rejects misleading custom-quotation prices", () => {
    expect(
      createProfessionalServiceBodySchema.safeParse({
        name: "Custom repair",
        pricingModel: "custom_quote",
        priceMinor: 5_000,
      }).success,
    ).toBe(false);
    expect(
      createProfessionalServiceBodySchema.safeParse({
        name: "Custom repair",
        pricingModel: "custom_quote",
        priceMinor: null,
      }).success,
    ).toBe(true);
  });
});
