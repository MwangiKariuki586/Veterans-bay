import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import {
  bookings,
  paymentRequirements,
  quotationHistory,
  quotationLineItems,
  quotations,
  quotationVersions,
} from "../../platform/database/schema/commercial";
import {
  engagementActivities,
  engagementConversations,
} from "../../platform/database/schema/engagement-conversations";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  serviceRequestHistory,
  serviceRequests,
} from "../../platform/database/schema/service-requests";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import type { PageResult } from "../../platform/http/pagination";
import { buildPageResult, paginationOffset } from "../../platform/http/pagination";
import type { QuotationTotals } from "./calculations";
import type {
  ClientQuotationBucket,
  ClientQuotationSort,
  ClientQuotationSummary,
  ClientQuotationValidity,
  QuotationDetail,
  QuotationDraftValues,
  QuotationStatus,
  QuotationSummary,
} from "./types";
import { quotationStatuses } from "./types";
import { recordBookingChange } from "../bookings/repository";
import { ensureRegisteredCustomer } from "../customers/repository";

export interface QuotationMutationInput {
  values: QuotationDraftValues;
  totals: QuotationTotals;
}

export interface QuotationsStore {
  listProfessional(input: {
    organisationId: string;
    status?: QuotationStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary>>;
  listClient(input: {
    clientAccountId: string;
    status?: QuotationStatus;
    bucket?: ClientQuotationBucket;
    category?: string;
    search?: string;
    validity?: ClientQuotationValidity;
    sort: ClientQuotationSort;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary> & { summary: ClientQuotationSummary; categories: string[] }>;
  getProfessional(
    organisationId: string,
    quotationId: string,
  ): Promise<QuotationDetail | null>;
  getClient(
    clientAccountId: string,
    quotationId: string,
  ): Promise<QuotationDetail | null>;
  createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null>;
  updateDraft(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null>;
  submit(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail | null>;
  createRevision(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null>;
  markViewed(input: {
    clientAccountId: string;
    quotationId: string;
    correlationId?: string;
  }): Promise<QuotationDetail | null>;
  clientRespond(input: {
    clientAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    action: "DECLINED" | "REVISION_REQUESTED";
    note?: string;
    correlationId?: string;
  }): Promise<QuotationDetail | null>;
  accept(input: {
    clientAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail | null>;
  expireDue(input: {
    now: Date;
    limit: number;
  }): Promise<{ expired: number; quotationIds: string[] }>;
}

export class QuotationsRepository implements QuotationsStore {
  constructor(private readonly db: Database) {}

  async listProfessional(input: {
    organisationId: string;
    status?: QuotationStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary>> {
    return this.list({
      scope: eq(quotations.organisationId, input.organisationId),
      ...input,
    });
  }

  async listClient(input: {
    clientAccountId: string;
    status?: QuotationStatus;
    bucket?: ClientQuotationBucket;
    category?: string;
    search?: string;
    validity?: ClientQuotationValidity;
    sort: ClientQuotationSort;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary> & { summary: ClientQuotationSummary; categories: string[] }> {
    const bucketStatuses: Record<ClientQuotationBucket, QuotationStatus[]> = {
      "awaiting-decision": ["SUBMITTED", "VIEWED"],
      accepted: ["ACCEPTED"],
      "in-revision": ["REVISION_REQUESTED"],
      closed: ["DECLINED", "REPLACED", "EXPIRED", "CANCELLED"],
    };
    const now = new Date();
    const expiringAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
    const validityFilter = input.validity === "valid"
      ? gt(quotationVersions.validUntil, now)
      : input.validity === "expiring"
        ? and(
            inArray(quotations.status, bucketStatuses["awaiting-decision"]),
            gt(quotationVersions.validUntil, now),
            lte(quotationVersions.validUntil, expiringAt),
          )
        : input.validity === "expired"
          ? or(
              eq(quotations.status, "EXPIRED"),
              lt(quotationVersions.validUntil, now),
            )
          : undefined;
    const awaitingDecisionFilter = and(
      inArray(quotations.status, bucketStatuses["awaiting-decision"]),
      gt(quotationVersions.validUntil, now),
    )!;
    const bucketFilter = input.bucket === "awaiting-decision"
      ? awaitingDecisionFilter
      : input.bucket === "closed"
        ? or(
            inArray(quotations.status, bucketStatuses.closed),
            and(
              inArray(quotations.status, bucketStatuses["awaiting-decision"]),
              lte(quotationVersions.validUntil, now),
            ),
          )!
        : input.bucket
          ? inArray(quotations.status, bucketStatuses[input.bucket])
          : undefined;
    const filters = [
      eq(quotations.clientAccountId, input.clientAccountId),
      ne(quotations.status, "DRAFT"),
      ...(input.status ? [eq(quotations.status, input.status)] : []),
      ...(bucketFilter ? [bucketFilter] : []),
      ...(input.category ? [eq(serviceRequests.category, input.category)] : []),
      ...(input.search
        ? [
            or(
              ilike(serviceRequests.category, `%${input.search}%`),
              ilike(organisations.name, `%${input.search}%`),
            )!,
          ]
        : []),
      ...(validityFilter ? [validityFilter] : []),
    ];
    const orderBy = {
      updated_desc: [desc(quotations.updatedAt), desc(quotations.id)],
      updated_asc: [asc(quotations.updatedAt), asc(quotations.id)],
      total_desc: [desc(quotationVersions.totalMinor), desc(quotations.updatedAt)],
      total_asc: [asc(quotationVersions.totalMinor), desc(quotations.updatedAt)],
      valid_until_desc: [desc(quotationVersions.validUntil), desc(quotations.updatedAt)],
      valid_until_asc: [asc(quotationVersions.validUntil), desc(quotations.updatedAt)],
    }[input.sort];
    const joined = () => this.db
      .select(summarySelection)
      .from(quotations)
      .innerJoin(
        quotationVersions,
        and(
          eq(quotationVersions.quotationId, quotations.id),
          eq(quotationVersions.versionNumber, quotations.currentVersionNumber),
        ),
      )
      .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
      .innerJoin(organisations, eq(organisations.id, quotations.organisationId))
      .innerJoin(accountProfiles, eq(accountProfiles.id, quotations.clientAccountId));
    const [rows, [{ totalItems }], statusTotals, [{ expiringSoon }], [{ expiredAwaiting }], categoryRows] = await Promise.all([
      joined()
        .where(and(...filters))
        .orderBy(...orderBy)
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db
        .select({ totalItems: count() })
        .from(quotations)
        .innerJoin(
          quotationVersions,
          and(
            eq(quotationVersions.quotationId, quotations.id),
            eq(quotationVersions.versionNumber, quotations.currentVersionNumber),
          ),
        )
        .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
        .innerJoin(organisations, eq(organisations.id, quotations.organisationId))
        .where(and(...filters)),
      this.db
        .select({ status: quotations.status, total: count() })
        .from(quotations)
        .where(and(
          eq(quotations.clientAccountId, input.clientAccountId),
          ne(quotations.status, "DRAFT"),
        ))
        .groupBy(quotations.status),
      this.db
        .select({ expiringSoon: count() })
        .from(quotations)
        .innerJoin(
          quotationVersions,
          and(
            eq(quotationVersions.quotationId, quotations.id),
            eq(quotationVersions.versionNumber, quotations.currentVersionNumber),
          ),
        )
        .where(and(
          eq(quotations.clientAccountId, input.clientAccountId),
          inArray(quotations.status, bucketStatuses["awaiting-decision"]),
          gt(quotationVersions.validUntil, now),
          lte(quotationVersions.validUntil, expiringAt),
        )),
      this.db
        .select({ expiredAwaiting: count() })
        .from(quotations)
        .innerJoin(
          quotationVersions,
          and(
            eq(quotationVersions.quotationId, quotations.id),
            eq(quotationVersions.versionNumber, quotations.currentVersionNumber),
          ),
        )
        .where(and(
          eq(quotations.clientAccountId, input.clientAccountId),
          inArray(quotations.status, bucketStatuses["awaiting-decision"]),
          lte(quotationVersions.validUntil, now),
        )),
      this.db
        .select({ category: serviceRequests.category })
        .from(quotations)
        .innerJoin(serviceRequests, eq(serviceRequests.id, quotations.requestId))
        .where(and(
          eq(quotations.clientAccountId, input.clientAccountId),
          ne(quotations.status, "DRAFT"),
          isNotNull(serviceRequests.category),
        ))
        .groupBy(serviceRequests.category)
        .orderBy(asc(serviceRequests.category)),
    ]);
    const totals = new Map(statusTotals.map((row) => [row.status, row.total]));
    const sum = (statuses: readonly QuotationStatus[]) =>
      statuses.reduce((result, status) => result + (totals.get(status) ?? 0), 0);
    return {
      ...buildPageResult(rows.map(mapSummary), totalItems, input),
      summary: {
        total: sum(quotationStatuses),
        awaitingDecision: sum(bucketStatuses["awaiting-decision"]) - expiredAwaiting,
        accepted: sum(bucketStatuses.accepted),
        expiringSoon,
        inRevision: sum(bucketStatuses["in-revision"]),
        closed: sum(bucketStatuses.closed) + expiredAwaiting,
      },
      categories: categoryRows.flatMap((row) => row.category ? [row.category] : []),
    };
  }

  async getProfessional(
    organisationId: string,
    quotationId: string,
  ): Promise<QuotationDetail | null> {
    return this.detail(
      quotationId,
      eq(quotations.organisationId, organisationId),
    );
  }

  async getClient(
    clientAccountId: string,
    quotationId: string,
  ): Promise<QuotationDetail | null> {
    return this.detail(
      quotationId,
      and(
        eq(quotations.clientAccountId, clientAccountId),
        ne(quotations.status, "DRAFT"),
      )!,
    );
  }

  async createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null> {
    const quotationId = await this.db.transaction(async (tx) => {
      const [request] = await tx
        .select({
          id: serviceRequests.id,
          clientAccountId: serviceRequests.clientAccountId,
          currency: serviceRequests.currency,
        })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.id, input.requestId),
            eq(serviceRequests.organisationId, input.organisationId),
            inArray(serviceRequests.status, [
              "UNDER_REVIEW",
              "ASSESSMENT_REQUIRED",
            ]),
          ),
        )
        .limit(1);
      if (!request || request.currency !== input.mutation.values.currency) {
        return null;
      }

      const [quotation] = await tx
        .insert(quotations)
        .values({
          requestId: request.id,
          organisationId: input.organisationId,
          clientAccountId: request.clientAccountId,
          createdByAccountId: input.actorAccountId,
        })
        .onConflictDoNothing()
        .returning({ id: quotations.id });
      if (!quotation) return null;

      const [version] = await tx
        .insert(quotationVersions)
        .values(
          versionValues({
            quotationId: quotation.id,
            versionNumber: 1,
            actorAccountId: input.actorAccountId,
            mutation: input.mutation,
          }),
        )
        .returning({ id: quotationVersions.id });
      await insertLineItems(tx, version.id, input.mutation.values);
      await tx.insert(quotationHistory).values({
        quotationId: quotation.id,
        quotationVersionId: version.id,
        actorAccountId: input.actorAccountId,
        action: "CREATED",
        toStatus: "DRAFT",
      });
      return quotation.id;
    });
    return quotationId
      ? this.getProfessional(input.organisationId, quotationId)
      : null;
  }

  async updateDraft(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null> {
    const changed = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          currentVersionNumber: quotations.currentVersionNumber,
        })
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.organisationId, input.organisationId),
            eq(quotations.status, "DRAFT"),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .limit(1);
      if (!current) return false;
      const [version] = await tx
        .select({ id: quotationVersions.id })
        .from(quotationVersions)
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              current.currentVersionNumber,
            ),
            eq(quotationVersions.status, "DRAFT"),
          ),
        )
        .limit(1);
      if (!version) {
        throw new Error("Quotation draft version invariant violated.");
      }
      const [quotation] = await tx
        .update(quotations)
        .set({
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.organisationId, input.organisationId),
            eq(quotations.status, "DRAFT"),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: quotations.id });
      if (!quotation) return false;
      await tx
        .update(quotationVersions)
        .set({
          ...versionTermValues(input.mutation),
          updatedAt: new Date(),
        })
        .where(eq(quotationVersions.id, version.id));
      await tx
        .delete(quotationLineItems)
        .where(eq(quotationLineItems.quotationVersionId, version.id));
      await insertLineItems(tx, version.id, input.mutation.values);
      await tx.insert(quotationHistory).values({
        quotationId: input.quotationId,
        quotationVersionId: version.id,
        actorAccountId: input.actorAccountId,
        action: "DRAFT_UPDATED",
        fromStatus: "DRAFT",
        toStatus: "DRAFT",
      });
      return true;
    });
    return changed
      ? this.getProfessional(input.organisationId, input.quotationId)
      : null;
  }

  async submit(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail | null> {
    const changed = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [quotation] = await tx
        .update(quotations)
        .set({
          status: "SUBMITTED",
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.organisationId, input.organisationId),
            eq(quotations.status, "DRAFT"),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({
          requestId: quotations.requestId,
          clientAccountId: quotations.clientAccountId,
          currentVersionNumber: quotations.currentVersionNumber,
        });
      if (!quotation) return false;
      const [version] = await tx
        .update(quotationVersions)
        .set({ status: "SUBMITTED", submittedAt: now, updatedAt: now })
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              quotation.currentVersionNumber,
            ),
            eq(quotationVersions.status, "DRAFT"),
            sql`${quotationVersions.validUntil} > ${now}`,
          ),
        )
        .returning({ id: quotationVersions.id });
      if (!version) {
        throw new Error("Quotation submission version invariant violated.");
      }
      const [request] = await tx
        .select({ status: serviceRequests.status })
        .from(serviceRequests)
        .where(
          and(
            eq(serviceRequests.id, quotation.requestId),
            eq(serviceRequests.organisationId, input.organisationId),
            inArray(serviceRequests.status, [
              "UNDER_REVIEW",
              "ASSESSMENT_REQUIRED",
            ]),
          ),
        )
        .limit(1);
      if (!request) {
        throw new Error("Quotation request eligibility changed.");
      }
      const requestUpdated = await tx
        .update(serviceRequests)
        .set({
          status: "QUOTED",
          version: sql`${serviceRequests.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceRequests.id, quotation.requestId),
            eq(serviceRequests.organisationId, input.organisationId),
            eq(serviceRequests.status, request.status),
          ),
        )
        .returning({ id: serviceRequests.id });
      if (requestUpdated.length !== 1) {
        throw new Error("Quotation request eligibility changed.");
      }
      const [requestHistory] = await tx
        .insert(serviceRequestHistory)
        .values({
          requestId: quotation.requestId,
          actorAccountId: input.actorAccountId,
          action: "QUOTED",
          fromStatus: request.status,
          toStatus: "QUOTED",
        })
        .returning({
          id: serviceRequestHistory.id,
          createdAt: serviceRequestHistory.createdAt,
        });
      const [history] = await tx
        .insert(quotationHistory)
        .values({
          quotationId: input.quotationId,
          quotationVersionId: version.id,
          actorAccountId: input.actorAccountId,
          action: "SUBMITTED",
          fromStatus: "DRAFT",
          toStatus: "SUBMITTED",
        })
        .returning({
          id: quotationHistory.id,
          createdAt: quotationHistory.createdAt,
        });
      await recordQuotationActivities(tx, {
        quotationId: input.quotationId,
        requestId: quotation.requestId,
        sourceId: history.id,
        requestSourceId: requestHistory.id,
        actorAccountId: input.actorAccountId,
        action: "SUBMITTED",
        summary: `Quotation version ${quotation.currentVersionNumber} submitted.`,
        occurredAt: history.createdAt,
      });
      await tx.insert(outboxEvents).values([
        {
          eventType: "quotation.submitted",
          eventVersion: 1,
          aggregateType: "quotation",
          aggregateId: input.quotationId,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            quotationVersionId: version.id,
            versionNumber: quotation.currentVersionNumber,
            requestId: quotation.requestId,
            clientAccountId: quotation.clientAccountId,
          },
        },
        engagementActivityEvent({
          quotationId: input.quotationId,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          action: "SUBMITTED",
          versionNumber: quotation.currentVersionNumber,
        }),
      ]);
      return true;
    });
    return changed
      ? this.getProfessional(input.organisationId, input.quotationId)
      : null;
  }

  async createRevision(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    mutation: QuotationMutationInput;
  }): Promise<QuotationDetail | null> {
    const changed = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [current] = await tx
        .select({
          status: quotations.status,
          currentVersionNumber: quotations.currentVersionNumber,
        })
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.organisationId, input.organisationId),
            inArray(quotations.status, [
              "SUBMITTED",
              "VIEWED",
              "REVISION_REQUESTED",
              "EXPIRED",
            ]),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .limit(1);
      if (!current) return false;
      const [quotation] = await tx
        .update(quotations)
        .set({
          status: "DRAFT",
          currentVersionNumber: sql`${quotations.currentVersionNumber} + 1`,
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.organisationId, input.organisationId),
            eq(quotations.status, current.status),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: quotations.id });
      if (!quotation) return false;
      await tx
        .update(quotationVersions)
        .set({ status: "REPLACED", replacedAt: now, respondedAt: now })
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              current.currentVersionNumber,
            ),
            inArray(quotationVersions.status, [
              "SUBMITTED",
              "VIEWED",
              "REVISION_REQUESTED",
              "EXPIRED",
            ]),
          ),
        );
      const [version] = await tx
        .insert(quotationVersions)
        .values(
          versionValues({
            quotationId: input.quotationId,
            versionNumber: current.currentVersionNumber + 1,
            actorAccountId: input.actorAccountId,
            mutation: input.mutation,
          }),
        )
        .returning({ id: quotationVersions.id });
      await insertLineItems(tx, version.id, input.mutation.values);
      await tx.insert(quotationHistory).values([
        {
          quotationId: input.quotationId,
          actorAccountId: input.actorAccountId,
          action: "REPLACED",
          fromStatus: current.status,
          toStatus: "REPLACED",
        },
        {
          quotationId: input.quotationId,
          quotationVersionId: version.id,
          actorAccountId: input.actorAccountId,
          action: "REVISION_CREATED",
          toStatus: "DRAFT",
        },
      ]);
      return true;
    });
    return changed
      ? this.getProfessional(input.organisationId, input.quotationId)
      : null;
  }

  async markViewed(input: {
    clientAccountId: string;
    quotationId: string;
    correlationId?: string;
  }): Promise<QuotationDetail | null> {
    await this.db.transaction(async (tx) => {
      const now = new Date();
      const [quotation] = await tx
        .update(quotations)
        .set({
          status: "VIEWED",
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            eq(quotations.status, "SUBMITTED"),
          ),
        )
        .returning({
          organisationId: quotations.organisationId,
          currentVersionNumber: quotations.currentVersionNumber,
        });
      if (!quotation) return;
      const [version] = await tx
        .update(quotationVersions)
        .set({ status: "VIEWED", viewedAt: now, updatedAt: now })
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              quotation.currentVersionNumber,
            ),
            eq(quotationVersions.status, "SUBMITTED"),
          ),
        )
        .returning({ id: quotationVersions.id });
      if (!version) {
        throw new Error("Quotation viewed-version invariant violated.");
      }
      const [history] = await tx
        .insert(quotationHistory)
        .values({
          quotationId: input.quotationId,
          quotationVersionId: version.id,
          actorAccountId: input.clientAccountId,
          action: "VIEWED",
          fromStatus: "SUBMITTED",
          toStatus: "VIEWED",
        })
        .returning({
          id: quotationHistory.id,
          createdAt: quotationHistory.createdAt,
        });
      await recordQuotationActivity(tx, {
        quotationId: input.quotationId,
        sourceId: history.id,
        actorAccountId: input.clientAccountId,
        action: "VIEWED",
        summary: `Quotation version ${quotation.currentVersionNumber} viewed by the client.`,
        occurredAt: history.createdAt,
      });
      await tx.insert(outboxEvents).values([
        {
          eventType: "quotation.viewed",
          eventVersion: 1,
          aggregateType: "quotation",
          aggregateId: input.quotationId,
          organisationId: quotation.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          payload: { versionNumber: quotation.currentVersionNumber },
        },
        engagementActivityEvent({
          quotationId: input.quotationId,
          organisationId: quotation.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          action: "VIEWED",
          versionNumber: quotation.currentVersionNumber,
        }),
      ]);
    });
    return this.getClient(input.clientAccountId, input.quotationId);
  }

  async clientRespond(input: {
    clientAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    action: "DECLINED" | "REVISION_REQUESTED";
    note?: string;
    correlationId?: string;
  }): Promise<QuotationDetail | null> {
    const changed = await this.db.transaction(async (tx) => {
      const now = new Date();
      const [current] = await tx
        .select({
          status: quotations.status,
          organisationId: quotations.organisationId,
          currentVersionNumber: quotations.currentVersionNumber,
        })
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            inArray(quotations.status, ["SUBMITTED", "VIEWED"]),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .limit(1);
      if (!current) return false;
      const [quotation] = await tx
        .update(quotations)
        .set({
          status: input.action,
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            eq(quotations.status, current.status),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: quotations.id });
      if (!quotation) return false;
      const [version] = await tx
        .update(quotationVersions)
        .set({ status: input.action, respondedAt: now, updatedAt: now })
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              current.currentVersionNumber,
            ),
            inArray(quotationVersions.status, ["SUBMITTED", "VIEWED"]),
          ),
        )
        .returning({ id: quotationVersions.id });
      if (!version) {
        throw new Error("Quotation response-version invariant violated.");
      }
      const [history] = await tx
        .insert(quotationHistory)
        .values({
          quotationId: input.quotationId,
          quotationVersionId: version.id,
          actorAccountId: input.clientAccountId,
          action: input.action,
          fromStatus: current.status,
          toStatus: input.action,
          note: input.note,
        })
        .returning({
          id: quotationHistory.id,
          createdAt: quotationHistory.createdAt,
        });
      await recordQuotationActivity(tx, {
        quotationId: input.quotationId,
        sourceId: history.id,
        actorAccountId: input.clientAccountId,
        action: input.action,
        summary:
          input.action === "DECLINED"
            ? "Quotation declined by the client."
            : "Client requested a quotation revision.",
        occurredAt: history.createdAt,
      });
      await tx.insert(outboxEvents).values([
        {
          eventType:
            input.action === "DECLINED"
              ? "quotation.declined"
              : "quotation.revision_requested",
          eventVersion: 1,
          aggregateType: "quotation",
          aggregateId: input.quotationId,
          organisationId: current.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          payload: {
            versionNumber: current.currentVersionNumber,
            note: input.note,
          },
        },
        engagementActivityEvent({
          quotationId: input.quotationId,
          organisationId: current.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          action: input.action,
          versionNumber: current.currentVersionNumber,
        }),
      ]);
      return true;
    });
    return changed
      ? this.getClient(input.clientAccountId, input.quotationId)
      : null;
  }

  async accept(input: {
    clientAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail | null> {
    const changed = await this.db.transaction(async (tx) => {
      const [alreadyAccepted] = await tx
        .select({ id: quotations.id })
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            eq(quotations.status, "ACCEPTED"),
          ),
        )
        .limit(1);
      if (alreadyAccepted) return true;

      const now = new Date();
      const [quotation] = await tx
        .select({
          requestId: quotations.requestId,
          organisationId: quotations.organisationId,
          currentVersionNumber: quotations.currentVersionNumber,
        })
        .from(quotations)
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            inArray(quotations.status, ["SUBMITTED", "VIEWED"]),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .limit(1);
      if (!quotation) return false;
      const [version] = await tx
        .select()
        .from(quotationVersions)
        .where(
          and(
            eq(quotationVersions.quotationId, input.quotationId),
            eq(
              quotationVersions.versionNumber,
              quotation.currentVersionNumber,
            ),
            inArray(quotationVersions.status, ["SUBMITTED", "VIEWED"]),
            sql`${quotationVersions.validUntil} > ${now}`,
          ),
        )
        .limit(1);
      if (!version) return false;

      const [accepted] = await tx
        .update(quotations)
        .set({
          status: "ACCEPTED",
          acceptedVersionNumber: quotation.currentVersionNumber,
          acceptedByAccountId: input.clientAccountId,
          acceptedAt: now,
          lockVersion: sql`${quotations.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotations.id, input.quotationId),
            eq(quotations.clientAccountId, input.clientAccountId),
            inArray(quotations.status, ["SUBMITTED", "VIEWED"]),
            eq(quotations.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: quotations.id });
      if (!accepted) return false;
      await tx
        .update(quotationVersions)
        .set({ status: "ACCEPTED", respondedAt: now, updatedAt: now })
        .where(eq(quotationVersions.id, version.id));
      const bookingStatus =
        version.depositMinor > 0
          ? "PENDING_DEPOSIT"
          : "PENDING_CONFIRMATION";
      const [booking] = await tx
        .insert(bookings)
        .values({
          requestId: quotation.requestId,
          quotationId: input.quotationId,
          acceptedQuotationVersionId: version.id,
          organisationId: quotation.organisationId,
          clientAccountId: input.clientAccountId,
          createdByAccountId: input.clientAccountId,
          status: bookingStatus,
          currency: version.currency,
          totalMinor: version.totalMinor,
          depositMinor: version.depositMinor,
          expectedDurationMinutes: version.expectedDurationMinutes,
          proposedStartAt: version.proposedStartAt,
          scope: version.scope,
          exclusions: version.exclusions,
          warrantyTerms: version.warrantyTerms,
          paymentTerms: version.paymentTerms,
          acceptedAt: now,
        })
        .returning({ id: bookings.id });
      await recordBookingChange(tx, {
        bookingId: booking.id,
        organisationId: quotation.organisationId,
        actorAccountId: input.clientAccountId,
        action: "CREATED",
        fromStatus: null,
        toStatus: bookingStatus,
        startsAt: version.proposedStartAt,
        endsAt: version.proposedStartAt
          ? new Date(
              version.proposedStartAt.getTime() +
                version.expectedDurationMinutes * 60_000,
            )
          : null,
        correlationId: input.correlationId,
      });
      await ensureRegisteredCustomer(tx, {
        organisationId: quotation.organisationId,
        clientAccountId: input.clientAccountId,
        actorAccountId: input.clientAccountId,
        origin: "ACCEPTED_QUOTATION",
      });
      const requirements = [
        ...(version.depositMinor > 0
          ? [
              {
                bookingId: booking.id,
                quotationVersionId: version.id,
                requirementType: "DEPOSIT",
                amountMinor: version.depositMinor,
                currency: version.currency,
              },
            ]
          : []),
        ...(version.totalMinor - version.depositMinor > 0
          ? [
              {
                bookingId: booking.id,
                quotationVersionId: version.id,
                requirementType: "BALANCE",
                amountMinor: version.totalMinor - version.depositMinor,
                currency: version.currency,
              },
            ]
          : []),
      ];
      if (requirements.length > 0) {
        await tx.insert(paymentRequirements).values(requirements);
      }
      const converted = await tx
        .update(serviceRequests)
        .set({
          status: "CONVERTED",
          version: sql`${serviceRequests.version} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(serviceRequests.id, quotation.requestId),
            eq(serviceRequests.status, "QUOTED"),
          ),
        )
        .returning({ id: serviceRequests.id });
      if (converted.length !== 1) {
        throw new Error("Accepted quotation request invariant violated.");
      }
      await tx.insert(serviceRequestHistory).values({
        requestId: quotation.requestId,
        actorAccountId: input.clientAccountId,
        action: "CONVERTED",
        fromStatus: "QUOTED",
        toStatus: "CONVERTED",
      });
      const [history] = await tx
        .insert(quotationHistory)
        .values({
          quotationId: input.quotationId,
          quotationVersionId: version.id,
          actorAccountId: input.clientAccountId,
          action: "ACCEPTED",
          fromStatus: version.status,
          toStatus: "ACCEPTED",
        })
        .returning({
          id: quotationHistory.id,
          createdAt: quotationHistory.createdAt,
        });
      await recordQuotationActivity(tx, {
        quotationId: input.quotationId,
        sourceId: history.id,
        actorAccountId: input.clientAccountId,
        action: "ACCEPTED",
        summary: `Quotation version ${quotation.currentVersionNumber} accepted. Booking created.`,
        occurredAt: history.createdAt,
      });
      await tx.insert(outboxEvents).values([
        {
          eventType: "quotation.accepted",
          eventVersion: 1,
          aggregateType: "quotation",
          aggregateId: input.quotationId,
          organisationId: quotation.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          payload: {
            quotationVersionId: version.id,
            versionNumber: quotation.currentVersionNumber,
            bookingId: booking.id,
            requestId: quotation.requestId,
            totalMinor: version.totalMinor,
            depositMinor: version.depositMinor,
            currency: version.currency,
          },
        },
        engagementActivityEvent({
          quotationId: input.quotationId,
          organisationId: quotation.organisationId,
          actorAccountId: input.clientAccountId,
          correlationId: input.correlationId,
          action: "ACCEPTED",
          versionNumber: quotation.currentVersionNumber,
        }),
      ]);
      return true;
    });
    return changed
      ? this.getClient(input.clientAccountId, input.quotationId)
      : null;
  }

  async expireDue(input: {
    now: Date;
    limit: number;
  }): Promise<{ expired: number; quotationIds: string[] }> {
    if (input.limit <= 0) return { expired: 0, quotationIds: [] };
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({
          id: quotations.id,
          status: quotations.status,
          lockVersion: quotations.lockVersion,
          organisationId: quotations.organisationId,
          currentVersionNumber: quotations.currentVersionNumber,
        })
        .from(quotations)
        .innerJoin(
          quotationVersions,
          and(
            eq(quotationVersions.quotationId, quotations.id),
            eq(
              quotationVersions.versionNumber,
              quotations.currentVersionNumber,
            ),
          ),
        )
        .where(
          and(
            inArray(quotations.status, ["SUBMITTED", "VIEWED"]),
            lte(quotationVersions.validUntil, input.now),
          ),
        )
        .orderBy(asc(quotationVersions.validUntil), asc(quotations.id))
        .limit(input.limit)
        .for("update", { skipLocked: true });
      const quotationIds: string[] = [];
      for (const quotation of due) {
        const [expired] = await tx
          .update(quotations)
          .set({
            status: "EXPIRED",
            lockVersion: sql`${quotations.lockVersion} + 1`,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(quotations.id, quotation.id),
              eq(quotations.status, quotation.status),
              eq(quotations.lockVersion, quotation.lockVersion),
            ),
          )
          .returning({ id: quotations.id });
        if (!expired) continue;
        const [version] = await tx
          .update(quotationVersions)
          .set({
            status: "EXPIRED",
            respondedAt: input.now,
            updatedAt: input.now,
          })
          .where(
            and(
              eq(quotationVersions.quotationId, quotation.id),
              eq(
                quotationVersions.versionNumber,
                quotation.currentVersionNumber,
              ),
              inArray(quotationVersions.status, ["SUBMITTED", "VIEWED"]),
              lte(quotationVersions.validUntil, input.now),
            ),
          )
          .returning({ id: quotationVersions.id });
        if (!version) {
          throw new Error("Quotation expiry-version invariant violated.");
        }
        const [history] = await tx
          .insert(quotationHistory)
          .values({
            quotationId: quotation.id,
            quotationVersionId: version.id,
            actorAccountId: null,
            action: "EXPIRED",
            fromStatus: quotation.status,
            toStatus: "EXPIRED",
          })
          .returning({
            id: quotationHistory.id,
            createdAt: quotationHistory.createdAt,
          });
        await recordQuotationActivity(tx, {
          quotationId: quotation.id,
          sourceId: history.id,
          actorAccountId: null,
          action: "EXPIRED",
          summary: `Quotation version ${quotation.currentVersionNumber} expired.`,
          occurredAt: history.createdAt,
        });
        await tx.insert(outboxEvents).values([
          {
            eventType: "quotation.expired",
            eventVersion: 1,
            aggregateType: "quotation",
            aggregateId: quotation.id,
            organisationId: quotation.organisationId,
            actorAccountId: null,
            correlationId: "cron:quotation-expiry",
            payload: {
              versionNumber: quotation.currentVersionNumber,
              expiredAt: input.now.toISOString(),
            },
          },
          engagementActivityEvent({
            quotationId: quotation.id,
            organisationId: quotation.organisationId,
            actorAccountId: null,
            correlationId: "cron:quotation-expiry",
            action: "EXPIRED",
            versionNumber: quotation.currentVersionNumber,
          }),
        ]);
        quotationIds.push(quotation.id);
      }
      return { expired: quotationIds.length, quotationIds };
    });
  }

  private async list(input: {
    scope: ReturnType<typeof eq>;
    status?: QuotationStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary>> {
    const filter = and(
      input.scope,
      ...(input.status ? [eq(quotations.status, input.status)] : []),
    );
    const [rows, [{ totalItems }]] = await Promise.all([
      this.db
        .select(summarySelection)
        .from(quotations)
        .innerJoin(
          quotationVersions,
          and(
            eq(quotationVersions.quotationId, quotations.id),
            eq(
              quotationVersions.versionNumber,
              quotations.currentVersionNumber,
            ),
          ),
        )
        .innerJoin(
          serviceRequests,
          eq(serviceRequests.id, quotations.requestId),
        )
        .innerJoin(
          organisations,
          eq(organisations.id, quotations.organisationId),
        )
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, quotations.clientAccountId),
        )
        .where(filter)
        .orderBy(desc(quotations.updatedAt), desc(quotations.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db
        .select({ totalItems: count() })
        .from(quotations)
        .where(filter),
    ]);
    return buildPageResult(
      rows.map(mapSummary),
      totalItems,
      input,
    );
  }

  private async detail(
    quotationId: string,
    scope: ReturnType<typeof eq>,
  ): Promise<QuotationDetail | null> {
    const [summary] = await this.db
      .select(summarySelection)
      .from(quotations)
      .innerJoin(
        quotationVersions,
        and(
          eq(quotationVersions.quotationId, quotations.id),
          eq(quotationVersions.versionNumber, quotations.currentVersionNumber),
        ),
      )
      .innerJoin(
        serviceRequests,
        eq(serviceRequests.id, quotations.requestId),
      )
      .innerJoin(
        organisations,
        eq(organisations.id, quotations.organisationId),
      )
      .innerJoin(
        accountProfiles,
        eq(accountProfiles.id, quotations.clientAccountId),
      )
      .where(and(eq(quotations.id, quotationId), scope))
      .limit(1);
    if (!summary) return null;

    const [versionRows, lineRows, historyRows, bookingRows] = await Promise.all([
      this.db
        .select()
        .from(quotationVersions)
        .where(eq(quotationVersions.quotationId, quotationId))
        .orderBy(desc(quotationVersions.versionNumber)),
      this.db
        .select({
          id: quotationLineItems.id,
          quotationVersionId: quotationLineItems.quotationVersionId,
          category: quotationLineItems.category,
          description: quotationLineItems.description,
          quantity: quotationLineItems.quantity,
          unitPriceMinor: quotationLineItems.unitPriceMinor,
          totalMinor: quotationLineItems.totalMinor,
          position: quotationLineItems.position,
        })
        .from(quotationLineItems)
        .innerJoin(
          quotationVersions,
          eq(quotationVersions.id, quotationLineItems.quotationVersionId),
        )
        .where(eq(quotationVersions.quotationId, quotationId))
        .orderBy(
          desc(quotationVersions.versionNumber),
          asc(quotationLineItems.position),
        ),
      this.db
        .select({
          id: quotationHistory.id,
          versionNumber: quotationVersions.versionNumber,
          action: quotationHistory.action,
          fromStatus: quotationHistory.fromStatus,
          toStatus: quotationHistory.toStatus,
          note: quotationHistory.note,
          createdAt: quotationHistory.createdAt,
        })
        .from(quotationHistory)
        .leftJoin(
          quotationVersions,
          eq(quotationVersions.id, quotationHistory.quotationVersionId),
        )
        .where(eq(quotationHistory.quotationId, quotationId))
        .orderBy(desc(quotationHistory.createdAt), desc(quotationHistory.id)),
      this.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(eq(bookings.quotationId, quotationId))
        .limit(1),
    ]);
    return {
      ...mapSummary(summary),
      versions: versionRows.map((version) => ({
        ...version,
        status: version.status as QuotationStatus,
        lineItems: lineRows
          .filter((item) => item.quotationVersionId === version.id)
          .map((item) => ({
            id: item.id,
            category:
              item.category as import("./types").QuotationLineItemCategory,
            description: item.description,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinor,
            totalMinor: item.totalMinor,
            position: item.position,
          })),
        proposedStartAt: version.proposedStartAt?.toISOString() ?? null,
        validUntil: version.validUntil?.toISOString() ?? null,
        submittedAt: version.submittedAt?.toISOString() ?? null,
        viewedAt: version.viewedAt?.toISOString() ?? null,
        respondedAt: version.respondedAt?.toISOString() ?? null,
        replacedAt: version.replacedAt?.toISOString() ?? null,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
      })),
      history: historyRows.map((item) => ({
        ...item,
        fromStatus: item.fromStatus as QuotationStatus | null,
        toStatus: item.toStatus as QuotationStatus,
        createdAt: item.createdAt.toISOString(),
      })),
      bookingId: bookingRows[0]?.id ?? null,
    };
  }
}

const summarySelection = {
  id: quotations.id,
  requestId: quotations.requestId,
  organisationId: quotations.organisationId,
  clientAccountId: quotations.clientAccountId,
  status: quotations.status,
  currentVersionNumber: quotations.currentVersionNumber,
  acceptedVersionNumber: quotations.acceptedVersionNumber,
  lockVersion: quotations.lockVersion,
  providerName: organisations.name,
  clientName: accountProfiles.displayName,
  requestCategory: serviceRequests.category,
  currentTotalMinor: quotationVersions.totalMinor,
  currency: quotationVersions.currency,
  validUntil: quotationVersions.validUntil,
  createdAt: quotations.createdAt,
  updatedAt: quotations.updatedAt,
};

function mapSummary(row: {
  id: string;
  requestId: string;
  organisationId: string;
  clientAccountId: string;
  status: string;
  currentVersionNumber: number;
  acceptedVersionNumber: number | null;
  lockVersion: number;
  providerName: string;
  clientName: string;
  requestCategory: string | null;
  currentTotalMinor: number;
  currency: string;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): QuotationSummary {
  return {
    ...row,
    status: row.status as QuotationStatus,
    requestCategory: row.requestCategory ?? "Service request",
    validUntil: row.validUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function versionValues(input: {
  quotationId: string;
  versionNumber: number;
  actorAccountId: string;
  mutation: QuotationMutationInput;
}) {
  return {
    quotationId: input.quotationId,
    versionNumber: input.versionNumber,
    createdByAccountId: input.actorAccountId,
    ...versionTermValues(input.mutation),
  };
}

function versionTermValues(mutation: QuotationMutationInput) {
  const { values, totals } = mutation;
  return {
    currency: values.currency,
    ...totals,
    expectedDurationMinutes: values.expectedDurationMinutes,
    proposedStartAt: values.proposedStartAt
      ? new Date(values.proposedStartAt)
      : null,
    validUntil: new Date(values.validUntil),
    scope: values.scope,
    exclusions: values.exclusions,
    warrantyTerms: values.warrantyTerms,
    paymentTerms: values.paymentTerms,
  };
}

async function insertLineItems(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  quotationVersionId: string,
  values: QuotationDraftValues,
) {
  await tx.insert(quotationLineItems).values(
    values.lineItems.map((item, position) => ({
      quotationVersionId,
      ...item,
      totalMinor: item.quantity * item.unitPriceMinor,
      position,
    })),
  );
}

async function ensureConversation(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  contextType: "SERVICE_REQUEST" | "QUOTATION",
  contextId: string,
): Promise<string> {
  const [created] = await tx
    .insert(engagementConversations)
    .values({ contextType, contextId })
    .onConflictDoNothing()
    .returning({ id: engagementConversations.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: engagementConversations.id })
    .from(engagementConversations)
    .where(
      and(
        eq(engagementConversations.contextType, contextType),
        eq(engagementConversations.contextId, contextId),
      ),
    )
    .limit(1);
  return existing.id;
}

async function recordQuotationActivity(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: {
    quotationId: string;
    sourceId: string;
    actorAccountId: string | null;
    action: string;
    summary: string;
    occurredAt: Date;
  },
) {
  const conversationId = await ensureConversation(
    tx,
    "QUOTATION",
    input.quotationId,
  );
  await tx.insert(engagementActivities).values({
    conversationId,
    sourceType: "QUOTATION_HISTORY",
    sourceId: input.sourceId,
    activityType: input.action,
    actorAccountId: input.actorAccountId,
    summary: input.summary,
    metadata: { quotationId: input.quotationId },
    occurredAt: input.occurredAt,
  });
}

async function recordQuotationActivities(
  tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
  input: {
    quotationId: string;
    requestId: string;
    sourceId: string;
    requestSourceId: string;
    actorAccountId: string;
    action: string;
    summary: string;
    occurredAt: Date;
  },
) {
  await recordQuotationActivity(tx, input);
  const requestConversationId = await ensureConversation(
    tx,
    "SERVICE_REQUEST",
    input.requestId,
  );
  await tx.insert(engagementActivities).values({
    conversationId: requestConversationId,
    sourceType: "SERVICE_REQUEST_HISTORY",
    sourceId: input.requestSourceId,
    activityType: input.action,
    actorAccountId: input.actorAccountId,
    summary: input.summary,
    metadata: {
      quotationId: input.quotationId,
      requestId: input.requestId,
    },
    occurredAt: input.occurredAt,
  });
}

function engagementActivityEvent(input: {
  quotationId: string;
  organisationId: string;
  actorAccountId: string | null;
  correlationId?: string;
  action: string;
  versionNumber: number;
}) {
  return {
    eventType: "engagement.activity_recorded",
    eventVersion: 1,
    aggregateType: "quotation",
    aggregateId: input.quotationId,
    organisationId: input.organisationId,
    actorAccountId: input.actorAccountId,
    correlationId: input.correlationId,
    payload: {
      contextType: "QUOTATION",
      contextId: input.quotationId,
      action: input.action,
      versionNumber: input.versionNumber,
    },
  };
}
