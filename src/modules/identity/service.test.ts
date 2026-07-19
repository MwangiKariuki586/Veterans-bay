import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "./repository";
import {
  AccountDeactivatedError,
  AccountRestrictedError,
  IdentityService,
} from "./service";

function profile(overrides: Partial<{
  id: string;
  authUserId: string;
  displayName: string;
  primaryEmail: string;
  phone: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: "profile-1",
    authUserId: "user-1",
    displayName: "Alex Veteran",
    primaryEmail: "alex@example.com",
    phone: null,
    timezone: "UTC",
    status: "active",
    termsAcceptedAt: new Date(),
    privacyAcceptedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("IdentityService", () => {
  it("reconciles a registered user and emits the registration event", async () => {
    const repository: IdentityStore = {
      reconcileProfile: vi.fn().mockResolvedValue(profile()),
      findProfileByAuthUserId: vi.fn(),
      findActiveRestrictions: vi.fn(),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn().mockResolvedValue(undefined),
      insertDomainEvent: vi.fn().mockResolvedValue(undefined),
    };
    const service = new IdentityService(repository);

    await service.reconcileRegisteredUser(
      { id: "user-1", email: "alex@example.com", name: "Alex Veteran" },
      { acceptPrivacy: true, acceptTerms: true, correlationId: "req-1" },
    );

    expect(repository.reconcileProfile).toHaveBeenCalled();
    expect(repository.insertDomainEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "user.registered" }),
    );
  });

  it("blocks deactivated and restricted accounts", async () => {
    const deactivatedRepository: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi
        .fn()
        .mockResolvedValue(profile({ status: "deactivated" })),
      findActiveRestrictions: vi.fn(),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };
    const restrictedRepository: IdentityStore = {
      reconcileProfile: vi.fn(),
      findProfileByAuthUserId: vi.fn().mockResolvedValue(profile()),
      findActiveRestrictions: vi.fn().mockResolvedValue([
        {
          id: "restriction-1",
          type: "suspended",
          reason: "policy",
          startsAt: new Date(),
          endsAt: null,
        },
      ]),
      updateProfile: vi.fn(),
      deactivateProfile: vi.fn(),
      recordAuditEvent: vi.fn(),
      insertDomainEvent: vi.fn(),
    };

    await expect(
      new IdentityService(deactivatedRepository).requireActiveAccount("user-1"),
    ).rejects.toBeInstanceOf(AccountDeactivatedError);

    await expect(
      new IdentityService(restrictedRepository).requireActiveAccount("user-1"),
    ).rejects.toBeInstanceOf(AccountRestrictedError);
  });
});
