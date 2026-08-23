import { AppError } from "../../platform/errors/app-error";
import { buildAvailableSlots } from "../bookings/availability";
import type { BookingSlotInputs } from "../bookings/repository";
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

function toMinuteOfDay(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
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
    private readonly availabilityStore?: {
      slotInputsByOrganisation(input: {
        organisationIds: string[];
        from: Date;
        to: Date;
      }): Promise<Map<string, BookingSlotInputs>>;
    },
    private readonly now: () => Date = () => new Date(),
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
    const nextAvailableSlot = await this.findNextAvailableSlot(
      professional.organisationId,
      professional.workingHours,
      cards
        .filter(
          (service) =>
            service.directBookingEnabled &&
            service.estimatedDurationMinutes != null,
        )
        .map((service) => service.estimatedDurationMinutes!),
    );

    const experienceYears =
      professional.experienceStartedYear == null
        ? null
        : Math.max(0, this.now().getFullYear() - professional.experienceStartedYear);
    const publishedReviewCount = publishedReviews.length;
    const publishedAverageRating =
      publishedReviewCount > 0
        ? publishedReviews.reduce(
            (total, review) => total + review.overallRating,
            0,
          ) / publishedReviewCount
        : null;
    const projectedReviewCount = Math.max(
      reputation?.reviewCount ?? 0,
      publishedReviewCount,
    );
    const projectedRating =
      reputation?.averageRatingHundredths == null
        ? publishedAverageRating
        : reputation.averageRatingHundredths / 100;
    return {
      slug: professional.slug,
      businessName: professional.businessName,
      description: professional.description,
      primaryCategory: professional.primaryCategory,
      categories,
      operatingLocation: professional.operatingLocation,
      serviceAreas: professional.serviceAreas,
      availabilitySummary: availabilitySummary(professional.workingHours),
      nextAvailableSlot,
      verified: professional.verificationStatus === "verified",
      logoUrl: publicImageUrl(this.cloudName, professional.logoPublicId),
      rating: projectedRating,
      reviewCount: projectedReviewCount,
      completedJobs: reputation?.verifiedJobs ?? 0,
      responseIndicator:
        reputation && reputation.reviewCount > 0
          ? `${Math.round(reputation.responseRateBasisPoints / 100)}%`
          : null,
      experienceYears,
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
    const nextAvailableSlot = await this.findNextAvailableSlot(
      professional.organisationId,
      professional.workingHours,
      result.service.directBookingEnabled &&
        result.service.estimatedDurationMinutes != null
        ? [result.service.estimatedDurationMinutes]
        : [],
    );

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
        nextAvailableSlot,
        verified: professional.verificationStatus === "verified",
        logoUrl: publicImageUrl(this.cloudName, professional.logoPublicId),
        rating: null,
        reviewCount: 0,
        completedJobs: 0,
        responseIndicator: null,
        experienceYears:
          professional.experienceStartedYear == null
            ? null
            : Math.max(0, this.now().getFullYear() - professional.experienceStartedYear),
        reviews: [],
      },
    };
  }

  private async findNextAvailableSlot(
    organisationId: string,
    workingHours: PublicProfessionalRecord["workingHours"],
    durations: number[],
  ): Promise<{ startsAt: string; timezone: string } | null> {
    const eligibleDurations = [...new Set(durations)].filter(
      (duration) => duration > 0,
    );
    const candidateDurations =
      eligibleDurations.length > 0 ? eligibleDurations : [60];
    if (!this.availabilityStore) return null;

    const now = this.now();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);
    const availability = await this.availabilityStore.slotInputsByOrganisation({
      organisationIds: [organisationId],
      from: now,
      to,
    });
    const configuredInputs = availability.get(organisationId);
    const inputs =
      configuredInputs && configuredInputs.rules.length > 0
        ? configuredInputs
        : {
            rules: Object.entries(workingHours).flatMap(([day, hours]) => {
              if (!hours.enabled) return [];
              const weekday = [
                "sunday",
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
              ].indexOf(day.toLowerCase());
              const startMinute = toMinuteOfDay(hours.opensAt);
              const endMinute = toMinuteOfDay(hours.closesAt);
              if (weekday < 0 || startMinute == null || endMinute == null) return [];
              return [
                {
                  membershipId: `working-hours-${organisationId}`,
                  memberName: "Professional",
                  weekday,
                  startMinute,
                  endMinute,
                  timezone: "Africa/Nairobi",
                },
              ];
            }),
            blocks: [],
            reservations: [],
          } satisfies BookingSlotInputs;
    if (inputs.rules.length === 0) return null;

    const first = candidateDurations
      .flatMap((durationMinutes) =>
        buildAvailableSlots({
          ...inputs,
          from: now,
          to,
          now,
          durationMinutes,
          limit: Number.MAX_SAFE_INTEGER,
        }),
      )
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))[0];
    return first
      ? { startsAt: first.startsAt, timezone: first.timezone }
      : null;
  }

  private unavailable(kind: "professional" | "service") {
    return new AppError({
      code: "PUBLIC_LISTING_UNAVAILABLE",
      message: `This ${kind} is not currently available.`,
      status: 404,
    });
  }
}
