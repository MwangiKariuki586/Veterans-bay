import { describe, expect, it, vi } from "vitest";

import { permissionKeys } from "../../platform/permissions/keys";
import type { IdentityStore } from "../identity/repository";
import type { WorkspaceRepository } from "../workspace/repository";
import type { AdministrationRepository } from "./repository";
import { AdministrationService } from "./service";

function identity(status = "active"): IdentityStore {
  return {
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: "account-1",
      authUserId: "user-1",
      status,
    }),
    findActiveRestrictions: vi.fn().mockResolvedValue([]),
  } as unknown as IdentityStore;
}

function authorization(
  permissions = [permissionKeys.platformAdmin],
): Pick<
  WorkspaceRepository,
  "listActivePlatformAssignments" | "listPermissionKeysForRoleIds"
> {
  return {
    listActivePlatformAssignments: vi.fn().mockResolvedValue([
      { roleId: "role-1", roleKey: "platform_admin", status: "active" },
    ]),
    listPermissionKeysForRoleIds: vi
      .fn()
      .mockResolvedValue(new Map([["role-1", permissions]])),
  };
}

function repository(): AdministrationRepository {
  return {
    submitReport: vi.fn().mockResolvedValue({ id: "report-1" }),
    listReports: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    openCase: vi.fn().mockResolvedValue({ id: "case-1" }),
    listCases: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    getCase: vi.fn().mockResolvedValue({
      case: { id: "case-1" },
      history: [],
      evidence: [],
    }),
    transitionCase: vi.fn().mockResolvedValue({ id: "case-1" }),
    listDisputes: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    transitionDispute: vi.fn().mockResolvedValue({ id: "dispute-1" }),
    listEscalatedWarranties: vi
      .fn()
      .mockResolvedValue({ items: [], totalItems: 0 }),
    decideEscalatedWarranty: vi.fn().mockResolvedValue({ id: "claim-1" }),
    listAudit: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
    listRules: vi.fn().mockResolvedValue([]),
    upsertRule: vi.fn().mockResolvedValue({ id: "rule-1" }),
  } as unknown as AdministrationRepository;
}

describe("AdministrationService", () => {
  it("allows an active account to submit a bounded report", async () => {
    const store = repository();
    const service = new AdministrationService(
      store,
      identity(),
      authorization([]),
    );

    await service.submitReport("user-1", {
      category: "FRAUD_CONCERN",
      subjectType: "ACCOUNT",
      subjectId: "subject-1",
      summary: "Suspicious request",
      details: "The account requested an off-platform transfer.",
    });

    expect(store.submitReport).toHaveBeenCalledWith(
      expect.objectContaining({ submittedByAccountId: "account-1" }),
    );
  });

  it("requires current platform permission for queues and decisions", async () => {
    const service = new AdministrationService(
      repository(),
      identity(),
      authorization([]),
    );

    await expect(
      service.listReports("user-1", {
        status: "all",
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("passes reasoned case and warranty decisions with the admin actor", async () => {
    const store = repository();
    const service = new AdministrationService(
      store,
      identity(),
      authorization(),
    );

    await service.transitionCase("user-1", "case-1", {
      action: "SUSPEND_ACCOUNT",
      reason: "Verified identity evidence did not match the account.",
      evidenceSummary: "Identity document and onboarding record were compared.",
    });
    await service.decideEscalatedWarranty("user-1", "claim-1", {
      action: "RESOLVE",
      reason: "The submitted completion evidence supports remedial work.",
      evidenceSummary: "Job evidence and claim photographs were reviewed.",
    });

    expect(store.transitionCase).toHaveBeenCalledWith(
      expect.objectContaining({ actorAccountId: "account-1" }),
    );
    expect(store.decideEscalatedWarranty).toHaveBeenCalledWith(
      expect.objectContaining({ actorAccountId: "account-1" }),
    );
  });

  it("returns bounded pagination metadata", async () => {
    const store = repository();
    vi.mocked(store.listCases).mockResolvedValue({
      items: [],
      totalItems: 21,
    });
    const service = new AdministrationService(
      store,
      identity(),
      authorization(),
    );

    await expect(
      service.listCases("user-1", {
        status: "all",
        page: 2,
        pageSize: 10,
      }),
    ).resolves.toMatchObject({ totalPages: 3, page: 2, pageSize: 10 });
  });
});
