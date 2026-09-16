import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  notInArray,
  or,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import {
  engagementActivities,
  engagementConversationReads,
  engagementConversations,
  engagementMessageAttachments,
  engagementMessages,
} from "../../platform/database/schema/engagement-conversations";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  serviceRequests,
} from "../../platform/database/schema/service-requests";
import type {
  ConversationActivityItem,
  ConversationMessageItem,
  EngagementConversation,
} from "./types";

export interface ServiceRequestConversationAccess {
  requestId: string;
  actorAccountId: string;
  clientAccountId: string;
  organisationId: string;
  role: "CLIENT" | "PROFESSIONAL";
}

export interface ConversationAttachmentDeliveryRecord {
  assetId: string;
  cloudinaryPublicId: string;
  mimeType: string;
  visibility: "private";
}

export interface ConversationsStore {
  getClientAccess(
    clientAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestConversationAccess | null>;
  getProfessionalAccess(
    organisationId: string,
    actorAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestConversationAccess | null>;
  load(access: ServiceRequestConversationAccess): Promise<EngagementConversation>;
  sendMessage(input: {
    access: ServiceRequestConversationAccess;
    idempotencyKey: string;
    body: string;
    assetIds: string[];
    correlationId?: string;
  }): Promise<EngagementConversation | null>;
  markRead(input: {
    access: ServiceRequestConversationAccess;
    correlationId?: string;
  }): Promise<EngagementConversation | null>;
  getAttachment(
    access: ServiceRequestConversationAccess,
    assetId: string,
  ): Promise<ConversationAttachmentDeliveryRecord | null>;
}

export class ConversationsRepository implements ConversationsStore {
  constructor(private readonly db: Database) {}

  async getClientAccess(
    clientAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestConversationAccess | null> {
    const [request] = await this.db
      .select({
        clientAccountId: serviceRequests.clientAccountId,
        organisationId: serviceRequests.organisationId,
      })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.id, requestId),
          eq(serviceRequests.clientAccountId, clientAccountId),
          notInArray(serviceRequests.status, ["DRAFT"]),
        ),
      )
      .limit(1);
    if (!request?.organisationId) return null;
    return {
      requestId,
      actorAccountId: clientAccountId,
      clientAccountId: request.clientAccountId,
      organisationId: request.organisationId,
      role: "CLIENT",
    };
  }

  async getProfessionalAccess(
    organisationId: string,
    actorAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestConversationAccess | null> {
    const [request] = await this.db
      .select({
        clientAccountId: serviceRequests.clientAccountId,
        organisationId: serviceRequests.organisationId,
      })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.id, requestId),
          eq(serviceRequests.organisationId, organisationId),
          notInArray(serviceRequests.status, ["DRAFT"]),
        ),
      )
      .limit(1);
    if (!request?.organisationId) return null;
    return {
      requestId,
      actorAccountId,
      clientAccountId: request.clientAccountId,
      organisationId: request.organisationId,
      role: "PROFESSIONAL",
    };
  }

  async load(
    access: ServiceRequestConversationAccess,
  ): Promise<EngagementConversation> {
    const conversationId = await this.ensureConversation(access.requestId);
    const [messageRows, historyRows, readState] = await Promise.all([
      this.db
        .select({
          id: engagementMessages.id,
          senderAccountId: engagementMessages.senderAccountId,
          senderRole: engagementMessages.senderRole,
          body: engagementMessages.body,
          createdAt: engagementMessages.createdAt,
          authorDisplayName: accountProfiles.displayName,
        })
        .from(engagementMessages)
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, engagementMessages.senderAccountId),
        )
        .where(eq(engagementMessages.conversationId, conversationId))
        .orderBy(desc(engagementMessages.createdAt), desc(engagementMessages.id))
        .limit(100),
      this.db
        .select({
          id: engagementActivities.id,
          action: engagementActivities.activityType,
          summary: engagementActivities.summary,
          createdAt: engagementActivities.occurredAt,
          actorDisplayName: accountProfiles.displayName,
        })
        .from(engagementActivities)
        .leftJoin(
          accountProfiles,
          eq(accountProfiles.id, engagementActivities.actorAccountId),
        )
        .innerJoin(
          engagementConversations,
          eq(engagementConversations.id, engagementActivities.conversationId),
        )
        .where(
          and(
            eq(engagementConversations.contextType, "SERVICE_REQUEST"),
            eq(engagementConversations.contextId, access.requestId),
          ),
        ),
      this.db
        .select({ lastReadAt: engagementConversationReads.lastReadAt })
        .from(engagementConversationReads)
        .where(
          and(
            eq(engagementConversationReads.conversationId, conversationId),
            eq(engagementConversationReads.accountId, access.actorAccountId),
            eq(engagementConversationReads.participantRole, access.role),
          ),
        )
        .limit(1),
    ]);
    const messageIds = messageRows.map((message) => message.id);
    const attachmentRows =
      messageIds.length === 0
        ? []
        : await this.db
            .select({
              messageId: engagementMessageAttachments.messageId,
              id: fileAssets.id,
              mimeType: fileAssets.mimeType,
              sizeBytes: fileAssets.sizeBytes,
            })
            .from(engagementMessageAttachments)
            .innerJoin(
              fileAssets,
              eq(fileAssets.id, engagementMessageAttachments.assetId),
            )
            .where(inArray(engagementMessageAttachments.messageId, messageIds));
    const [{ unreadCount }] = await this.db
      .select({ unreadCount: count() })
      .from(engagementMessages)
      .where(
        and(
          eq(engagementMessages.conversationId, conversationId),
          or(
            ne(engagementMessages.senderAccountId, access.actorAccountId),
            ne(engagementMessages.senderRole, access.role),
          ),
          ...(readState[0]?.lastReadAt
            ? [gt(engagementMessages.createdAt, readState[0].lastReadAt)]
            : []),
        ),
      );

    const messages: ConversationMessageItem[] = messageRows.map((message) => ({
      kind: "MESSAGE",
      id: message.id,
      authorDisplayName: message.authorDisplayName,
      authorRole: message.senderRole as "CLIENT" | "PROFESSIONAL",
      isOwn:
        message.senderAccountId === access.actorAccountId &&
        message.senderRole === access.role,
      body: message.body,
      attachments: attachmentRows
        .filter((attachment) => attachment.messageId === message.id)
        .map(({ id, mimeType, sizeBytes }) => ({ id, mimeType, sizeBytes })),
      occurredAt: message.createdAt.toISOString(),
    }));
    const activities: ConversationActivityItem[] = historyRows.map((item) => ({
      kind: "ACTIVITY",
      id: item.id,
      action: item.action,
      summary: item.summary,
      actorDisplayName: item.actorDisplayName,
      occurredAt: item.createdAt.toISOString(),
    }));
    const items = [...messages, ...activities].sort(
      (left, right) =>
        new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
    );

    return {
      conversationId,
      contextType: "SERVICE_REQUEST",
      contextId: access.requestId,
      unreadCount,
      items,
      refreshedAt: new Date().toISOString(),
    };
  }

  async sendMessage(input: {
    access: ServiceRequestConversationAccess;
    idempotencyKey: string;
    body: string;
    assetIds: string[];
    correlationId?: string;
  }): Promise<EngagementConversation | null> {
    const allowed = await this.db.transaction(async (tx) => {
      const participantFilter =
        input.access.role === "CLIENT"
          ? eq(serviceRequests.clientAccountId, input.access.actorAccountId)
          : eq(serviceRequests.organisationId, input.access.organisationId);
      const [request] = await tx
        .select({ id: serviceRequests.id })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.id, input.access.requestId),
            participantFilter,
            notInArray(serviceRequests.status, ["DRAFT"]),
          ),
        )
        .limit(1);
      if (!request) return false;

      const [createdConversation] = await tx
        .insert(engagementConversations)
        .values({
          contextType: "SERVICE_REQUEST",
          contextId: input.access.requestId,
        })
        .onConflictDoNothing()
        .returning({ id: engagementConversations.id });
      const conversationId =
        createdConversation?.id ??
        (
          await tx
            .select({ id: engagementConversations.id })
            .from(engagementConversations)
            .where(
              and(
                eq(engagementConversations.contextType, "SERVICE_REQUEST"),
                eq(engagementConversations.contextId, input.access.requestId),
              ),
            )
            .limit(1)
        )[0].id;
      const [existing] = await tx
        .select({ id: engagementMessages.id })
        .from(engagementMessages)
        .where(
          and(
            eq(engagementMessages.conversationId, conversationId),
            eq(
              engagementMessages.senderAccountId,
              input.access.actorAccountId,
            ),
            eq(engagementMessages.senderRole, input.access.role),
            eq(engagementMessages.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing) return true;

      const uniqueAssetIds = [...new Set(input.assetIds)];
      if (uniqueAssetIds.length !== input.assetIds.length) return false;
      if (uniqueAssetIds.length > 0) {
        const eligibleAssets = await tx
          .select({ id: fileAssets.id })
          .from(fileAssets)
          .where(
            and(
              inArray(fileAssets.id, uniqueAssetIds),
              eq(fileAssets.ownerAccountId, input.access.actorAccountId),
              eq(fileAssets.purpose, "MESSAGE_ATTACHMENT"),
              eq(fileAssets.visibility, "private"),
              eq(fileAssets.status, "ready"),
              isNull(fileAssets.linkedEntityType),
              isNull(fileAssets.linkedEntityId),
            ),
          );
        if (eligibleAssets.length !== uniqueAssetIds.length) return false;
      }

      const [message] = await tx
        .insert(engagementMessages)
        .values({
          conversationId,
          senderAccountId: input.access.actorAccountId,
          senderRole: input.access.role,
          idempotencyKey: input.idempotencyKey,
          body: input.body,
        })
        .onConflictDoNothing()
        .returning({ id: engagementMessages.id, createdAt: engagementMessages.createdAt });
      if (!message) return true;

      if (uniqueAssetIds.length > 0) {
        await tx.insert(engagementMessageAttachments).values(
          uniqueAssetIds.map((assetId) => ({
            messageId: message.id,
            assetId,
            addedByAccountId: input.access.actorAccountId,
          })),
        );
        await tx
          .update(fileAssets)
          .set({
            linkedEntityType: "conversation_message",
            linkedEntityId: message.id,
            updatedAt: message.createdAt,
          })
          .where(inArray(fileAssets.id, uniqueAssetIds));
      }
      await tx.insert(outboxEvents).values([
        {
          eventType: "message.sent",
          eventVersion: 1,
          aggregateType: "engagement_conversation",
          aggregateId: conversationId,
          organisationId: input.access.organisationId,
          actorAccountId: input.access.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            messageId: message.id,
            contextType: "SERVICE_REQUEST",
            contextId: input.access.requestId,
          },
        },
        ...uniqueAssetIds.map((assetId) => ({
          eventType: "attachment.added",
          eventVersion: 1,
          aggregateType: "engagement_conversation",
          aggregateId: conversationId,
          organisationId: input.access.organisationId,
          actorAccountId: input.access.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            messageId: message.id,
            assetId,
            contextType: "SERVICE_REQUEST",
            contextId: input.access.requestId,
          },
        })),
      ]);
      await tx
        .update(engagementConversations)
        .set({ updatedAt: message.createdAt })
        .where(eq(engagementConversations.id, conversationId));
      return true;
    });
    return allowed ? this.load(input.access) : null;
  }

  async markRead(input: {
    access: ServiceRequestConversationAccess;
    correlationId?: string;
  }): Promise<EngagementConversation | null> {
    const conversationId = await this.ensureConversation(input.access.requestId);
    const now = new Date();
    await this.db.transaction(async (tx) => {
      const [readState] = await tx
        .select({ lastReadAt: engagementConversationReads.lastReadAt })
        .from(engagementConversationReads)
        .where(
          and(
            eq(engagementConversationReads.conversationId, conversationId),
            eq(
              engagementConversationReads.accountId,
              input.access.actorAccountId,
            ),
            eq(
              engagementConversationReads.participantRole,
              input.access.role,
            ),
          ),
        )
        .limit(1);
      const [{ unreadCount }] = await tx
        .select({ unreadCount: count() })
        .from(engagementMessages)
        .where(
          and(
            eq(engagementMessages.conversationId, conversationId),
            or(
              ne(
                engagementMessages.senderAccountId,
                input.access.actorAccountId,
              ),
              ne(engagementMessages.senderRole, input.access.role),
            ),
            ...(readState?.lastReadAt
              ? [gt(engagementMessages.createdAt, readState.lastReadAt)]
              : []),
          ),
        );
      await tx
        .insert(engagementConversationReads)
        .values({
          conversationId,
          accountId: input.access.actorAccountId,
          participantRole: input.access.role,
          lastReadAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            engagementConversationReads.conversationId,
            engagementConversationReads.accountId,
            engagementConversationReads.participantRole,
          ],
          set: { lastReadAt: now, updatedAt: now },
        });
      if (unreadCount > 0) {
        await tx.insert(outboxEvents).values({
          eventType: "message.read",
          eventVersion: 1,
          aggregateType: "engagement_conversation",
          aggregateId: conversationId,
          organisationId: input.access.organisationId,
          actorAccountId: input.access.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            unreadCount,
            contextType: "SERVICE_REQUEST",
            contextId: input.access.requestId,
            readAt: now.toISOString(),
          },
        });
      }
    });
    return this.load(input.access);
  }

  async getAttachment(
    access: ServiceRequestConversationAccess,
    assetId: string,
  ): Promise<ConversationAttachmentDeliveryRecord | null> {
    const [asset] = await this.db
      .select({
        assetId: fileAssets.id,
        cloudinaryPublicId: fileAssets.cloudinaryPublicId,
        mimeType: fileAssets.mimeType,
        visibility: fileAssets.visibility,
      })
      .from(engagementMessageAttachments)
      .innerJoin(
        engagementMessages,
        eq(engagementMessages.id, engagementMessageAttachments.messageId),
      )
      .innerJoin(
        engagementConversations,
        eq(engagementConversations.id, engagementMessages.conversationId),
      )
      .innerJoin(
        fileAssets,
        eq(fileAssets.id, engagementMessageAttachments.assetId),
      )
      .where(
        and(
          eq(fileAssets.id, assetId),
          eq(fileAssets.status, "ready"),
          eq(fileAssets.visibility, "private"),
          eq(engagementConversations.contextType, "SERVICE_REQUEST"),
          eq(engagementConversations.contextId, access.requestId),
        ),
      )
      .limit(1);
    return asset?.visibility === "private"
      ? { ...asset, visibility: "private" }
      : null;
  }

  private async ensureConversation(requestId: string): Promise<string> {
    const [created] = await this.db
      .insert(engagementConversations)
      .values({ contextType: "SERVICE_REQUEST", contextId: requestId })
      .onConflictDoNothing()
      .returning({ id: engagementConversations.id });
    if (created) return created.id;
    const [existing] = await this.db
      .select({ id: engagementConversations.id })
      .from(engagementConversations)
      .where(
        and(
          eq(engagementConversations.contextType, "SERVICE_REQUEST"),
          eq(engagementConversations.contextId, requestId),
        ),
      )
      .limit(1);
    return existing.id;
  }
}
