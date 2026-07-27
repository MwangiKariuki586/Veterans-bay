import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { SavedProfessionalsStore } from "./repository";
import { SavedProfessionalsService } from "./service";

function identityStore(
  overrides: Partial<IdentityStore> = {},
): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: "account-1",
      authUserId: "auth-1",
      displayName: "Client",
      primaryEmail: "client@example.com",
      phone: null,
      timezone: "Africa/Nairobi",
      status: "active",
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findActiveRestrictions: vi.fn().mockResolvedValue([]),
    updateProfile: vi.fn(),
    deactivateProfile: vi.fn(),
    recordAuditEvent: vi.fn(),
    insertDomainEvent: vi.fn(),
    ...overrides,
  };
}

function savedStore(
  overrides: Partial<SavedProfessionalsStore> = {},
): SavedProfessionalsStore {
  return {
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue({ created: true }),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("saved professionals service", () => {
  it("lists only the account-scoped public projection", async () => {
    const store = savedStore({
      list: vi.fn().mockResolvedValue([
        {
          slug: "trusted-plumbing",
          businessName: "Trusted Plumbing",
          primaryCategory: "Plumbing",
          description: "Residential and commercial plumbing.",
          operatingLocation: "Nairobi",
          verified: true,
          logoPublicId: "veterans-bay/logos/trusted",
          serviceCount: 3,
          savedAt: new Date("2026-07-23T09:00:00.000Z"),
        },
      ]),
    });

    await expect(
      new SavedProfessionalsService(
        store,
        identityStore(),
        "demo-cloud",
      ).list("auth-1"),
    ).resolves.toEqual([
      expect.objectContaining({
        slug: "trusted-plumbing",
        logoUrl:
          "https://res.cloudinary.com/demo-cloud/image/upload/veterans-bay/logos/trusted",
        savedAt: "2026-07-23T09:00:00.000Z",
      }),
    ]);
    expect(store.list).toHaveBeenCalledWith("account-1");
  });

  it("requires an active unrestricted account before saving", async () => {
    const store = savedStore();
    const identity = identityStore({
      findActiveRestrictions: vi.fn().mockResolvedValue([
        {
          id: "restriction-1",
          type: "suspended",
          reason: "Review",
          startsAt: new Date(),
          endsAt: null,
        },
      ]),
    });

    await expect(
      new SavedProfessionalsService(store, identity).save({
        authUserId: "auth-1",
        providerSlug: "trusted-plumbing",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_RESTRICTED", status: 403 });
    expect(store.save).not.toHaveBeenCalled();
  });

  it("rejects inactive or non-public professional targets", async () => {
    const store = savedStore({ save: vi.fn().mockResolvedValue(null) });

    await expect(
      new SavedProfessionalsService(store, identityStore()).save({
        authUserId: "auth-1",
        providerSlug: "private-provider",
      }),
    ).rejects.toMatchObject({
      code: "PROFESSIONAL_NOT_AVAILABLE",
      status: 404,
    });
  });

  it("removes only from the authenticated account scope", async () => {
    const store = savedStore();
    await expect(
      new SavedProfessionalsService(store, identityStore()).remove(
        "auth-1",
        "trusted-plumbing",
      ),
    ).resolves.toEqual({
      providerSlug: "trusted-plumbing",
      saved: false,
    });
    expect(store.remove).toHaveBeenCalledWith(
      "account-1",
      "trusted-plumbing",
    );
  });
});
