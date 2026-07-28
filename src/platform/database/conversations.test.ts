import { and, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ConversationsRepository } from "../../modules/conversations/repository";
import { accountProfiles } from "./schema/account-profiles";
import {
  engagementActivities,
  engagementConversationReads,
  engagementConversations,
  engagementMessageAttachments,
  engagementMessages,
} from "./schema/engagement-conversations";
import { fileAssets } from "./schema/file-assets";
import { organisations } from "./schema/organisations";
import { outboxEvents } from "./schema/outbox-events";
import {
  serviceRequestHistory,
  serviceRequests,
} from "./schema/service-requests";
import { withTestDatabase } from "./testing/helpers";

describe("engagement conversation persistence", () => {
  it("keeps participant messages, unread state, attachments, and activity scoped and idempotent", async () => {
    await withTestDatabase(async ({ db }) => {
      const marker = crypto.randomUUID();
      const accounts = await db
        .insert(accountProfiles)
        .values([
          {
            authUserId: `conversation-client-${marker}`,
            displayName: "Conversation Client",
            primaryEmail: `conversation-client-${marker}@example.com`,
          },
          {
            authUserId: `conversation-other-${marker}`,
            displayName: "Unrelated Client",
            primaryEmail: `conversation-other-${marker}@example.com`,
          },
          {
            authUserId: `conversation-pro-${marker}`,
            displayName: "Conversation Professional",
            primaryEmail: `conversation-pro-${marker}@example.com`,
          },
        ])
        .returning();
      const [client, otherAccount, professional] = accounts;
      const organisationsCreated = await db
        .insert(organisations)
        .values([
          {
            name: "Conversation Provider",
            slug: `conversation-provider-${marker}`,
            status: "active",
          },
          {
            name: "Unrelated Provider",
            slug: `conversation-other-provider-${marker}`,
            status: "active",
          },
        ])
        .returning();
      const [organisation, otherOrganisation] = organisationsCreated;
      const [request] = await db
        .insert(serviceRequests)
        .values({
          clientAccountId: client.id,
          organisationId: organisation.id,
          idempotencyKey: crypto.randomUUID(),
          source: "PROFESSIONAL_BOOKING_LINK",
          status: "SUBMITTED",
          submittedAt: new Date(),
        })
        .returning();
      const history = await db
        .insert(serviceRequestHistory)
        .values([
          {
            requestId: request.id,
            actorAccountId: client.id,
            action: "SUBMITTED",
            fromStatus: "DRAFT",
            toStatus: "SUBMITTED",
          },
          {
            requestId: request.id,
            actorAccountId: professional.id,
            action: "PRIVATE_NOTE_ADDED",
            fromStatus: "SUBMITTED",
            toStatus: "SUBMITTED",
            privateProfessionalNote: "This must never appear in chat.",
          },
        ])
        .returning();
      const [seededConversation] = await db
        .insert(engagementConversations)
        .values({ contextType: "SERVICE_REQUEST", contextId: request.id })
        .returning();
      await db.insert(engagementActivities).values({
        conversationId: seededConversation.id,
        sourceType: "SERVICE_REQUEST_HISTORY",
        sourceId: history[0].id,
        activityType: "SUBMITTED",
        actorAccountId: client.id,
        summary: "Submitted. Status changed from draft to submitted.",
        metadata: { fromStatus: "DRAFT", toStatus: "SUBMITTED" },
        occurredAt: history[0].createdAt,
      });
      const assets = await db
        .insert(fileAssets)
        .values([
          {
            cloudinaryPublicId: `messages/client-${marker}`,
            purpose: "MESSAGE_ATTACHMENT",
            mimeType: "image/png",
            sizeBytes: 1_024,
            visibility: "private",
            ownerAccountId: client.id,
            status: "ready",
          },
          {
            cloudinaryPublicId: `messages/pro-${marker}`,
            purpose: "MESSAGE_ATTACHMENT",
            mimeType: "application/pdf",
            sizeBytes: 2_048,
            visibility: "private",
            ownerAccountId: professional.id,
            status: "ready",
          },
          {
            cloudinaryPublicId: `messages/other-${marker}`,
            purpose: "MESSAGE_ATTACHMENT",
            mimeType: "image/jpeg",
            sizeBytes: 512,
            visibility: "private",
            ownerAccountId: otherAccount.id,
            status: "ready",
          },
        ])
        .returning();
      const [clientAsset, professionalAsset, unrelatedAsset] = assets;
      const repository = new ConversationsRepository(db);

      try {
        const clientAccess = await repository.getClientAccess(
          client.id,
          request.id,
        );
        const professionalAccess = await repository.getProfessionalAccess(
          organisation.id,
          professional.id,
          request.id,
        );
        expect(clientAccess).not.toBeNull();
        expect(professionalAccess).not.toBeNull();
        await expect(
          repository.getClientAccess(otherAccount.id, request.id),
        ).resolves.toBeNull();
        await expect(
          repository.getProfessionalAccess(
            otherOrganisation.id,
            professional.id,
            request.id,
          ),
        ).resolves.toBeNull();

        const idempotencyKey = crypto.randomUUID();
        const first = await repository.sendMessage({
          access: clientAccess!,
          idempotencyKey,
          body: "The stop valve is beside the kitchen cabinet.",
          assetIds: [clientAsset.id],
          correlationId: `conversation-${marker}`,
        });
        const retry = await repository.sendMessage({
          access: clientAccess!,
          idempotencyKey,
          body: "A retry must not create another message.",
          assetIds: [clientAsset.id],
          correlationId: `conversation-${marker}`,
        });
        expect(
          first?.items.filter((item) => item.kind === "MESSAGE"),
        ).toHaveLength(1);
        expect(
          retry?.items.filter((item) => item.kind === "MESSAGE"),
        ).toHaveLength(1);
        expect(
          retry?.items.some(
            (item) =>
              item.kind === "ACTIVITY" && item.action === "SUBMITTED",
          ),
        ).toBe(true);
        expect(
          retry?.items.some((item) =>
            item.kind === "ACTIVITY"
              ? item.summary.includes("must never appear")
              : item.body.includes("must never appear"),
          ),
        ).toBe(false);

        const professionalBeforeRead = await repository.load(
          professionalAccess!,
        );
        expect(professionalBeforeRead.unreadCount).toBe(1);
        const professionalAfterRead = await repository.markRead({
          access: professionalAccess!,
          correlationId: `conversation-read-${marker}`,
        });
        expect(professionalAfterRead?.unreadCount).toBe(0);
        await repository.markRead({
          access: professionalAccess!,
          correlationId: `conversation-read-retry-${marker}`,
        });

        await repository.sendMessage({
          access: professionalAccess!,
          idempotencyKey: crypto.randomUUID(),
          body: "Thanks. I can assess this tomorrow morning.",
          assetIds: [professionalAsset.id],
          correlationId: `conversation-reply-${marker}`,
        });
        const sameAccountProfessionalAccess =
          await repository.getProfessionalAccess(
            organisation.id,
            client.id,
            request.id,
          );
        const sameAccountProfessionalView = await repository.load(
          sameAccountProfessionalAccess!,
        );
        expect(
          sameAccountProfessionalView.items.find(
            (item) =>
              item.kind === "MESSAGE" &&
              item.body === "The stop valve is beside the kitchen cabinet.",
          ),
        ).toMatchObject({
          authorRole: "CLIENT",
          isOwn: false,
        });
        await repository.sendMessage({
          access: sameAccountProfessionalAccess!,
          idempotencyKey: crypto.randomUUID(),
          body: "I am responding from my professional workspace.",
          assetIds: [],
          correlationId: `conversation-multi-role-${marker}`,
        });
        const clientBeforeRead = await repository.load(clientAccess!);
        expect(clientBeforeRead.unreadCount).toBe(2);
        expect(
          clientBeforeRead.items.find(
            (item) =>
              item.kind === "MESSAGE" &&
              item.body ===
                "I am responding from my professional workspace.",
          ),
        ).toMatchObject({
          authorRole: "PROFESSIONAL",
          isOwn: false,
        });
        expect(
          await repository.getAttachment(clientAccess!, professionalAsset.id),
        ).toMatchObject({
          assetId: professionalAsset.id,
          visibility: "private",
        });

        await expect(
          repository.sendMessage({
            access: clientAccess!,
            idempotencyKey: crypto.randomUUID(),
            body: "This attachment belongs to someone else.",
            assetIds: [unrelatedAsset.id],
          }),
        ).resolves.toBeNull();

        await db
          .update(accountProfiles)
          .set({ status: "deactivated" })
          .where(eq(accountProfiles.id, professional.id));
        const preserved = await repository.load(clientAccess!);
        expect(
          preserved.items.some(
            (item) =>
              item.kind === "MESSAGE" &&
              item.authorDisplayName === "Conversation Professional",
          ),
        ).toBe(true);

        const [conversation] = await db
          .select({ id: engagementConversations.id })
          .from(engagementConversations)
          .where(
            and(
              eq(engagementConversations.contextType, "SERVICE_REQUEST"),
              eq(engagementConversations.contextId, request.id),
            ),
          );
        const messages = await db
          .select()
          .from(engagementMessages)
          .where(eq(engagementMessages.conversationId, conversation.id));
        expect(messages).toHaveLength(3);
        const events = await db
          .select()
          .from(outboxEvents)
          .where(eq(outboxEvents.aggregateId, conversation.id));
        expect(
          events.filter((event) => event.eventType === "message.sent"),
        ).toHaveLength(3);
        expect(
          events.filter((event) => event.eventType === "message.read"),
        ).toHaveLength(1);
        expect(
          events.filter((event) => event.eventType === "attachment.added"),
        ).toHaveLength(2);
      } finally {
        const conversations = await db
          .select({ id: engagementConversations.id })
          .from(engagementConversations)
          .where(eq(engagementConversations.contextId, request.id));
        const conversationIds = conversations.map((item) => item.id);
        if (conversationIds.length > 0) {
          const messages = await db
            .select({ id: engagementMessages.id })
            .from(engagementMessages)
            .where(inArray(engagementMessages.conversationId, conversationIds));
          const messageIds = messages.map((item) => item.id);
          await db
            .delete(engagementConversationReads)
            .where(
              inArray(
                engagementConversationReads.conversationId,
                conversationIds,
              ),
            );
          if (messageIds.length > 0) {
            await db
              .delete(engagementMessageAttachments)
              .where(
                inArray(engagementMessageAttachments.messageId, messageIds),
              );
          }
          await db
            .delete(engagementActivities)
            .where(
              inArray(engagementActivities.conversationId, conversationIds),
            );
          await db
            .delete(engagementMessages)
            .where(inArray(engagementMessages.conversationId, conversationIds));
          await db
            .delete(outboxEvents)
            .where(inArray(outboxEvents.aggregateId, conversationIds));
          await db
            .delete(engagementConversations)
            .where(inArray(engagementConversations.id, conversationIds));
        }
        await db
          .delete(serviceRequestHistory)
          .where(eq(serviceRequestHistory.requestId, request.id));
        await db
          .delete(serviceRequests)
          .where(eq(serviceRequests.id, request.id));
        await db
          .delete(fileAssets)
          .where(inArray(fileAssets.id, assets.map((asset) => asset.id)));
        await db
          .delete(organisations)
          .where(
            inArray(
              organisations.id,
              organisationsCreated.map((item) => item.id),
            ),
          );
        await db
          .delete(accountProfiles)
          .where(inArray(accountProfiles.id, accounts.map((item) => item.id)));
      }
    });
  }, 180_000);
});
