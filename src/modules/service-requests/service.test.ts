import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type {
  ProfessionalRequestDetailRecord,
  ServiceRequestDetailRecord,
  ServiceRequestsStore,
} from "./repository";
import { ServiceRequestsService } from "./service";

function identityStore(): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
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
  };
}

function record(
  overrides: Partial<ServiceRequestDetailRecord> = {},
): ServiceRequestDetailRecord {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    clientAccountId: "00000000-0000-4000-8000-000000000001",
    organisationId: "00000000-0000-4000-8000-000000000030",
    preferredServiceId: null,
    idempotencyKey: "00000000-0000-4000-8000-000000000020",
    source: "MARKETPLACE_DISCOVERY",
    category: "Plumbing",
    preferredProfessionalSlug: "veterans-plumbing",
    preferredProfessionalName: "Veterans Plumbing",
    preferredServiceSlug: null,
    preferredServiceName: null,
    description: "Repair a leaking kitchen sink and inspect the pipework.",
    location: "Westlands, Nairobi",
    preferredTime: "Weekday morning",
    budgetMinMinor: 5_000_00,
    budgetMaxMinor: 15_000_00,
    urgency: "SOON",
    contactPreference: "IN_APP",
    status: "DRAFT",
    version: 1,
    submittedAt: null,
    expiresAt: null,
    createdAt: new Date("2026-07-27T09:00:00.000Z"),
    updatedAt: new Date("2026-07-27T09:00:00.000Z"),
    history: [],
    attachments: [],
    ...overrides,
  };
}

function store(
  overrides: Partial<ServiceRequestsStore> = {},
): ServiceRequestsStore {
  return {
    listClient: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
    }),
    getClient: vi.fn().mockResolvedValue(record()),
    createDraft: vi.fn().mockResolvedValue(record()),
    updateDraft: vi.fn().mockResolvedValue(record({ version: 2 })),
    submit: vi.fn().mockResolvedValue(
      record({
        status: "SUBMITTED",
        version: 2,
        submittedAt: new Date("2026-07-27T09:15:00.000Z"),
      }),
    ),
    categoryIsActive: vi.fn().mockResolvedValue(true),
    listActiveCategories: vi.fn().mockResolvedValue(["Plumbing"]),
    listRequestProfessionals: vi.fn().mockResolvedValue([
      {
        slug: "veterans-plumbing",
        name: "Veterans Plumbing",
        categories: ["Plumbing"],
      },
    ]),
    attachAsset: vi.fn().mockResolvedValue(record()),
    removeAsset: vi.fn().mockResolvedValue(record()),
    cancel: vi.fn().mockResolvedValue(record({ status: "CANCELLED", version: 2 })),
    addInformation: vi.fn().mockResolvedValue(
      record({ status: "SUBMITTED", version: 2 }),
    ),
    listProfessional: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
    }),
    getProfessional: vi.fn().mockResolvedValue(null),
    professionalTransition: vi.fn().mockResolvedValue(null),
    addPrivateNote: vi.fn().mockResolvedValue(null),
    expireDue: vi.fn().mockResolvedValue({ expired: 0, requestIds: [] }),
    ...overrides,
  };
}

describe("ServiceRequestsService", () => {
  it("creates an account-scoped client draft", async () => {
    const repository = store();
    const service = new ServiceRequestsService(repository, identityStore());
    await expect(
      service.createDraft({
        authUserId: "auth-1",
        idempotencyKey: "00000000-0000-4000-8000-000000000020",
        values: {
          source: "MARKETPLACE_DISCOVERY",
          category: null,
          preferredProfessionalSlug: null,
          preferredServiceSlug: null,
          description: null,
          location: null,
          preferredTime: null,
          budgetMinMinor: null,
          budgetMaxMinor: null,
          urgency: null,
          contactPreference: null,
        },
      }),
    ).resolves.toMatchObject({ status: "DRAFT", version: 1 });
    expect(repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        clientAccountId: "00000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("rejects a client attempt to use the professional-imported source", async () => {
    const repository = store();
    await expect(
      new ServiceRequestsService(repository, identityStore()).createDraft({
        authUserId: "auth-1",
        idempotencyKey: "00000000-0000-4000-8000-000000000020",
        values: {
          source: "PROFESSIONAL_IMPORTED",
          category: null,
          preferredProfessionalSlug: null,
          preferredServiceSlug: null,
          description: null,
          location: null,
          preferredTime: null,
          budgetMinMinor: null,
          budgetMaxMinor: null,
          urgency: null,
          contactPreference: null,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST_SOURCE", status: 422 });
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it("reports every required submission field", async () => {
    const repository = store({
      getClient: vi.fn().mockResolvedValue(
        record({
          organisationId: null,
          preferredProfessionalSlug: null,
          preferredProfessionalName: null,
          category: null,
          description: "Too short",
          location: null,
          preferredTime: null,
          urgency: null,
          contactPreference: null,
        }),
      ),
    });
    await expect(
      new ServiceRequestsService(repository, identityStore()).submit({
        authUserId: "auth-1",
        requestId: "00000000-0000-4000-8000-000000000010",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_NOT_READY",
      issues: expect.arrayContaining([
        { code: "required", path: "category" },
        { code: "required", path: "preferredProfessional" },
        { code: "required", path: "description" },
        { code: "required", path: "location" },
        { code: "required", path: "preferredTime" },
      ]),
    });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("submits a complete request with optimistic version authority", async () => {
    const repository = store();
    await expect(
      new ServiceRequestsService(repository, identityStore()).submit({
        authUserId: "auth-1",
        requestId: "00000000-0000-4000-8000-000000000010",
        expectedVersion: 1,
        correlationId: "correlation-1",
      }),
    ).resolves.toMatchObject({
      status: "SUBMITTED",
      version: 2,
      submittedAt: "2026-07-27T09:15:00.000Z",
    });
    expect(repository.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: "00000000-0000-4000-8000-000000000001",
        expectedVersion: 1,
      }),
    );
  });

  it("returns an already submitted request for a safe submission retry", async () => {
    const submitted = record({ status: "SUBMITTED", version: 2 });
    const repository = store({
      getClient: vi.fn().mockResolvedValue(submitted),
    });
    await expect(
      new ServiceRequestsService(repository, identityStore()).submit({
        authUserId: "auth-1",
        requestId: submitted.id,
        expectedVersion: 1,
      }),
    ).resolves.toMatchObject({ status: "SUBMITTED", version: 2 });
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("does not reveal a request outside the authenticated client scope", async () => {
    const repository = store({
      getClient: vi.fn().mockResolvedValue(null),
    });
    await expect(
      new ServiceRequestsService(repository, identityStore()).getClient(
        "auth-1",
        "00000000-0000-4000-8000-000000000099",
      ),
    ).rejects.toMatchObject({ code: "REQUEST_NOT_FOUND", status: 404 });
  });

  it("cancels only an eligible client request at the current version", async () => {
    const repository = store();
    await expect(
      new ServiceRequestsService(repository, identityStore()).cancel({
        authUserId: "auth-1",
        requestId: "00000000-0000-4000-8000-000000000010",
        expectedVersion: 1,
        correlationId: "correlation-1",
      }),
    ).resolves.toMatchObject({ status: "CANCELLED", version: 2 });
    expect(repository.cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        clientAccountId: "00000000-0000-4000-8000-000000000001",
        expectedVersion: 1,
      }),
    );
  });

  it("keeps private professional notes out of the client contract", async () => {
    const repository = store({
      getClient: vi.fn().mockResolvedValue(
        record({
          history: [
            {
              id: "history-1",
              action: "PRIVATE_NOTE_ADDED",
              fromStatus: "UNDER_REVIEW",
              toStatus: "UNDER_REVIEW",
              note: null,
              privateProfessionalNote: "Internal risk note",
              createdAt: new Date("2026-07-27T10:00:00.000Z"),
            },
          ],
        }),
      ),
    });
    const result = await new ServiceRequestsService(
      repository,
      identityStore(),
    ).getClient("auth-1", "00000000-0000-4000-8000-000000000010");
    expect(JSON.stringify(result)).not.toContain("Internal risk note");
    expect(result.history[0]).toEqual({
      id: "history-1",
      action: "PRIVATE_NOTE_ADDED",
      fromStatus: "UNDER_REVIEW",
      toStatus: "UNDER_REVIEW",
      note: null,
      createdAt: "2026-07-27T10:00:00.000Z",
    });
  });

  it("requires a client-visible reason for professional clarification", async () => {
    const professional = {
      ...record({ status: "UNDER_REVIEW" }),
      clientDisplayName: "Client",
      clientPrimaryEmail: "client@example.com",
      clientPhone: null,
    } satisfies ProfessionalRequestDetailRecord;
    const repository = store({
      getProfessional: vi.fn().mockResolvedValue(professional),
    });
    await expect(
      new ServiceRequestsService(repository, identityStore()).professionalTransition(
        {
          organisationId: "organisation-1",
          requestId: professional.id,
          actorAccountId: "account-2",
          expectedVersion: 1,
          action: "request-information",
        },
      ),
    ).rejects.toMatchObject({
      code: "REQUEST_NOTE_REQUIRED",
      issues: [{ code: "required", path: "note" }],
    });
    expect(repository.professionalTransition).not.toHaveBeenCalled();
  });

  it("returns private notes only in the organisation-scoped professional contract", async () => {
    const professional = {
      ...record({
        status: "UNDER_REVIEW",
        history: [
          {
            id: "history-1",
            action: "PRIVATE_NOTE_ADDED",
            fromStatus: "UNDER_REVIEW",
            toStatus: "UNDER_REVIEW",
            note: null,
            privateProfessionalNote: "Call before quoting",
            createdAt: new Date("2026-07-27T10:00:00.000Z"),
          },
        ],
      }),
      clientDisplayName: "Client",
      clientPrimaryEmail: "client@example.com",
      clientPhone: null,
    } satisfies ProfessionalRequestDetailRecord;
    const repository = store({
      getProfessional: vi.fn().mockResolvedValue(professional),
    });
    await expect(
      new ServiceRequestsService(repository, identityStore()).getProfessional(
        "organisation-1",
        professional.id,
      ),
    ).resolves.toMatchObject({
      conversionEligible: true,
      history: [
        expect.objectContaining({
          privateProfessionalNote: "Call before quoting",
        }),
      ],
    });
  });
});
