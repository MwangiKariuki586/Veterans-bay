import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type { QuotationsStore } from "./repository";
import { QuotationsService } from "./service";
import type {
  QuotationDetail,
  QuotationDraftValues,
} from "./types";

const clientAccountId = "00000000-0000-4000-8000-000000000001";

function identityStore(): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: clientAccountId,
      authUserId: "auth-client",
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
  };
}

function values(): QuotationDraftValues {
  return {
    currency: "KES",
    lineItems: [
      {
        category: "LABOUR",
        description: "Install replacement valve",
        quantity: 2,
        unitPriceMinor: 5_000,
      },
      {
        category: "MATERIAL",
        description: "Replacement valve",
        quantity: 1,
        unitPriceMinor: 3_000,
      },
    ],
    discountMinor: 500,
    taxMinor: 1_400,
    depositMinor: 5_000,
    expectedDurationMinutes: 180,
    proposedStartAt: null,
    validUntil: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1_000,
    ).toISOString(),
    scope: "Replace the failed valve and test the repaired connection.",
    exclusions: "Unrelated pipework is excluded.",
    warrantyTerms: "A 90-day workmanship warranty applies.",
    paymentTerms: "Deposit on acceptance and balance after completion.",
  };
}

function detail(
  overrides: Partial<QuotationDetail> = {},
): QuotationDetail {
  const draftValues = values();
  return {
    id: "00000000-0000-4000-8000-000000000020",
    requestId: "00000000-0000-4000-8000-000000000010",
    organisationId: "00000000-0000-4000-8000-000000000030",
    clientAccountId,
    status: "DRAFT",
    currentVersionNumber: 1,
    acceptedVersionNumber: null,
    lockVersion: 1,
    providerName: "Provider",
    clientName: "Client",
    requestCategory: "Plumbing",
    currentTotalMinor: 13_900,
    currency: "KES",
    validUntil: draftValues.validUntil,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bookingId: null,
    versions: [
      {
        id: "00000000-0000-4000-8000-000000000040",
        versionNumber: 1,
        status: "DRAFT",
        currency: "KES",
        lineItems: draftValues.lineItems.map((item, index) => ({
          id: `line-${index}`,
          ...item,
          totalMinor: item.quantity * item.unitPriceMinor,
          position: index,
        })),
        labourMinor: 10_000,
        materialsMinor: 3_000,
        transportMinor: 0,
        additionalChargesMinor: 0,
        subtotalMinor: 13_000,
        discountMinor: 500,
        taxMinor: 1_400,
        totalMinor: 13_900,
        depositMinor: 5_000,
        expectedDurationMinutes: draftValues.expectedDurationMinutes,
        proposedStartAt: null,
        validUntil: draftValues.validUntil,
        scope: draftValues.scope,
        exclusions: draftValues.exclusions,
        warrantyTerms: draftValues.warrantyTerms,
        paymentTerms: draftValues.paymentTerms,
        submittedAt: null,
        viewedAt: null,
        respondedAt: null,
        replacedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    history: [],
    ...overrides,
  };
}

function store(overrides: Partial<QuotationsStore> = {}): QuotationsStore {
  return {
    listProfessional: vi.fn(),
    listClient: vi.fn(),
    getProfessional: vi.fn().mockResolvedValue(detail()),
    getClient: vi.fn().mockResolvedValue(
      detail({
        status: "VIEWED",
        lockVersion: 2,
      }),
    ),
    createDraft: vi.fn().mockResolvedValue(detail()),
    updateDraft: vi.fn().mockResolvedValue(detail({ lockVersion: 2 })),
    submit: vi
      .fn()
      .mockResolvedValue(detail({ status: "SUBMITTED", lockVersion: 2 })),
    createRevision: vi.fn().mockResolvedValue(detail()),
    markViewed: vi.fn().mockResolvedValue(detail({ status: "VIEWED" })),
    clientRespond: vi.fn().mockResolvedValue(detail()),
    accept: vi
      .fn()
      .mockResolvedValue(detail({ status: "ACCEPTED", bookingId: "booking-1" })),
    expireDue: vi.fn(),
    ...overrides,
  };
}

describe("QuotationsService", () => {
  it("scopes client quotation list filters to the authenticated account", async () => {
    const listClient = vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      totalItems: 0,
      totalPages: 0,
      summary: {
        total: 0,
        awaitingDecision: 0,
        accepted: 0,
        expiringSoon: 0,
        inRevision: 0,
        closed: 0,
      },
      categories: [],
    });
    const service = new QuotationsService(store({ listClient }), identityStore());

    await service.listClient({
      authUserId: "auth-client",
      bucket: "awaiting-decision",
      category: "Plumbing",
      search: "Local Flow",
      validity: "expiring",
      sort: "valid_until_asc",
      page: 2,
      pageSize: 10,
    });

    expect(listClient).toHaveBeenCalledWith({
      clientAccountId,
      bucket: "awaiting-decision",
      category: "Plumbing",
      search: "Local Flow",
      validity: "expiring",
      sort: "valid_until_asc",
      page: 2,
      pageSize: 10,
    });
  });

  it("passes server-calculated totals into draft persistence", async () => {
    const repository = store();
    const service = new QuotationsService(repository, identityStore());
    await service.createDraft({
      organisationId: "00000000-0000-4000-8000-000000000030",
      actorAccountId: "00000000-0000-4000-8000-000000000050",
      requestId: "00000000-0000-4000-8000-000000000010",
      values: values(),
    });
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        mutation: expect.objectContaining({
          totals: expect.objectContaining({
            subtotalMinor: 13_000,
            totalMinor: 13_900,
            depositMinor: 5_000,
          }),
        }),
      }),
    );
  });

  it("rejects expired acceptance and revision requests without an explanation", async () => {
    const expired = detail({
      status: "VIEWED",
      lockVersion: 2,
      validUntil: new Date(Date.now() - 1_000).toISOString(),
    });
    expired.versions[0] = {
      ...expired.versions[0],
      status: "VIEWED",
      validUntil: expired.validUntil,
    };
    const repository = store({
      getClient: vi.fn().mockResolvedValue(expired),
    });
    const service = new QuotationsService(repository, identityStore());
    await expect(
      service.accept({
        authUserId: "auth-client",
        quotationId: expired.id,
        expectedLockVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "QUOTATION_EXPIRED", status: 409 });
    await expect(
      service.clientRespond({
        authUserId: "auth-client",
        quotationId: expired.id,
        expectedLockVersion: 2,
        action: "REVISION_REQUESTED",
      }),
    ).rejects.toMatchObject({
      code: "QUOTATION_REVISION_NOTE_REQUIRED",
      status: 422,
    });
    expect(repository.accept).not.toHaveBeenCalled();
    expect(repository.clientRespond).not.toHaveBeenCalled();
  });

  it("rejects stale current-version actions before persistence", async () => {
    const repository = store();
    const service = new QuotationsService(repository, identityStore());
    await expect(
      service.accept({
        authUserId: "auth-client",
        quotationId: detail().id,
        expectedLockVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "QUOTATION_STALE", status: 409 });
    expect(repository.accept).not.toHaveBeenCalled();
  });
});
