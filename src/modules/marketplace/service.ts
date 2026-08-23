import type { MarketplaceStore } from "./repository";
import { buildAvailableSlots } from "../bookings/availability";
import type { BookingSlotInputs } from "../bookings/repository";
import type {
  MarketplaceAnalyticsEvent,
  MarketplaceListing,
  MarketplaceSearchQuery,
  MarketplaceSearchResult,
} from "./types";

function publicImageUrl(
  cloudName: string | undefined,
  publicId: string | null,
): string | null {
  if (!cloudName || !publicId) return null;
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_auto,q_auto,c_fill,w_1200,h_800/${encodedPublicId}`;
}

export class MarketplaceService {
  constructor(
    private readonly store: MarketplaceStore,
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

  async search(input: MarketplaceSearchQuery): Promise<MarketplaceSearchResult> {
    const result = await this.store.search(input);
    const now = this.now();
    const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1_000);
    const bookableOrganisationIds = result.items
      .filter(
        (item) =>
          item.directBookingEnabled && item.estimatedDurationMinutes != null,
      )
      .map((item) => item.organisationId);
    const availability = this.availabilityStore
      ? await this.availabilityStore.slotInputsByOrganisation({
          organisationIds: bookableOrganisationIds,
          from: now,
          to,
        })
      : new Map<string, BookingSlotInputs>();
    const currentYear = Number(
      new Intl.DateTimeFormat("en", {
        timeZone: "Africa/Nairobi",
        year: "numeric",
      }).format(now),
    );
    const items: MarketplaceListing[] = result.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      category: item.category,
      description: item.description,
      fulfilmentModel:
        item.fulfilmentModel as MarketplaceListing["fulfilmentModel"],
      pricingModel: item.pricingModel as MarketplaceListing["pricingModel"],
      priceMinor:
        item.pricingModel === "custom_quote" ? null : item.priceMinor,
      currency: item.currency,
      serviceAreas: item.serviceAreas,
      imageUrl: publicImageUrl(this.cloudName, item.imagePublicId),
      provider: {
        slug: item.providerSlug,
        businessName: item.providerName,
        operatingLocation: item.providerLocation,
        verified: item.providerVerified,
        availableToday: false,
        experienceYears:
          item.providerExperienceStartedYear == null
            ? null
            : Math.max(0, currentYear - item.providerExperienceStartedYear),
        nextAvailableSlot: null,
        rating:
          item.providerAverageRatingHundredths == null
            ? null
            : item.providerAverageRatingHundredths / 100,
        reviewCount: item.providerReviewCount ?? 0,
        verifiedJobs: item.providerVerifiedJobs ?? 0,
      },
    }));

    for (const [index, item] of result.items.entries()) {
      const listing = items[index];
      const inputs = availability.get(item.organisationId);
      if (!listing || !inputs || !item.estimatedDurationMinutes) continue;
      const [slot] = buildAvailableSlots({
        ...inputs,
        from: now,
        to,
        now,
        durationMinutes: item.estimatedDurationMinutes,
        limit: Number.MAX_SAFE_INTEGER,
      });
      if (!slot) continue;
      listing.provider.nextAvailableSlot = {
        startsAt: slot.startsAt,
        timezone: slot.timezone,
      };
      listing.provider.availableToday = sameLocalDate(
        now,
        new Date(slot.startsAt),
        slot.timezone,
      );
    }

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.max(1, Math.ceil(result.totalItems / input.pageSize)),
    };
  }

  async recordAnalytics(event: MarketplaceAnalyticsEvent): Promise<void> {
    await this.store.recordAnalytics(event);
  }
}

function sameLocalDate(left: Date, right: Date, timezone: string) {
  const format = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return format.format(left) === format.format(right);
}
