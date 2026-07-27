import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import type { SavedProfessionalsStore } from "./repository";
import type {
  SavedProfessional,
  SavedProfessionalMutation,
} from "./types";

function publicImageUrl(
  cloudName: string | undefined,
  publicId: string | null,
): string | null {
  if (!cloudName || !publicId) return null;
  const encodedPublicId = publicId.split("/").map(encodeURIComponent).join("/");
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${encodedPublicId}`;
}

export class SavedProfessionalsService {
  private readonly identityService: IdentityService;

  constructor(
    private readonly store: SavedProfessionalsStore,
    identityStore: IdentityStore,
    private readonly cloudName?: string,
  ) {
    this.identityService = new IdentityService(identityStore);
  }

  async list(authUserId: string): Promise<SavedProfessional[]> {
    const { profile } =
      await this.identityService.requireActiveAccount(authUserId);
    const records = await this.store.list(profile.id);
    return records.map((record) => ({
      slug: record.slug,
      businessName: record.businessName,
      primaryCategory: record.primaryCategory,
      description: record.description,
      operatingLocation: record.operatingLocation,
      verified: record.verified,
      logoUrl: publicImageUrl(this.cloudName, record.logoPublicId),
      serviceCount: record.serviceCount,
      savedAt: record.savedAt.toISOString(),
    }));
  }

  async save(input: {
    authUserId: string;
    providerSlug: string;
    correlationId?: string;
  }): Promise<SavedProfessionalMutation> {
    const { profile } =
      await this.identityService.requireActiveAccount(input.authUserId);
    const result = await this.store.save({
      accountProfileId: profile.id,
      providerSlug: input.providerSlug,
      correlationId: input.correlationId,
    });
    if (!result) {
      throw new AppError({
        code: "PROFESSIONAL_NOT_AVAILABLE",
        message: "This professional is not available in the marketplace.",
        status: 404,
      });
    }
    return { providerSlug: input.providerSlug, saved: true };
  }

  async remove(
    authUserId: string,
    providerSlug: string,
  ): Promise<SavedProfessionalMutation> {
    const { profile } =
      await this.identityService.requireActiveAccount(authUserId);
    await this.store.remove(profile.id, providerSlug);
    return { providerSlug, saved: false };
  }
}
