import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import type {
  ConversationAttachmentDeliveryRecord,
  ConversationsStore,
  ServiceRequestConversationAccess,
} from "./repository";
import type { EngagementConversation } from "./types";

export class ConversationsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: ConversationsStore,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  async getClientConversation(
    authUserId: string,
    requestId: string,
  ): Promise<EngagementConversation> {
    const access = await this.requireClientAccess(authUserId, requestId);
    return this.store.load(access);
  }

  async sendClientMessage(input: {
    authUserId: string;
    requestId: string;
    idempotencyKey: string;
    body: string;
    assetIds: string[];
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const access = await this.requireClientAccess(
      input.authUserId,
      input.requestId,
    );
    return this.send(access, input);
  }

  async markClientRead(input: {
    authUserId: string;
    requestId: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const access = await this.requireClientAccess(
      input.authUserId,
      input.requestId,
    );
    return this.markRead(access, input.correlationId);
  }

  async getClientAttachment(input: {
    authUserId: string;
    requestId: string;
    assetId: string;
  }): Promise<ConversationAttachmentDeliveryRecord> {
    const access = await this.requireClientAccess(
      input.authUserId,
      input.requestId,
    );
    return this.requireAttachment(access, input.assetId);
  }

  async getProfessionalConversation(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
  }): Promise<EngagementConversation> {
    const access = await this.requireProfessionalAccess(input);
    return this.store.load(access);
  }

  async sendProfessionalMessage(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    idempotencyKey: string;
    body: string;
    assetIds: string[];
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const access = await this.requireProfessionalAccess(input);
    return this.send(access, input);
  }

  async markProfessionalRead(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    correlationId?: string;
  }): Promise<EngagementConversation> {
    const access = await this.requireProfessionalAccess(input);
    return this.markRead(access, input.correlationId);
  }

  async getProfessionalAttachment(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    assetId: string;
  }): Promise<ConversationAttachmentDeliveryRecord> {
    const access = await this.requireProfessionalAccess(input);
    return this.requireAttachment(access, input.assetId);
  }

  private async requireClientAccess(
    authUserId: string,
    requestId: string,
  ): Promise<ServiceRequestConversationAccess> {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    const access = await this.store.getClientAccess(profile.id, requestId);
    if (!access) throw conversationUnavailable();
    return access;
  }

  private async requireProfessionalAccess(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
  }): Promise<ServiceRequestConversationAccess> {
    const access = await this.store.getProfessionalAccess(
      input.organisationId,
      input.actorAccountId,
      input.requestId,
    );
    if (!access) throw conversationUnavailable();
    return access;
  }

  private async send(
    access: ServiceRequestConversationAccess,
    input: {
      idempotencyKey: string;
      body: string;
      assetIds: string[];
      correlationId?: string;
    },
  ): Promise<EngagementConversation> {
    const conversation = await this.store.sendMessage({
      access,
      idempotencyKey: input.idempotencyKey,
      body: input.body,
      assetIds: input.assetIds,
      correlationId: input.correlationId,
    });
    if (!conversation) {
      throw new AppError({
        code: "MESSAGE_ATTACHMENT_NOT_ELIGIBLE",
        message:
          "One or more attachments are unavailable or do not belong to this sender.",
        status: 422,
      });
    }
    return conversation;
  }

  private async markRead(
    access: ServiceRequestConversationAccess,
    correlationId?: string,
  ): Promise<EngagementConversation> {
    const conversation = await this.store.markRead({ access, correlationId });
    if (!conversation) throw conversationUnavailable();
    return conversation;
  }

  private async requireAttachment(
    access: ServiceRequestConversationAccess,
    assetId: string,
  ): Promise<ConversationAttachmentDeliveryRecord> {
    const attachment = await this.store.getAttachment(access, assetId);
    if (!attachment) {
      throw new AppError({
        code: "MESSAGE_ATTACHMENT_NOT_FOUND",
        message: "The requested message attachment was not found.",
        status: 404,
      });
    }
    return attachment;
  }
}

function conversationUnavailable() {
  return new AppError({
    code: "CONVERSATION_NOT_AVAILABLE",
    message:
      "This conversation is unavailable or the request does not yet have a participating professional.",
    status: 404,
  });
}
