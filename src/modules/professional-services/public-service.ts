import { AppError } from "../../platform/errors/app-error";
import type {
  PublicCatalogueStore,
  PublicProfessionalRecord,
  PublicServiceRecord,
} from "./public-repository";
import type {
  PublicProfessionalProfile,
  PublicServiceCard,
  PublicServiceDetail,
} from "./types";

function publicImageUrl(cloudName: string | undefined, publicId: string | null): string | null {
  if (!cloudName || !publicId) return null;
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${encodedPublicId}`;
}

function availabilitySummary(workingHours: PublicProfessionalRecord["workingHours"]): string | null {
  const dayOrder = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const availableDays = dayOrder
    .filter((day) => workingHours[day]?.enabled)
    .map((day) => `${day.charAt(0).toUpperCase()}${day.slice(1, 3)}`);
  return availableDays.length > 0 ? `Available ${availableDays.join(", ")}` : null;
}

function isComplete(service: PublicServiceRecord) {
  return Boolean(
    service.category &&
      service.description &&
      service.fulfilmentModel &&
      service.pricingModel &&
      (service.pricingModel === "custom_quote" || service.priceMinor != null),
  );
}

function toServiceCard(
  service: PublicServiceRecord,
  imageUrl: string | null,
): PublicServiceCard {
  return {
    slug: service.slug,
    name: service.name,
    category: service.category!,
    description: service.description!,
    fulfilmentModel: service.fulfilmentModel as PublicServiceCard["fulfilmentModel"],
    pricingModel: service.pricingModel as PublicServiceCard["pricingModel"],
    priceMinor: service.pricingModel === "custom_quote" ? null : service.priceMinor,
    currency: service.currency,
    estimatedDurationMinutes: service.estimatedDurationMinutes,
    serviceAreas: service.serviceAreas,
    directBookingEnabled: service.directBookingEnabled,
    imageUrl,
  };
}

export class PublicCatalogueService {
  constructor(
    private readonly store: PublicCatalogueStore,
    private readonly cloudName?: string,
  ) {}

  async getProfessional(slug: string): Promise<PublicProfessionalProfile> {
    const professional = await this.store.findProfessionalBySlug(slug);
    if (!professional) throw this.unavailable("professional");
    const [services, portfolio, reputation, publishedReviews] = await Promise.all([
      this.store.listServices(professional.organisationId),
      this.store.listPortfolio(professional.organisationId),
      this.store.getReputation?.(professional.organisationId) ?? null,
      this.store.listReviews?.(professional.organisationId) ?? [],
    ]);
    const completeServices = services.filter(isComplete);
    const serviceImages = await Promise.all(
      completeServices.map((service) => this.store.listServiceImages(service.id)),
    );
    const cards = completeServices.map((service, index) =>
      toServiceCard(
        service,
        publicImageUrl(this.cloudName, serviceImages[index]?.[0]?.publicId ?? null),
      ),
    );
    const categories = Array.from(
      new Set([
        ...(professional.primaryCategory ? [professional.primaryCategory] : []),
        ...cards.map((service) => service.category),
      ]),
    );

    return {
      slug: professional.slug,
      businessName: professional.businessName,
      description: professional.description,
      primaryCategory: professional.primaryCategory,
      categories,
      operatingLocation: professional.operatingLocation,
      serviceAreas: professional.serviceAreas,
      availabilitySummary: availabilitySummary(professional.workingHours),
      verified: professional.verificationStatus === "verified",
      logoUrl: publicImageUrl(this.cloudName, professional.logoPublicId),
      rating:
        reputation?.averageRatingHundredths == null
          ? null
          : reputation.averageRatingHundredths / 100,
      reviewCount: reputation?.reviewCount ?? 0,
      completedJobs: reputation?.verifiedJobs ?? 0,
      responseIndicator:
        reputation && reputation.reviewCount > 0
          ? `${Math.round(reputation.responseRateBasisPoints / 100)}%`
          : null,
      reviews: publishedReviews.map((review) => ({
        id: review.id,
        clientName: review.clientName,
        overallRating: review.overallRating,
        feedback: review.feedback,
        submittedAt: review.submittedAt.toISOString(),
        response:
          review.responseBody && review.responseCreatedAt
            ? {
                body: review.responseBody,
                createdAt: review.responseCreatedAt.toISOString(),
              }
            : null,
      })),
      portfolio: portfolio.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        imageUrl: publicImageUrl(this.cloudName, item.publicId),
      })),
      services: cards,
    };
  }

  async getService(slug: string): Promise<PublicServiceDetail> {
    const result = await this.store.findServiceBySlug(slug);
    if (!result || !isComplete(result.service)) throw this.unavailable("service");
    const images = await this.store.listServiceImages(result.service.id);
    const imageUrls = images
      .map((item) => publicImageUrl(this.cloudName, item.publicId))
      .filter((url): url is string => Boolean(url));
    const professional = result.professional;

    return {
      ...toServiceCard(result.service, imageUrls[0] ?? null),
      requirements: result.service.requirements,
      warrantyDurationDays: result.service.warrantyDurationDays,
      warrantyTerms: result.service.warrantyTerms,
      images: imageUrls,
      provider: {
        slug: professional.slug,
        businessName: professional.businessName,
        description: professional.description,
        primaryCategory: professional.primaryCategory,
        operatingLocation: professional.operatingLocation,
        serviceAreas: professional.serviceAreas,
        availabilitySummary: availabilitySummary(professional.workingHours),
        verified: professional.verificationStatus === "verified",
        logoUrl: publicImageUrl(this.cloudName, professional.logoPublicId),
        rating: null,
        reviewCount: 0,
        completedJobs: 0,
        responseIndicator: null,
        reviews: [],
      },
    };
  }

  private unavailable(kind: "professional" | "service") {
    return new AppError({
      code: "PUBLIC_LISTING_UNAVAILABLE",
      message: `This ${kind} is not currently available.`,
      status: 404,
    });
  }
}
