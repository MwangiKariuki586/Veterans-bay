import { AppError, StaleConflictError, type ValidationIssue } from "../../platform/errors/app-error";
import type { ProfessionalServiceRecord, ProfessionalServicesStore } from "./repository";
import type {
  ManagedImageAsset,
  ManagedPortfolioItem,
  ManagedProfessionalProfile,
  ProfessionalServiceSummary,
} from "./types";

function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "service"}-${crypto.randomUUID().slice(0, 8)}`;
}

function toSummary(
  record: Awaited<ReturnType<ProfessionalServicesStore["createDraft"]>>,
): ProfessionalServiceSummary {
  return {
    ...record,
    status: record.status as ProfessionalServiceSummary["status"],
    fulfilmentModel:
      record.fulfilmentModel as ProfessionalServiceSummary["fulfilmentModel"],
    pricingModel: record.pricingModel as ProfessionalServiceSummary["pricingModel"],
    publishedAt: record.publishedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class ProfessionalServicesService {
  constructor(
    private readonly store: ProfessionalServicesStore,
    private readonly cloudName?: string,
  ) {}

  async list(organisationId: string): Promise<ProfessionalServiceSummary[]> {
    return (await this.store.list(organisationId)).map(toSummary);
  }

  async get(
    organisationId: string,
    serviceId: string,
  ): Promise<ProfessionalServiceSummary> {
    return toSummary(await this.requireService(organisationId, serviceId));
  }

  async createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    values: Parameters<ProfessionalServicesStore["createDraft"]>[0]["values"];
    correlationId?: string;
  }): Promise<ProfessionalServiceSummary> {
    const organisationStatus = await this.store.getOrganisationStatus(
      input.organisationId,
    );
    if (organisationStatus !== "active") {
      throw new AppError({
        code: "ORGANISATION_NOT_ELIGIBLE",
        message: "Only an active approved organisation can manage services.",
        status: 409,
      });
    }
    const created = await this.store.createDraft({
      organisationId: input.organisationId,
      actorAccountId: input.actorAccountId,
      slug: slugify(String(input.values.name)),
      values: input.values,
      correlationId: input.correlationId,
    });
    return toSummary(created);
  }

  async getManagedProfile(
    organisationId: string,
  ): Promise<ManagedProfessionalProfile> {
    const profile = await this.store.getManagedProfile(organisationId);
    if (!profile) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The professional profile was not found.",
        status: 404,
      });
    }
    const portfolio = await this.store.listPortfolio(organisationId);
    return {
      organisationId: profile.organisationId,
      professionalProfileId: profile.professionalProfileId,
      slug: profile.slug,
      businessName: profile.businessName,
      organisationStatus: profile.organisationStatus,
      description: profile.description,
      primaryCategory: profile.primaryCategory,
      operatingLocation: profile.operatingLocation,
      experienceStartedYear: profile.experienceStartedYear,
      serviceAreas: profile.serviceAreas,
      availabilitySummary: availabilitySummary(profile.workingHours),
      verificationStatus: profile.verificationStatus,
      logoAssetId: profile.logoAssetId,
      logoUrl: publicImageUrl(this.cloudName, profile.logoPublicId),
      portfolio: portfolio.map((item) => ({
        id: item.id,
        assetId: item.assetId,
        title: item.title,
        description: item.description,
        imageUrl: publicImageUrl(this.cloudName, item.publicId),
      })),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  async updateManagedProfile(input: {
    organisationId: string;
    values: {
      businessName: string;
      description: string;
      primaryCategory: string;
      operatingLocation: string;
      experienceStartedYear: number | null;
      serviceAreas: string[];
    };
  }): Promise<ManagedProfessionalProfile> {
    await this.requireActiveOrganisation(input.organisationId);
    const updated = await this.store.updateManagedProfile(input);
    if (!updated) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The professional profile was not found.",
        status: 404,
      });
    }
    return this.getManagedProfile(input.organisationId);
  }

  async attachLogo(input: {
    organisationId: string;
    actorAccountId: string;
    assetId: string;
  }): Promise<ManagedProfessionalProfile> {
    await this.requireActiveOrganisation(input.organisationId);
    await this.store.attachLogo(input);
    return this.getManagedProfile(input.organisationId);
  }

  async addPortfolioItem(input: {
    organisationId: string;
    actorAccountId: string;
    assetId: string;
    title: string;
    description: string | null;
    correlationId?: string;
  }): Promise<ManagedPortfolioItem> {
    await this.requireActiveOrganisation(input.organisationId);
    const item = await this.store.addPortfolioItem(input);
    return {
      id: item.id,
      assetId: item.assetId,
      title: item.title,
      description: item.description,
      imageUrl: publicImageUrl(this.cloudName, item.publicId),
    };
  }

  async removePortfolioItem(
    organisationId: string,
    itemId: string,
  ): Promise<ManagedPortfolioItem> {
    await this.requireActiveOrganisation(organisationId);
    const item = await this.store.removePortfolioItem(organisationId, itemId);
    if (!item) throw catalogueItemNotFound();
    return {
      id: item.id,
      assetId: item.assetId,
      title: item.title,
      description: item.description,
      imageUrl: publicImageUrl(this.cloudName, item.publicId),
    };
  }

  async listServiceImages(
    organisationId: string,
    serviceId: string,
  ): Promise<ManagedImageAsset[]> {
    await this.requireService(organisationId, serviceId);
    return (await this.store.listServiceImages(organisationId, serviceId)).map(
      (item) => ({
        id: item.id,
        assetId: item.assetId,
        imageUrl: publicImageUrl(this.cloudName, item.publicId),
      }),
    );
  }

  async addServiceImage(input: {
    organisationId: string;
    serviceId: string;
    actorAccountId: string;
    assetId: string;
  }): Promise<ManagedImageAsset> {
    await this.requireActiveOrganisation(input.organisationId);
    const image = await this.store.addServiceImage(input);
    return {
      id: image.id,
      assetId: image.assetId,
      imageUrl: publicImageUrl(this.cloudName, image.publicId),
    };
  }

  async removeServiceImage(
    organisationId: string,
    serviceId: string,
    imageId: string,
  ): Promise<ManagedImageAsset> {
    await this.requireActiveOrganisation(organisationId);
    const image = await this.store.removeServiceImage(
      organisationId,
      serviceId,
      imageId,
    );
    if (!image) throw catalogueItemNotFound();
    return {
      id: image.id,
      assetId: image.assetId,
      imageUrl: publicImageUrl(this.cloudName, image.publicId),
    };
  }

  async update(input: {
    organisationId: string;
    serviceId: string;
    actorAccountId: string;
    expectedVersion: number;
    values: Parameters<ProfessionalServicesStore["update"]>[0]["values"];
    correlationId?: string;
  }): Promise<ProfessionalServiceSummary> {
    const current = await this.requireService(input.organisationId, input.serviceId);
    if (current.status === "published") {
      throw new AppError({
        code: "SERVICE_PUBLISHED",
        message: "Unpublish this service before editing its public details.",
        status: 409,
      });
    }
    this.assertPricingCombination({ ...current, ...input.values });
    const updated = await this.store.update(input);
    if (!updated) throw new StaleConflictError();
    return toSummary(updated);
  }

  async publish(input: {
    organisationId: string;
    serviceId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ProfessionalServiceSummary> {
    const [organisationStatus, current] = await Promise.all([
      this.store.getOrganisationStatus(input.organisationId),
      this.requireService(input.organisationId, input.serviceId),
    ]);
    if (organisationStatus !== "active") {
      throw new AppError({
        code: "ORGANISATION_NOT_ELIGIBLE",
        message: "Only an active approved organisation can publish services.",
        status: 409,
      });
    }
    if (current.status === "published") {
      throw new AppError({
        code: "SERVICE_ALREADY_PUBLISHED",
        message: "This service is already published.",
        status: 409,
      });
    }
    this.assertPublishable(current);
    if (!(await this.store.isActiveCategory(current.category!))) {
      throw new AppError({
        code: "CATEGORY_NOT_AVAILABLE",
        message: "Choose an active marketplace category before publishing.",
        status: 409,
      });
    }
    const published = await this.store.publish(input);
    if (!published) throw new StaleConflictError();
    return toSummary(published);
  }

  async unpublish(input: {
    organisationId: string;
    serviceId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ProfessionalServiceSummary> {
    const current = await this.requireService(input.organisationId, input.serviceId);
    if (current.status !== "published") {
      throw new AppError({
        code: "SERVICE_NOT_PUBLISHED",
        message: "Only a published service can be unpublished.",
        status: 409,
      });
    }
    const unpublished = await this.store.unpublish(input);
    if (!unpublished) throw new StaleConflictError();
    return toSummary(unpublished);
  }

  private async requireService(
    organisationId: string,
    serviceId: string,
  ): Promise<ProfessionalServiceRecord> {
    const service = await this.store.get(organisationId, serviceId);
    if (!service) {
      throw new AppError({
        code: "SERVICE_NOT_FOUND",
        message: "The service could not be found in this organisation.",
        status: 404,
      });
    }
    return service;
  }

  private assertPricingCombination(service: {
    pricingModel: string | null;
    priceMinor: number | null;
  }) {
    if (service.pricingModel === "custom_quote" && service.priceMinor != null) {
      throw new AppError({
        code: "INVALID_SERVICE_PRICING",
        message: "Custom-quotation services cannot define a displayed price.",
        status: 422,
      });
    }
    if (service.priceMinor != null && !service.pricingModel) {
      throw new AppError({
        code: "INVALID_SERVICE_PRICING",
        message: "Choose a pricing model before entering a price.",
        status: 422,
      });
    }
  }

  private assertPublishable(service: ProfessionalServiceRecord) {
    this.assertPricingCombination(service);
    const issues: ValidationIssue[] = [];
    if (!service.category) issues.push({ code: "required", path: "category" });
    if (!service.description) issues.push({ code: "required", path: "description" });
    if (!service.fulfilmentModel) issues.push({ code: "required", path: "fulfilmentModel" });
    if (!service.pricingModel) issues.push({ code: "required", path: "pricingModel" });
    if (
      (service.pricingModel === "fixed" || service.pricingModel === "starting_from") &&
      service.priceMinor == null
    ) {
      issues.push({ code: "required", path: "priceMinor" });
    }
    if (issues.length > 0) {
      throw new AppError({
        code: "SERVICE_NOT_READY",
        issues,
        message: "Complete the required service details before publishing.",
        status: 422,
      });
    }
  }

  private async requireActiveOrganisation(organisationId: string) {
    if ((await this.store.getOrganisationStatus(organisationId)) !== "active") {
      throw new AppError({
        code: "ORGANISATION_NOT_ELIGIBLE",
        message: "Only an active approved organisation can manage its public catalogue.",
        status: 409,
      });
    }
  }
}

function publicImageUrl(
  cloudName: string | undefined,
  publicId: string | null,
): string | null {
  if (!cloudName || !publicId) return null;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${publicId
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function availabilitySummary(
  workingHours: Record<string, { enabled: boolean }>,
): string | null {
  const openDays = Object.values(workingHours).filter((day) => day.enabled).length;
  if (openDays === 0) return null;
  if (openDays === 7) return "Available every day";
  return `Available ${openDays} ${openDays === 1 ? "day" : "days"} a week`;
}

function catalogueItemNotFound() {
  return new AppError({
    code: "NOT_FOUND",
    message: "The requested catalogue image was not found.",
    status: 404,
  });
}
