import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
import type { MarketplaceModerationStore } from "./repository";
import { MarketplaceModerationService } from "./service";

const now = new Date("2026-07-23T12:00:00.000Z");

function identity(): IdentityStore {
  return {
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: "account-1",
      authUserId: "user-1",
      status: "active",
    }),
    findActiveRestrictions: vi.fn().mockResolvedValue([]),
  } as unknown as IdentityStore;
}

function authorization(
  permissions: string[] = ["platform.admin"],
): Pick<
  WorkspaceRepository,
  "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
> {
  return {
    listActivePlatformAssignments: vi.fn().mockResolvedValue([
      {
        roleId: "role-1",
        roleKey: "platform_admin",
        status: "active",
      },
    ]),
    listPermissionKeysForRoleIds: vi
      .fn()
      .mockResolvedValue(new Map([["role-1", permissions]])),
  };
}

function category() {
  return {
    id: "category-1",
    name: "Plumbing",
    slug: "plumbing",
    status: "active",
    createdByAccountId: "account-1",
    createdAt: now,
    updatedAt: now,
  };
}

function store(): MarketplaceModerationStore {
  return {
    listCategories: vi.fn().mockResolvedValue([category()]),
    createCategory: vi.fn().mockResolvedValue(category()),
    setCategoryStatus: vi
      .fn()
      .mockResolvedValue({ ...category(), status: "inactive" }),
    listListings: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    moderateListing: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MarketplaceModerationService", () => {
  it("protects administrator category and listing reads", async () => {
    const service = new MarketplaceModerationService(
      store(),
      identity(),
      authorization([]),
    );

    await expect(service.listCategories("user-1")).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
    });
    await expect(
      service.listListings("user-1", {
        status: "all",
        page: 1,
        pageSize: 10,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("prevents duplicate categories and records explicit status transitions", async () => {
    const repository = store();
    const service = new MarketplaceModerationService(
      repository,
      identity(),
      authorization(),
    );

    await expect(
      service.createCategory({ authUserId: "user-1", name: "Plumbing" }),
    ).rejects.toMatchObject({ code: "CATEGORY_ALREADY_EXISTS" });

    await service.setCategoryStatus({
      authUserId: "user-1",
      categoryId: "category-1",
      action: "deactivate",
      reason: "Category is temporarily unavailable.",
    });
    expect(repository.setCategoryStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: "account-1",
        fromStatus: "active",
        toStatus: "inactive",
      }),
    );
  });

  it.each([
    {
      action: "hide" as const,
      fromStatus: "clear",
      toStatus: "hidden",
      eventType: "content.hidden",
    },
    {
      action: "restore" as const,
      fromStatus: "hidden",
      toStatus: "clear",
      eventType: "content.restored",
    },
  ])("maps listing $action to an auditable transition", async ({
    action,
    fromStatus,
    toStatus,
    eventType,
  }) => {
    const repository = store();
    const service = new MarketplaceModerationService(
      repository,
      identity(),
      authorization(),
    );

    await service.moderateListing({
      authUserId: "user-1",
      serviceId: "service-1",
      action,
      reason: "Recorded after marketplace policy review.",
    });
    expect(repository.moderateListing).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: "account-1",
        fromStatus,
        toStatus,
        eventType,
      }),
    );
  });
});
