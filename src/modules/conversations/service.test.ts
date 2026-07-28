import { describe, expect, it, vi } from "vitest";

import type { IdentityStore } from "../identity/repository";
import type {
  ConversationsStore,
  ServiceRequestConversationAccess,
} from "./repository";
import { ConversationsService } from "./service";

const access: ServiceRequestConversationAccess = {
  requestId: "00000000-0000-4000-8000-000000000010",
  actorAccountId: "00000000-0000-4000-8000-000000000001",
  clientAccountId: "00000000-0000-4000-8000-000000000001",
  organisationId: "00000000-0000-4000-8000-000000000020",
  role: "CLIENT",
};

const conversation = {
  conversationId: "00000000-0000-4000-8000-000000000030",
  contextType: "SERVICE_REQUEST" as const,
  contextId: access.requestId,
  unreadCount: 0,
  items: [],
  refreshedAt: "2026-07-27T12:00:00.000Z",
};

function identityStore(): IdentityStore {
  return {
    reconcileProfile: vi.fn(),
    findProfileByAuthUserId: vi.fn().mockResolvedValue({
      id: access.actorAccountId,
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

function store(overrides: Partial<ConversationsStore> = {}): ConversationsStore {
  return {
    getClientAccess: vi.fn().mockResolvedValue(access),
    getProfessionalAccess: vi.fn().mockResolvedValue({
      ...access,
      actorAccountId: "00000000-0000-4000-8000-000000000002",
      role: "PROFESSIONAL",
    }),
    load: vi.fn().mockResolvedValue(conversation),
    sendMessage: vi.fn().mockResolvedValue(conversation),
    markRead: vi.fn().mockResolvedValue(conversation),
    getAttachment: vi.fn().mockResolvedValue({
      assetId: "00000000-0000-4000-8000-000000000040",
      cloudinaryPublicId: "messages/file",
      mimeType: "image/png",
      visibility: "private",
    }),
    ...overrides,
  };
}

describe("ConversationsService", () => {
  it("loads a client conversation only after active-account participation is resolved", async () => {
    const repository = store();
    const service = new ConversationsService(repository, identityStore());

    await expect(
      service.getClientConversation("auth-client", access.requestId),
    ).resolves.toEqual(conversation);
    expect(repository.getClientAccess).toHaveBeenCalledWith(
      access.actorAccountId,
      access.requestId,
    );
  });

  it("rejects unavailable or unrelated request contexts", async () => {
    const service = new ConversationsService(
      store({ getClientAccess: vi.fn().mockResolvedValue(null) }),
      identityStore(),
    );

    await expect(
      service.getClientConversation("auth-client", access.requestId),
    ).rejects.toMatchObject({
      code: "CONVERSATION_NOT_AVAILABLE",
      status: 404,
    });
  });

  it("delegates an idempotent send with trusted participant identity", async () => {
    const repository = store();
    const service = new ConversationsService(repository, identityStore());
    const idempotencyKey = "00000000-0000-4000-8000-000000000050";

    await service.sendClientMessage({
      authUserId: "auth-client",
      requestId: access.requestId,
      idempotencyKey,
      body: "Please confirm the arrival window.",
      assetIds: [],
      correlationId: "request-1",
    });
    expect(repository.sendMessage).toHaveBeenCalledWith({
      access,
      idempotencyKey,
      body: "Please confirm the arrival window.",
      assetIds: [],
      correlationId: "request-1",
    });
  });

  it("maps ineligible attachments to a safe validation error", async () => {
    const service = new ConversationsService(
      store({ sendMessage: vi.fn().mockResolvedValue(null) }),
      identityStore(),
    );

    await expect(
      service.sendClientMessage({
        authUserId: "auth-client",
        requestId: access.requestId,
        idempotencyKey: "00000000-0000-4000-8000-000000000050",
        body: "See attachment.",
        assetIds: ["00000000-0000-4000-8000-000000000060"],
      }),
    ).rejects.toMatchObject({
      code: "MESSAGE_ATTACHMENT_NOT_ELIGIBLE",
      status: 422,
    });
  });

  it("uses organisation participation for professional reads", async () => {
    const repository = store();
    const service = new ConversationsService(repository, identityStore());

    await service.getProfessionalConversation({
      organisationId: access.organisationId,
      actorAccountId: "00000000-0000-4000-8000-000000000002",
      requestId: access.requestId,
    });
    expect(repository.getProfessionalAccess).toHaveBeenCalledWith(
      access.organisationId,
      "00000000-0000-4000-8000-000000000002",
      access.requestId,
    );
  });
});
