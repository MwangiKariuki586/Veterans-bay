import { AppError } from "../../platform/errors/app-error";
import { permissionKeys } from "../../platform/permissions/keys";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
import type { MarketplaceModerationStore } from "./repository";
import type {
  MarketplaceCategorySummary,
  ModeratedListingPage,
} from "./types";

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function toCategory(
  record: Awaited<ReturnType<MarketplaceModerationStore["createCategory"]>>,
): MarketplaceCategorySummary {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    status: record.status as "active" | "inactive",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class MarketplaceModerationService {
  constructor(
    private readonly store: MarketplaceModerationStore,
    private readonly identityStore: IdentityStore,
    private readonly workspaceStore: Pick<
      WorkspaceRepository,
      "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
    >,
  ) {}

  async listPublicCategories(): Promise<MarketplaceCategorySummary[]> {
    return (await this.store.listCategories("active")).map(toCategory);
  }

  async listCategories(authUserId: string) {
    await this.requirePlatformAdmin(authUserId);
    return (await this.store.listCategories()).map(toCategory);
  }

  async createCategory(input: {
    authUserId: string;
    name: string;
    correlationId?: string;
  }) {
    const account = await this.requirePlatformAdmin(input.authUserId);
    const slug = slugify(input.name);
    if (!slug) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "The category name must contain letters or numbers.",
        status: 422,
      });
    }
    const existing = await this.store.listCategories();
    if (
      existing.some(
        (category) =>
          category.slug === slug ||
          category.name.toLowerCase() === input.name.toLowerCase(),
      )
    ) {
      throw new AppError({
        code: "CATEGORY_ALREADY_EXISTS",
        message: "A marketplace category with this name already exists.",
        status: 409,
      });
    }
    return toCategory(
      await this.store.createCategory({
        actorAccountId: account.id,
        name: input.name,
        slug,
        correlationId: input.correlationId,
      }),
    );
  }

  async setCategoryStatus(input: {
    authUserId: string;
    categoryId: string;
    action: "activate" | "deactivate";
    reason: string;
    correlationId?: string;
  }) {
    const account = await this.requirePlatformAdmin(input.authUserId);
    const toStatus = input.action === "activate" ? "active" : "inactive";
    return toCategory(
      await this.store.setCategoryStatus({
        actorAccountId: account.id,
        categoryId: input.categoryId,
        fromStatus: toStatus === "active" ? "inactive" : "active",
        toStatus,
        reason: input.reason,
        correlationId: input.correlationId,
      }),
    );
  }

  async listListings(
    authUserId: string,
    input: {
      status: "all" | "visible" | "hidden";
      q?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<ModeratedListingPage> {
    await this.requirePlatformAdmin(authUserId);
    const result = await this.store.listListings(input);
    return {
      items: result.items.map((item) => ({
        ...item,
        moderationStatus: item.moderationStatus as "clear" | "hidden",
        moderatedAt: item.moderatedAt?.toISOString() ?? null,
        updatedAt: item.updatedAt.toISOString(),
      })),
      page: input.page,
      pageSize: input.pageSize,
      totalItems: result.totalItems,
      totalPages: Math.max(1, Math.ceil(result.totalItems / input.pageSize)),
    };
  }

  async moderateListing(input: {
    authUserId: string;
    serviceId: string;
    action: "hide" | "restore";
    reason: string;
    correlationId?: string;
  }) {
    const account = await this.requirePlatformAdmin(input.authUserId);
    const hidden = input.action === "hide";
    await this.store.moderateListing({
      actorAccountId: account.id,
      serviceId: input.serviceId,
      fromStatus: hidden ? "clear" : "hidden",
      toStatus: hidden ? "hidden" : "clear",
      reason: input.reason,
      eventType: hidden ? "content.hidden" : "content.restored",
      correlationId: input.correlationId,
    });
    return { serviceId: input.serviceId, moderationStatus: hidden ? "hidden" : "clear" };
  }

  private async requirePlatformAdmin(authUserId: string) {
    const account = await this.identityStore.findProfileByAuthUserId(authUserId);
    if (!account || account.status === "deactivated") {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "Platform administration permission is required.",
        status: 403,
      });
    }
    if ((await this.identityStore.findActiveRestrictions(account.id)).length > 0) {
      throw new AppError({
        code: "ACCOUNT_RESTRICTED",
        message: "This account cannot perform protected actions.",
        status: 403,
      });
    }
    const assignments =
      await this.workspaceStore.listActivePlatformAssignments(account.id);
    const admin = assignments.find((item) => item.roleKey === "platform_admin");
    if (!admin) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "Platform administration permission is required.",
        status: 403,
      });
    }
    const permissions =
      await this.workspaceStore.listPermissionKeysForRoleIds([admin.roleId]);
    if (!(permissions.get(admin.roleId) ?? []).includes(permissionKeys.platformAdmin)) {
      throw new AppError({
        code: "PERMISSION_DENIED",
        message: "Platform administration permission is required.",
        status: 403,
      });
    }
    return account;
  }
}
