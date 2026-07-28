import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  lte,
  notInArray,
  sql,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import {
  engagementActivities,
  engagementConversations,
} from "../../platform/database/schema/engagement-conversations";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { marketplaceCategories } from "../../platform/database/schema/marketplace-moderation";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalServices } from "../../platform/database/schema/professional-services";
import {
  serviceRequestAttachments,
  serviceRequestHistory,
  serviceRequests,
} from "../../platform/database/schema/service-requests";
import { buildPageResult, paginationOffset, type PageResult } from "../../platform/http/pagination";
import type {
  ServiceRequestAttachment,
  ServiceRequestHistoryItem,
  ServiceRequestSource,
  ServiceRequestStatus,
  ServiceRequestValues,
} from "./types";
import {
  expirableServiceRequestStatuses,
  nextServiceRequestExpiry,
  statusUsesInactivityExpiry,
} from "./expiry-policy";

export interface ServiceRequestRecord extends ServiceRequestValues {
  id: string;
  clientAccountId: string;
  organisationId: string | null;
  preferredServiceId: string | null;
  idempotencyKey: string;
  status: ServiceRequestStatus;
  version: number;
  preferredProfessionalName: string | null;
  preferredServiceName: string | null;
  submittedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceRequestDetailRecord extends ServiceRequestRecord {
  history: Array<
    Omit<ServiceRequestHistoryItem, "createdAt"> & {
      createdAt: Date;
      privateProfessionalNote: string | null;
    }
  >;
  attachments: Array<Omit<ServiceRequestAttachment, "createdAt"> & { createdAt: Date }>;
}

export interface ProfessionalRequestDetailRecord
  extends ServiceRequestDetailRecord {
  clientDisplayName: string;
  clientPrimaryEmail: string;
  clientPhone: string | null;
}

export interface ServiceRequestsStore {
  listClient(input: {
    clientAccountId: string;
    status?: ServiceRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ServiceRequestRecord>>;
  getClient(
    clientAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestDetailRecord | null>;
  createDraft(input: {
    clientAccountId: string;
    idempotencyKey: string;
    values: ServiceRequestValues;
  }): Promise<ServiceRequestDetailRecord>;
  updateDraft(input: {
    clientAccountId: string;
    requestId: string;
    expectedVersion: number;
    values: Partial<ServiceRequestValues>;
  }): Promise<ServiceRequestDetailRecord | null>;
  submit(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ServiceRequestDetailRecord | null>;
  categoryIsActive(category: string): Promise<boolean>;
  listActiveCategories(): Promise<string[]>;
  attachAsset(input: {
    clientAccountId: string;
    requestId: string;
    assetId: string;
  }): Promise<ServiceRequestDetailRecord | null>;
  removeAsset(input: {
    clientAccountId: string;
    requestId: string;
    attachmentId: string;
  }): Promise<ServiceRequestDetailRecord | null>;
  cancel(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ServiceRequestDetailRecord | null>;
  addInformation(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    note: string;
    correlationId?: string;
  }): Promise<ServiceRequestDetailRecord | null>;
  listProfessional(input: {
    organisationId: string;
    status?: ServiceRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ServiceRequestRecord>>;
  getProfessional(
    organisationId: string,
    requestId: string,
  ): Promise<ProfessionalRequestDetailRecord | null>;
  professionalTransition(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    fromStatuses: ServiceRequestStatus[];
    toStatus: ServiceRequestStatus;
    action: string;
    note?: string;
    eventType?: string;
    correlationId?: string;
  }): Promise<ProfessionalRequestDetailRecord | null>;
  addPrivateNote(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    note: string;
  }): Promise<ProfessionalRequestDetailRecord | null>;
  expireDue(input: {
    now: Date;
    limit: number;
  }): Promise<{ expired: number; requestIds: string[] }>;
}

const requestSelection = {
  id: serviceRequests.id,
  clientAccountId: serviceRequests.clientAccountId,
  organisationId: serviceRequests.organisationId,
  preferredServiceId: serviceRequests.preferredServiceId,
  idempotencyKey: serviceRequests.idempotencyKey,
  source: serviceRequests.source,
  category: serviceRequests.category,
  description: serviceRequests.description,
  location: serviceRequests.location,
  preferredTime: serviceRequests.preferredTime,
  budgetMinMinor: serviceRequests.budgetMinMinor,
  budgetMaxMinor: serviceRequests.budgetMaxMinor,
  urgency: serviceRequests.urgency,
  contactPreference: serviceRequests.contactPreference,
  status: serviceRequests.status,
  version: serviceRequests.version,
  preferredProfessionalSlug: organisations.slug,
  preferredProfessionalName: organisations.name,
  preferredServiceSlug: professionalServices.slug,
  preferredServiceName: professionalServices.name,
  submittedAt: serviceRequests.submittedAt,
  expiresAt: serviceRequests.expiresAt,
  createdAt: serviceRequests.createdAt,
  updatedAt: serviceRequests.updatedAt,
};

type SelectedRequest = Omit<
  ServiceRequestRecord,
  | "source"
  | "status"
  | "urgency"
  | "contactPreference"
  | "history"
  | "attachments"
> & {
  source: string;
  status: string;
  urgency: string | null;
  contactPreference: string | null;
};

export class ServiceRequestsRepository implements ServiceRequestsStore {
  constructor(private readonly db: Database) {}

  private selectBase() {
    return this.db
      .select(requestSelection)
      .from(serviceRequests)
      .leftJoin(
        organisations,
        eq(organisations.id, serviceRequests.organisationId),
      )
      .leftJoin(
        professionalServices,
        eq(professionalServices.id, serviceRequests.preferredServiceId),
      );
  }

  private mapRecord(record: SelectedRequest): ServiceRequestRecord {
    return {
      ...record,
      source: record.source as ServiceRequestSource,
      status: record.status as ServiceRequestStatus,
      urgency: record.urgency as ServiceRequestValues["urgency"],
      contactPreference:
        record.contactPreference as ServiceRequestValues["contactPreference"],
    };
  }

  private async selectClientRecord(
    clientAccountId: string,
    requestId: string,
  ) {
    const [record] = await this.selectBase()
      .where(
        and(
          eq(serviceRequests.id, requestId),
          eq(serviceRequests.clientAccountId, clientAccountId),
        ),
      )
      .limit(1);
    return record ?? null;
  }

  private async detail(
    clientAccountId: string,
    requestId: string,
  ): Promise<ServiceRequestDetailRecord | null> {
    const record = await this.selectClientRecord(clientAccountId, requestId);
    if (!record) return null;
    const [history, attachments] = await Promise.all([
      this.db
        .select({
          id: serviceRequestHistory.id,
          action: serviceRequestHistory.action,
          fromStatus: serviceRequestHistory.fromStatus,
          toStatus: serviceRequestHistory.toStatus,
          note: serviceRequestHistory.clientVisibleNote,
          privateProfessionalNote: serviceRequestHistory.privateProfessionalNote,
          createdAt: serviceRequestHistory.createdAt,
        })
        .from(serviceRequestHistory)
        .where(eq(serviceRequestHistory.requestId, requestId))
        .orderBy(serviceRequestHistory.createdAt, serviceRequestHistory.id),
      this.db
        .select({
          id: serviceRequestAttachments.id,
          assetId: serviceRequestAttachments.assetId,
          mimeType: fileAssets.mimeType,
          sizeBytes: fileAssets.sizeBytes,
          createdAt: serviceRequestAttachments.createdAt,
        })
        .from(serviceRequestAttachments)
        .innerJoin(fileAssets, eq(fileAssets.id, serviceRequestAttachments.assetId))
        .where(eq(serviceRequestAttachments.requestId, requestId))
        .orderBy(serviceRequestAttachments.createdAt),
    ]);
    return {
      ...this.mapRecord(record),
      history: history.map((item) => ({
        ...item,
        fromStatus: item.fromStatus as ServiceRequestStatus | null,
        toStatus: item.toStatus as ServiceRequestStatus,
      })),
      attachments,
    };
  }

  async cancel(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }) {
    return this.clientTransition({
      ...input,
      fromStatuses: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "MORE_INFORMATION_REQUIRED",
        "ASSESSMENT_REQUIRED",
      ],
      toStatus: "CANCELLED",
      action: "CANCELLED",
      eventType: "service_request.cancelled",
    });
  }

  async addInformation(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    note: string;
    correlationId?: string;
  }) {
    return this.clientTransition({
      ...input,
      fromStatuses: ["MORE_INFORMATION_REQUIRED"],
      toStatus: "SUBMITTED",
      action: "INFORMATION_ADDED",
      eventType: "service_request.updated",
    });
  }

  async listProfessional(input: {
    organisationId: string;
    status?: ServiceRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ServiceRequestRecord>> {
    const filters = [
      eq(serviceRequests.organisationId, input.organisationId),
      notInArray(serviceRequests.status, ["DRAFT"]),
      ...(input.status ? [eq(serviceRequests.status, input.status)] : []),
    ];
    const [items, [{ total }]] = await Promise.all([
      this.selectBase()
        .where(and(...filters))
        .orderBy(desc(serviceRequests.updatedAt), desc(serviceRequests.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db
        .select({ total: count() })
        .from(serviceRequests)
        .where(and(...filters)),
    ]);
    return buildPageResult(
      items.map((item) => this.mapRecord(item)),
      total,
      input,
    );
  }

  async getProfessional(
    organisationId: string,
    requestId: string,
  ): Promise<ProfessionalRequestDetailRecord | null> {
    const detail = await this.detailForOrganisation(organisationId, requestId);
    if (!detail) return null;
    const [client] = await this.db
      .select({
        displayName: accountProfiles.displayName,
        primaryEmail: accountProfiles.primaryEmail,
        phone: accountProfiles.phone,
      })
      .from(serviceRequests)
      .innerJoin(
        accountProfiles,
        eq(accountProfiles.id, serviceRequests.clientAccountId),
      )
      .where(eq(serviceRequests.id, requestId))
      .limit(1);
    return {
      ...detail,
      clientDisplayName: client.displayName,
      clientPrimaryEmail: client.primaryEmail,
      clientPhone: client.phone,
    };
  }

  async professionalTransition(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    fromStatuses: ServiceRequestStatus[];
    toStatus: ServiceRequestStatus;
    action: string;
    note?: string;
    eventType?: string;
    correlationId?: string;
  }): Promise<ProfessionalRequestDetailRecord | null> {
    const changed = await this.transition({
      ...input,
      scope: eq(serviceRequests.organisationId, input.organisationId),
    });
    return changed
      ? this.getProfessional(input.organisationId, input.requestId)
      : null;
  }

  async addPrivateNote(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    note: string;
  }): Promise<ProfessionalRequestDetailRecord | null> {
    const [request] = await this.db
      .select({ status: serviceRequests.status })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.id, input.requestId),
          eq(serviceRequests.organisationId, input.organisationId),
          notInArray(serviceRequests.status, ["DRAFT"]),
        ),
      )
      .limit(1);
    if (!request) return null;
    await this.db.insert(serviceRequestHistory).values({
      requestId: input.requestId,
      actorAccountId: input.actorAccountId,
      action: "PRIVATE_NOTE_ADDED",
      fromStatus: request.status,
      toStatus: request.status,
      privateProfessionalNote: input.note,
    });
    return this.getProfessional(input.organisationId, input.requestId);
  }

  async expireDue(input: {
    now: Date;
    limit: number;
  }): Promise<{ expired: number; requestIds: string[] }> {
    if (input.limit <= 0) return { expired: 0, requestIds: [] };

    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({
          id: serviceRequests.id,
          status: serviceRequests.status,
          version: serviceRequests.version,
          organisationId: serviceRequests.organisationId,
        })
        .from(serviceRequests)
        .where(
          and(
            inArray(serviceRequests.status, [
              ...expirableServiceRequestStatuses,
            ]),
            lte(serviceRequests.expiresAt, input.now),
          ),
        )
        .orderBy(asc(serviceRequests.expiresAt), asc(serviceRequests.id))
        .limit(input.limit)
        .for("update", { skipLocked: true });

      const requestIds: string[] = [];
      for (const request of due) {
        const [expired] = await tx
          .update(serviceRequests)
          .set({
            status: "EXPIRED",
            version: sql`${serviceRequests.version} + 1`,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(serviceRequests.id, request.id),
              eq(serviceRequests.status, request.status),
              eq(serviceRequests.version, request.version),
              lte(serviceRequests.expiresAt, input.now),
            ),
          )
          .returning({ version: serviceRequests.version });
        if (!expired) continue;

        const expiredNote =
          "This request expired after 30 days without qualifying activity.";
        const [history] = await tx
          .insert(serviceRequestHistory)
          .values({
            requestId: request.id,
            actorAccountId: null,
            action: "EXPIRED",
            fromStatus: request.status,
            toStatus: "EXPIRED",
            clientVisibleNote: expiredNote,
          })
          .returning({
            id: serviceRequestHistory.id,
            createdAt: serviceRequestHistory.createdAt,
          });
        if (request.organisationId) {
          const [createdConversation] = await tx
            .insert(engagementConversations)
            .values({
              contextType: "SERVICE_REQUEST",
              contextId: request.id,
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
                    eq(
                      engagementConversations.contextType,
                      "SERVICE_REQUEST",
                    ),
                    eq(engagementConversations.contextId, request.id),
                  ),
                )
                .limit(1)
            )[0].id;
          await tx.insert(engagementActivities).values({
            conversationId,
            sourceType: "SERVICE_REQUEST_HISTORY",
            sourceId: history.id,
            activityType: "EXPIRED",
            actorAccountId: null,
            summary: requestActivitySummary(
              "EXPIRED",
              request.status,
              "EXPIRED",
              expiredNote,
            ),
            metadata: {
              fromStatus: request.status,
              toStatus: "EXPIRED",
              requestVersion: expired.version,
            },
            occurredAt: history.createdAt,
          });
        }
        await tx.insert(outboxEvents).values({
          eventType: "service_request.expired",
          eventVersion: 1,
          aggregateType: "service_request",
          aggregateId: request.id,
          organisationId: request.organisationId,
          actorAccountId: null,
          correlationId: "cron:service-request-expiry",
          payload: {
            status: "EXPIRED",
            previousStatus: request.status,
            version: expired.version,
            expiredAt: input.now.toISOString(),
          },
        });
        await tx.insert(outboxEvents).values({
          eventType: "engagement.activity_recorded",
          eventVersion: 1,
          aggregateType: "service_request",
          aggregateId: request.id,
          organisationId: request.organisationId,
          actorAccountId: null,
          correlationId: "cron:service-request-expiry",
          payload: {
            contextType: "SERVICE_REQUEST",
            contextId: request.id,
            action: "EXPIRED",
            fromStatus: request.status,
            toStatus: "EXPIRED",
            version: expired.version,
            occurredAt: input.now.toISOString(),
          },
        });
        requestIds.push(request.id);
      }

      return { expired: requestIds.length, requestIds };
    });
  }

  private async clientTransition(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    fromStatuses: ServiceRequestStatus[];
    toStatus: ServiceRequestStatus;
    action: string;
    note?: string;
    eventType?: string;
    correlationId?: string;
  }): Promise<ServiceRequestDetailRecord | null> {
    const changed = await this.transition({
      ...input,
      scope: eq(serviceRequests.clientAccountId, input.clientAccountId),
    });
    return changed ? this.detail(input.clientAccountId, input.requestId) : null;
  }

  private async transition(input: {
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    fromStatuses: ServiceRequestStatus[];
    toStatus: ServiceRequestStatus;
    action: string;
    note?: string;
    eventType?: string;
    correlationId?: string;
    scope: ReturnType<typeof eq>;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [current] = await tx
        .select({
          status: serviceRequests.status,
          organisationId: serviceRequests.organisationId,
        })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.id, input.requestId),
            input.scope,
            inArray(serviceRequests.status, input.fromStatuses),
            eq(serviceRequests.version, input.expectedVersion),
          ),
        )
        .limit(1);
      if (!current) return false;
      const [updated] = await tx
        .update(serviceRequests)
        .set({
          status: input.toStatus,
          version: sql`${serviceRequests.version} + 1`,
          expiresAt: statusUsesInactivityExpiry(input.toStatus)
            ? nextServiceRequestExpiry(now)
            : null,
          ...(input.toStatus === "CANCELLED" ? { cancelledAt: now } : {}),
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceRequests.id, input.requestId),
            input.scope,
            inArray(serviceRequests.status, input.fromStatuses),
            eq(serviceRequests.version, input.expectedVersion),
          ),
        )
        .returning({
          organisationId: serviceRequests.organisationId,
          version: serviceRequests.version,
        });
      if (!updated) return false;
      const [history] = await tx
        .insert(serviceRequestHistory)
        .values({
          requestId: input.requestId,
          actorAccountId: input.actorAccountId,
          action: input.action,
          fromStatus: current.status,
          toStatus: input.toStatus,
          clientVisibleNote: input.note,
        })
        .returning({
          id: serviceRequestHistory.id,
          createdAt: serviceRequestHistory.createdAt,
        });
      if (updated.organisationId) {
        const [createdConversation] = await tx
          .insert(engagementConversations)
          .values({
            contextType: "SERVICE_REQUEST",
            contextId: input.requestId,
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
                  eq(engagementConversations.contextId, input.requestId),
                ),
              )
              .limit(1)
          )[0].id;
        await tx.insert(engagementActivities).values({
          conversationId,
          sourceType: "SERVICE_REQUEST_HISTORY",
          sourceId: history.id,
          activityType: input.action,
          actorAccountId: input.actorAccountId,
          summary: requestActivitySummary(
            input.action,
            current.status,
            input.toStatus,
            input.note,
          ),
          metadata: {
            fromStatus: current.status,
            toStatus: input.toStatus,
            requestVersion: updated.version,
          },
          occurredAt: history.createdAt,
        });
      }
      if (input.eventType) {
        await tx.insert(outboxEvents).values({
          eventType: input.eventType,
          eventVersion: 1,
          aggregateType: "service_request",
          aggregateId: input.requestId,
          organisationId: updated.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: { status: input.toStatus, version: updated.version },
        });
      }
      await tx.insert(outboxEvents).values({
        eventType: "engagement.activity_recorded",
        eventVersion: 1,
        aggregateType: "service_request",
        aggregateId: input.requestId,
        organisationId: updated.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          contextType: "SERVICE_REQUEST",
          contextId: input.requestId,
          action: input.action,
          fromStatus: current.status,
          toStatus: input.toStatus,
          version: updated.version,
          occurredAt: now.toISOString(),
        },
      });
      return true;
    });
  }

  private async detailForOrganisation(
    organisationId: string,
    requestId: string,
  ): Promise<ServiceRequestDetailRecord | null> {
    const [record] = await this.selectBase()
      .where(
        and(
          eq(serviceRequests.id, requestId),
          eq(serviceRequests.organisationId, organisationId),
          notInArray(serviceRequests.status, ["DRAFT"]),
        ),
      )
      .limit(1);
    if (!record) return null;
    const clientDetail = await this.detail(record.clientAccountId, requestId);
    return clientDetail;
  }

  async listClient(input: {
    clientAccountId: string;
    status?: ServiceRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ServiceRequestRecord>> {
    const filters = [
      eq(serviceRequests.clientAccountId, input.clientAccountId),
      ...(input.status ? [eq(serviceRequests.status, input.status)] : []),
    ];
    const [items, [{ total }]] = await Promise.all([
      this.selectBase()
        .where(and(...filters))
        .orderBy(desc(serviceRequests.updatedAt), desc(serviceRequests.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db
        .select({ total: count() })
        .from(serviceRequests)
        .where(and(...filters)),
    ]);
    return buildPageResult(
      items.map((item) => this.mapRecord(item)),
      total,
      input,
    );
  }

  getClient(clientAccountId: string, requestId: string) {
    return this.detail(clientAccountId, requestId);
  }

  async createDraft(input: {
    clientAccountId: string;
    idempotencyKey: string;
    values: ServiceRequestValues;
  }): Promise<ServiceRequestDetailRecord> {
    const existing = await this.db
      .select({ id: serviceRequests.id })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.clientAccountId, input.clientAccountId),
          eq(serviceRequests.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) {
      return (await this.detail(input.clientAccountId, existing[0].id))!;
    }

    const target = await this.resolveTarget(input.values);
    const [created] = await this.db
      .insert(serviceRequests)
      .values({
        clientAccountId: input.clientAccountId,
        idempotencyKey: input.idempotencyKey,
        organisationId: target.organisationId,
        preferredServiceId: target.serviceId,
        source: input.values.source,
        category: input.values.category,
        description: input.values.description,
        location: input.values.location,
        preferredTime: input.values.preferredTime,
        budgetMinMinor: input.values.budgetMinMinor,
        budgetMaxMinor: input.values.budgetMaxMinor,
        urgency: input.values.urgency,
        contactPreference: input.values.contactPreference,
      })
      .onConflictDoNothing()
      .returning({ id: serviceRequests.id });
    const id =
      created?.id ??
      (
        await this.db
          .select({ id: serviceRequests.id })
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.clientAccountId, input.clientAccountId),
              eq(serviceRequests.idempotencyKey, input.idempotencyKey),
            ),
          )
          .limit(1)
      )[0].id;
    return (await this.detail(input.clientAccountId, id))!;
  }

  async updateDraft(input: {
    clientAccountId: string;
    requestId: string;
    expectedVersion: number;
    values: Partial<ServiceRequestValues>;
  }): Promise<ServiceRequestDetailRecord | null> {
    const current = await this.selectClientRecord(
      input.clientAccountId,
      input.requestId,
    );
    if (!current) return null;
    const target = await this.resolveTarget({
      ...this.mapRecord(current),
      ...input.values,
    });
    const [updated] = await this.db
      .update(serviceRequests)
      .set({
        ...(input.values.source !== undefined
          ? { source: input.values.source }
          : {}),
        ...(input.values.category !== undefined
          ? { category: input.values.category }
          : {}),
        ...(input.values.description !== undefined
          ? { description: input.values.description }
          : {}),
        ...(input.values.location !== undefined
          ? { location: input.values.location }
          : {}),
        ...(input.values.preferredTime !== undefined
          ? { preferredTime: input.values.preferredTime }
          : {}),
        ...(input.values.budgetMinMinor !== undefined
          ? { budgetMinMinor: input.values.budgetMinMinor }
          : {}),
        ...(input.values.budgetMaxMinor !== undefined
          ? { budgetMaxMinor: input.values.budgetMaxMinor }
          : {}),
        ...(input.values.urgency !== undefined
          ? { urgency: input.values.urgency }
          : {}),
        ...(input.values.contactPreference !== undefined
          ? { contactPreference: input.values.contactPreference }
          : {}),
        organisationId: target.organisationId,
        preferredServiceId: target.serviceId,
        version: sql`${serviceRequests.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceRequests.id, input.requestId),
          eq(serviceRequests.clientAccountId, input.clientAccountId),
          eq(serviceRequests.status, "DRAFT"),
          eq(serviceRequests.version, input.expectedVersion),
        ),
      )
      .returning({ id: serviceRequests.id });
    return updated ? this.detail(input.clientAccountId, input.requestId) : null;
  }

  async submit(input: {
    clientAccountId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ServiceRequestDetailRecord | null> {
    const changed = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(serviceRequests)
        .set({
          status: "SUBMITTED",
          version: sql`${serviceRequests.version} + 1`,
          submittedAt: now,
          expiresAt: nextServiceRequestExpiry(now),
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceRequests.id, input.requestId),
            eq(serviceRequests.clientAccountId, input.clientAccountId),
            eq(serviceRequests.status, "DRAFT"),
            eq(serviceRequests.version, input.expectedVersion),
          ),
        )
        .returning({
          id: serviceRequests.id,
          organisationId: serviceRequests.organisationId,
          version: serviceRequests.version,
        });
      if (!updated) return false;
      const [history] = await tx
        .insert(serviceRequestHistory)
        .values({
          requestId: input.requestId,
          actorAccountId: input.actorAccountId,
          action: "SUBMITTED",
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
        })
        .returning({
          id: serviceRequestHistory.id,
          createdAt: serviceRequestHistory.createdAt,
        });
      await tx.insert(outboxEvents).values({
        eventType: "service_request.submitted",
        eventVersion: 1,
        aggregateType: "service_request",
        aggregateId: input.requestId,
        organisationId: updated.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { status: "SUBMITTED", version: updated.version },
      });
      if (updated.organisationId) {
        const [createdConversation] = await tx
          .insert(engagementConversations)
          .values({
            contextType: "SERVICE_REQUEST",
            contextId: input.requestId,
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
                  eq(engagementConversations.contextId, input.requestId),
                ),
              )
              .limit(1)
          )[0].id;
        await tx.insert(engagementActivities).values({
          conversationId,
          sourceType: "SERVICE_REQUEST_HISTORY",
          sourceId: history.id,
          activityType: "SUBMITTED",
          actorAccountId: input.actorAccountId,
          summary: requestActivitySummary(
            "SUBMITTED",
            "DRAFT",
            "SUBMITTED",
          ),
          metadata: {
            fromStatus: "DRAFT",
            toStatus: "SUBMITTED",
            requestVersion: updated.version,
          },
          occurredAt: history.createdAt,
        });
      }
      await tx.insert(outboxEvents).values({
        eventType: "engagement.activity_recorded",
        eventVersion: 1,
        aggregateType: "service_request",
        aggregateId: input.requestId,
        organisationId: updated.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          contextType: "SERVICE_REQUEST",
          contextId: input.requestId,
          action: "SUBMITTED",
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
          version: updated.version,
          occurredAt: now.toISOString(),
        },
      });
      return true;
    });
    return changed ? this.detail(input.clientAccountId, input.requestId) : null;
  }

  async categoryIsActive(category: string): Promise<boolean> {
    const [record] = await this.db
      .select({ id: marketplaceCategories.id })
      .from(marketplaceCategories)
      .where(
        and(
          eq(marketplaceCategories.name, category),
          eq(marketplaceCategories.status, "active"),
        ),
      )
      .limit(1);
    return Boolean(record);
  }

  async listActiveCategories(): Promise<string[]> {
    const records = await this.db
      .select({ name: marketplaceCategories.name })
      .from(marketplaceCategories)
      .where(eq(marketplaceCategories.status, "active"))
      .orderBy(marketplaceCategories.name);
    return records.map((item) => item.name);
  }

  async attachAsset(input: {
    clientAccountId: string;
    requestId: string;
    assetId: string;
  }): Promise<ServiceRequestDetailRecord | null> {
    const attached = await this.db.transaction(async (tx) => {
      const [request] = await tx
        .select({ id: serviceRequests.id, status: serviceRequests.status })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.id, input.requestId),
            eq(serviceRequests.clientAccountId, input.clientAccountId),
            inArray(serviceRequests.status, [
              "DRAFT",
              "SUBMITTED",
              "MORE_INFORMATION_REQUIRED",
            ]),
          ),
        )
        .limit(1);
      if (!request) return false;
      const [asset] = await tx
        .select({ id: fileAssets.id })
        .from(fileAssets)
        .where(
          and(
            eq(fileAssets.id, input.assetId),
            eq(fileAssets.ownerAccountId, input.clientAccountId),
            eq(fileAssets.purpose, "REQUEST_ATTACHMENT"),
            eq(fileAssets.visibility, "private"),
            eq(fileAssets.status, "ready"),
            sql`${fileAssets.linkedEntityType} is null`,
          ),
        )
        .limit(1);
      if (!asset) return false;
      await tx.insert(serviceRequestAttachments).values({
        requestId: input.requestId,
        assetId: input.assetId,
        addedByAccountId: input.clientAccountId,
      });
      await tx
        .update(fileAssets)
        .set({
          linkedEntityType: "service_request",
          linkedEntityId: input.requestId,
          updatedAt: new Date(),
        })
        .where(eq(fileAssets.id, input.assetId));
      return true;
    });
    return attached ? this.detail(input.clientAccountId, input.requestId) : null;
  }

  async removeAsset(input: {
    clientAccountId: string;
    requestId: string;
    attachmentId: string;
  }): Promise<ServiceRequestDetailRecord | null> {
    const removed = await this.db.transaction(async (tx) => {
      const [attachment] = await tx
        .select({
          id: serviceRequestAttachments.id,
          assetId: serviceRequestAttachments.assetId,
        })
        .from(serviceRequestAttachments)
        .innerJoin(
          serviceRequests,
          eq(serviceRequests.id, serviceRequestAttachments.requestId),
        )
        .where(
          and(
            eq(serviceRequestAttachments.id, input.attachmentId),
            eq(serviceRequestAttachments.requestId, input.requestId),
            eq(serviceRequests.clientAccountId, input.clientAccountId),
            eq(serviceRequests.status, "DRAFT"),
          ),
        )
        .limit(1);
      if (!attachment) return false;
      await tx
        .delete(serviceRequestAttachments)
        .where(eq(serviceRequestAttachments.id, attachment.id));
      await tx
        .update(fileAssets)
        .set({ linkedEntityType: null, linkedEntityId: null, updatedAt: new Date() })
        .where(eq(fileAssets.id, attachment.assetId));
      return true;
    });
    return removed ? this.detail(input.clientAccountId, input.requestId) : null;
  }

  private async resolveTarget(values: ServiceRequestValues): Promise<{
    organisationId: string | null;
    serviceId: string | null;
  }> {
    if (!values.preferredProfessionalSlug) {
      return { organisationId: null, serviceId: null };
    }
    const [provider] = await this.db
      .select({ id: organisations.id })
      .from(organisations)
      .where(
        and(
          eq(organisations.slug, values.preferredProfessionalSlug),
          eq(organisations.status, "active"),
        ),
      )
      .limit(1);
    if (!provider) return { organisationId: null, serviceId: null };
    if (!values.preferredServiceSlug) {
      return { organisationId: provider.id, serviceId: null };
    }
    const [service] = await this.db
      .select({ id: professionalServices.id })
      .from(professionalServices)
      .where(
        and(
          eq(professionalServices.organisationId, provider.id),
          eq(professionalServices.slug, values.preferredServiceSlug),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
        ),
      )
      .limit(1);
    return {
      organisationId: provider.id,
      serviceId: service?.id ?? null,
    };
  }
}

function requestActivitySummary(
  action: string,
  fromStatus: string | null,
  toStatus: string,
  note?: string,
): string {
  const readableAction = action.replaceAll("_", " ").toLowerCase();
  const transition =
    fromStatus && fromStatus !== toStatus
      ? ` Status changed from ${fromStatus.replaceAll("_", " ").toLowerCase()} to ${toStatus.replaceAll("_", " ").toLowerCase()}.`
      : "";
  return `${readableAction.charAt(0).toUpperCase()}${readableAction.slice(1)}.${transition}${
    note ? ` ${note}` : ""
  }`;
}
