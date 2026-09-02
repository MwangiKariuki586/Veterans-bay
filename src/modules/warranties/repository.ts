import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { fileAssets } from "../../platform/database/schema/file-assets";
import {
  jobAssignments,
  jobHistory,
  jobs,
} from "../../platform/database/schema/fulfilment";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  warranties,
  warrantyClaimEvidence,
  warrantyClaimHistory,
  warrantyClaims,
} from "../../platform/database/schema/warranties";
import { paginationOffset } from "../../platform/http/pagination";
import { deriveWarrantyCoverage } from "../../platform/warranties/coverage";
import type {
  WarrantyClaimStatus,
  WarrantyDetail,
  WarrantyPage,
  WarrantyStatus,
} from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const clientProfile = alias(accountProfiles, "warranty_client_profile");
const effectiveStatusSql = sql<string>`case
  when ${warranties.status} = 'ACTIVE' and ${warranties.endsAt} <= now()
  then 'EXPIRED'
  else ${warranties.status}
end`;
const openClaimCountSql = sql<number>`(
  select count(*) from warranty_claims wc
  where wc.warranty_id = ${sql.raw('"warranties"."id"')}
    and wc.status in ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'RETURN_VISIT_SCHEDULED', 'ESCALATED')
)`;

export interface ProfessionalWarrantyScope {
  organisationId: string;
  membershipId: string;
  assignedJobsOnly: boolean;
}

export class WarrantiesRepository {
  constructor(private readonly db: Database) {}

  async ensureFromJob(input: {
    jobId: string;
    organisationId: string;
    actorAccountId: string;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from jobs where id = ${input.jobId} for update`,
      );
      const [existing] = await tx
        .select({ id: warranties.id })
        .from(warranties)
        .where(eq(warranties.jobId, input.jobId))
        .limit(1);
      if (existing) return existing.id;
      const [job] = await tx
        .select()
        .from(jobs)
        .where(
          and(
            eq(jobs.id, input.jobId),
            eq(jobs.organisationId, input.organisationId),
            eq(jobs.status, "COMPLETED"),
          ),
        )
        .limit(1);
      if (!job?.completedAt) return null;
      const coverage = deriveWarrantyCoverage(
        job.warrantyTermsSnapshot,
        job.completedAt,
      );
      if (!coverage) return null;
      const [created] = await tx
        .insert(warranties)
        .values({
          jobId: job.id,
          organisationId: job.organisationId,
          clientAccountId: job.clientAccountId,
          createdByAccountId: input.actorAccountId,
          serviceNameSnapshot: job.serviceName,
          termsSnapshot: job.warrantyTermsSnapshot,
          exclusionsSnapshot: job.exclusionsSnapshot,
          startsAt: coverage.startsAt,
          endsAt: coverage.endsAt,
        })
        .onConflictDoNothing()
        .returning({ id: warranties.id });
      const id =
        created?.id ??
        (
          await tx
            .select({ id: warranties.id })
            .from(warranties)
            .where(eq(warranties.jobId, job.id))
            .limit(1)
        )[0]?.id;
      if (created) {
        await tx.insert(outboxEvents).values({
          eventType: "warranty.created",
          eventVersion: 1,
          aggregateType: "warranty",
          aggregateId: created.id,
          organisationId: job.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            jobId: job.id,
            clientAccountId: job.clientAccountId,
            startsAt: coverage.startsAt.toISOString(),
            endsAt: coverage.endsAt.toISOString(),
          },
        });
      }
      return id ?? null;
    });
  }

  listProfessional(input: {
    scope: ProfessionalWarrantyScope;
    status?: WarrantyStatus;
    page: number;
    pageSize: number;
  }): Promise<WarrantyPage> {
    return this.list(professionalScope(input.scope), input);
  }

  listClient(input: {
    clientAccountId: string;
    status?: WarrantyStatus;
    bucket?: "all" | "active" | "expiring-soon" | "expired" | "voided";
    service?: string;
    search?: string;
    sort?: "expiry_asc" | "expiry_desc" | "created_desc" | "created_asc";
    dateFrom?: string;
    dateTo?: string;
    page: number;
    pageSize: number;
  }): Promise<WarrantyPage> {
    return this.list(eq(warranties.clientAccountId, input.clientAccountId), input);
  }

  getProfessional(
    warrantyId: string,
    scope: ProfessionalWarrantyScope,
  ): Promise<WarrantyDetail | null> {
    return this.detail(warrantyId, professionalScope(scope));
  }

  getClient(
    warrantyId: string,
    clientAccountId: string,
  ): Promise<WarrantyDetail | null> {
    return this.detail(
      warrantyId,
      eq(warranties.clientAccountId, clientAccountId),
    );
  }

  async submitClaim(input: {
    warrantyId: string;
    clientAccountId: string;
    subject: string;
    description: string;
    preferredResolution?: string;
    evidenceAssetIds: string[];
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from warranties where id = ${input.warrantyId} for update`,
      );
      const [warranty] = await tx
        .select()
        .from(warranties)
        .where(
          and(
            eq(warranties.id, input.warrantyId),
            eq(warranties.clientAccountId, input.clientAccountId),
            eq(warranties.status, "ACTIVE"),
            sql`${warranties.startsAt} <= now()`,
            sql`${warranties.endsAt} > now()`,
          ),
        )
        .limit(1);
      if (!warranty) return null;
      const [openClaim] = await tx
        .select({ id: warrantyClaims.id })
        .from(warrantyClaims)
        .where(
          and(
            eq(warrantyClaims.warrantyId, warranty.id),
            inArray(warrantyClaims.status, [
              "SUBMITTED",
              "UNDER_REVIEW",
              "ACCEPTED",
              "RETURN_VISIT_SCHEDULED",
              "ESCALATED",
            ]),
          ),
        )
        .limit(1);
      if (
        openClaim ||
        !(await validEvidenceAssets(
          tx,
          input.evidenceAssetIds,
          warranty.organisationId,
          input.clientAccountId,
        ))
      ) {
        return null;
      }
      const [next] = await tx
        .select({
          value: sql<number>`coalesce(max(${warrantyClaims.sequence}), 0) + 1`,
        })
        .from(warrantyClaims)
        .where(eq(warrantyClaims.warrantyId, warranty.id));
      const [claim] = await tx
        .insert(warrantyClaims)
        .values({
          warrantyId: warranty.id,
          sequence: next?.value ?? 1,
          submittedByAccountId: input.clientAccountId,
          subject: input.subject,
          description: input.description,
          preferredResolution: input.preferredResolution,
        })
        .returning({ id: warrantyClaims.id });
      await linkEvidence(tx, {
        claimId: claim.id,
        assetIds: input.evidenceAssetIds,
        actorAccountId: input.clientAccountId,
        evidenceType: "SUBMISSION",
      });
      await recordClaimChange(tx, {
        claimId: claim.id,
        warrantyId: warranty.id,
        organisationId: warranty.organisationId,
        actorAccountId: input.clientAccountId,
        action: "SUBMITTED",
        fromStatus: null,
        toStatus: "SUBMITTED",
        correlationId: input.correlationId,
        payload: {
          clientAccountId: warranty.clientAccountId,
          jobId: warranty.jobId,
        },
      });
      return claim.id;
    });
  }

  async actOnClaim(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    expectedLockVersion: number;
    action: "START_REVIEW" | "ACCEPT" | "REJECT" | "ESCALATE";
    reason?: string;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          claim: getTableColumns(warrantyClaims),
          warranty: getTableColumns(warranties),
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warrantyClaims.lockVersion, input.expectedLockVersion),
            professionalScope(input.scope),
          ),
        )
        .limit(1);
      if (!row) return null;
      const nextStatus = claimTransition(
        row.claim.status as WarrantyClaimStatus,
        input.action,
      );
      if (!nextStatus || (input.action === "REJECT" && !input.reason?.trim())) {
        return null;
      }
      const now = new Date();
      const [updated] = await tx
        .update(warrantyClaims)
        .set({
          status: nextStatus,
          decisionReason:
            input.action === "REJECT" ? input.reason : row.claim.decisionReason,
          reviewedByAccountId: input.actorAccountId,
          reviewedAt: now,
          rejectedAt: input.action === "REJECT" ? now : row.claim.rejectedAt,
          escalatedAt:
            input.action === "ESCALATE" ? now : row.claim.escalatedAt,
          lockVersion: sql`${warrantyClaims.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(warrantyClaims.id, row.claim.id),
            eq(warrantyClaims.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: warrantyClaims.id });
      if (!updated) return null;
      await recordClaimChange(tx, {
        claimId: row.claim.id,
        warrantyId: row.warranty.id,
        organisationId: row.warranty.organisationId,
        actorAccountId: input.actorAccountId,
        action: input.action,
        fromStatus: row.claim.status as WarrantyClaimStatus,
        toStatus: nextStatus,
        reason: input.reason,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: row.warranty.clientAccountId,
          jobId: row.warranty.jobId,
        },
      });
      return row.warranty.id;
    });
  }

  async escalateClient(input: {
    claimId: string;
    clientAccountId: string;
    expectedLockVersion: number;
    reason: string;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          claim: getTableColumns(warrantyClaims),
          warranty: getTableColumns(warranties),
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warranties.clientAccountId, input.clientAccountId),
            eq(warrantyClaims.lockVersion, input.expectedLockVersion),
            inArray(warrantyClaims.status, [
              "SUBMITTED",
              "UNDER_REVIEW",
              "REJECTED",
            ]),
          ),
        )
        .limit(1);
      if (!row) return null;
      const now = new Date();
      await tx
        .update(warrantyClaims)
        .set({
          status: "ESCALATED",
          escalatedAt: now,
          lockVersion: sql`${warrantyClaims.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(eq(warrantyClaims.id, row.claim.id));
      await recordClaimChange(tx, {
        claimId: row.claim.id,
        warrantyId: row.warranty.id,
        organisationId: row.warranty.organisationId,
        actorAccountId: input.clientAccountId,
        action: "ESCALATE",
        fromStatus: row.claim.status as WarrantyClaimStatus,
        toStatus: "ESCALATED",
        reason: input.reason,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: row.warranty.clientAccountId,
          jobId: row.warranty.jobId,
        },
      });
      return row.warranty.id;
    });
  }

  async scheduleReturnVisit(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    expectedLockVersion: number;
    startsAt: Date;
    endsAt: Date;
    reason?: string;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          claim: getTableColumns(warrantyClaims),
          warranty: getTableColumns(warranties),
          jobStatus: jobs.status,
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warrantyClaims.status, "ACCEPTED"),
            eq(warrantyClaims.lockVersion, input.expectedLockVersion),
            professionalScope(input.scope),
          ),
        )
        .limit(1);
      if (
        !row ||
        input.startsAt <= new Date() ||
        input.endsAt <= input.startsAt
      ) {
        return null;
      }
      await tx
        .update(warrantyClaims)
        .set({
          status: "RETURN_VISIT_SCHEDULED",
          returnVisitStartsAt: input.startsAt,
          returnVisitEndsAt: input.endsAt,
          lockVersion: sql`${warrantyClaims.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(warrantyClaims.id, row.claim.id));
      await tx
        .update(jobs)
        .set({
          status: "RETURN_VISIT_REQUIRED",
          scheduledStartsAt: input.startsAt,
          scheduledEndsAt: input.endsAt,
          completedAt: null,
          lockVersion: sql`${jobs.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, row.warranty.jobId));
      await tx.insert(jobHistory).values({
        jobId: row.warranty.jobId,
        actorAccountId: input.actorAccountId,
        action: "WARRANTY_RETURN_VISIT_SCHEDULED",
        fromStatus: row.jobStatus,
        toStatus: "RETURN_VISIT_REQUIRED",
        reason: input.reason,
        clientVisible: true,
      });
      await recordClaimChange(tx, {
        claimId: row.claim.id,
        warrantyId: row.warranty.id,
        organisationId: row.warranty.organisationId,
        actorAccountId: input.actorAccountId,
        action: "RETURN_VISIT_SCHEDULED",
        fromStatus: "ACCEPTED",
        toStatus: "RETURN_VISIT_SCHEDULED",
        reason: input.reason,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: row.warranty.clientAccountId,
          jobId: row.warranty.jobId,
          startsAt: input.startsAt.toISOString(),
          endsAt: input.endsAt.toISOString(),
        },
      });
      return row.warranty.id;
    });
  }

  async resolveClaim(input: {
    claimId: string;
    scope: ProfessionalWarrantyScope;
    actorAccountId: string;
    expectedLockVersion: number;
    resolutionNotes: string;
    evidenceAssetIds: string[];
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          claim: getTableColumns(warrantyClaims),
          warranty: getTableColumns(warranties),
        })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .where(
          and(
            eq(warrantyClaims.id, input.claimId),
            eq(warrantyClaims.lockVersion, input.expectedLockVersion),
            inArray(warrantyClaims.status, [
              "ACCEPTED",
              "RETURN_VISIT_SCHEDULED",
              "ESCALATED",
            ]),
            professionalScope(input.scope),
          ),
        )
        .limit(1);
      if (
        !row ||
        !(await validEvidenceAssets(
          tx,
          input.evidenceAssetIds,
          row.warranty.organisationId,
          input.actorAccountId,
        ))
      ) {
        return null;
      }
      await tx
        .update(warrantyClaims)
        .set({
          status: "RESOLVED",
          resolutionNotes: input.resolutionNotes,
          resolvedAt: new Date(),
          lockVersion: sql`${warrantyClaims.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(warrantyClaims.id, row.claim.id));
      await linkEvidence(tx, {
        claimId: row.claim.id,
        assetIds: input.evidenceAssetIds,
        actorAccountId: input.actorAccountId,
        evidenceType: "RESOLUTION",
      });
      await recordClaimChange(tx, {
        claimId: row.claim.id,
        warrantyId: row.warranty.id,
        organisationId: row.warranty.organisationId,
        actorAccountId: input.actorAccountId,
        action: "RESOLVED",
        fromStatus: row.claim.status as WarrantyClaimStatus,
        toStatus: "RESOLVED",
        reason: input.resolutionNotes,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: row.warranty.clientAccountId,
          jobId: row.warranty.jobId,
        },
      });
      return row.warranty.id;
    });
  }

  private async list(
    scope: SQL<unknown>,
    input: {
      status?: WarrantyStatus;
      bucket?: "all" | "active" | "expiring-soon" | "expired" | "voided";
      service?: string;
      search?: string;
      sort?: "expiry_asc" | "expiry_desc" | "created_desc" | "created_asc";
      dateFrom?: string;
      dateTo?: string;
      page: number;
      pageSize: number;
    },
  ): Promise<WarrantyPage> {
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const bucketFilter = (() => {
      switch (input.bucket) {
        case "active":
          return and(
            sql`${effectiveStatusSql} = 'ACTIVE'`,
            sql`${warranties.endsAt} > ${now.toISOString()}`,
          );
        case "expiring-soon":
          return and(
            sql`${effectiveStatusSql} = 'ACTIVE'`,
            sql`${warranties.endsAt} > ${now.toISOString()}`,
            sql`${warranties.endsAt} <= ${thirtyDaysLater.toISOString()}`,
          );
        case "expired":
          return sql`${effectiveStatusSql} = 'EXPIRED'`;
        case "voided":
          return sql`${effectiveStatusSql} = 'VOID'`;
        default:
          return undefined;
      }
    })();

    const statusFilter = input.status
      ? sql`${effectiveStatusSql} = ${input.status}`
      : undefined;

    const serviceFilter = input.service
      ? sql`${warranties.serviceNameSnapshot} ILIKE ${`%${input.service}%`}`
      : undefined;

    const searchFilter = input.search
      ? sql`(
          ${warranties.serviceNameSnapshot} ILIKE ${`%${input.search}%`} OR
          ${warranties.id}::text ILIKE ${`%${input.search}%`} OR
          ${organisations.name} ILIKE ${`%${input.search}%`}
        )`
      : undefined;

    const dateFromFilter = input.dateFrom
      ? sql`${warranties.startsAt} >= ${input.dateFrom}`
      : undefined;

    const dateToFilter = input.dateTo
      ? sql`${warranties.endsAt} <= ${input.dateTo}`
      : undefined;

    const filter = and(
      scope,
      bucketFilter,
      statusFilter,
      serviceFilter,
      searchFilter,
      dateFromFilter,
      dateToFilter,
    );

    const orderBy = (() => {
      switch (input.sort) {
        case "expiry_asc":
          return asc(warranties.endsAt);
        case "expiry_desc":
          return desc(warranties.endsAt);
        case "created_asc":
          return asc(warranties.createdAt);
        case "created_desc":
        default:
          return desc(warranties.createdAt);
      }
    })();

    const baseFilter = and(
      scope,
      statusFilter,
      serviceFilter,
      searchFilter,
      dateFromFilter,
      dateToFilter,
    );

    const latestClaimStatusSql = sql<string | null>`(
      select wc.status from warranty_claims wc
      where wc.warranty_id = ${warranties.id}
      order by wc.sequence desc limit 1
    )`;
    const latestClaimSubjectSql = sql<string | null>`(
      select wc.subject from warranty_claims wc
      where wc.warranty_id = ${warranties.id}
      order by wc.sequence desc limit 1
    )`;

    const [rows, totals, warrantyCounts, openClaimsCount, resolvedClaimsCount, services] = await Promise.all([
      this.db
        .select({
          id: warranties.id,
          jobId: warranties.jobId,
          serviceName: warranties.serviceNameSnapshot,
          providerName: organisations.name,
          providerSlug: organisations.slug,
          organisationId: warranties.organisationId,
          clientName: clientProfile.displayName,
          status: effectiveStatusSql,
          startsAt: warranties.startsAt,
          endsAt: warranties.endsAt,
          openClaimCount: openClaimCountSql,
          latestClaimStatus: latestClaimStatusSql,
          latestClaimSubject: latestClaimSubjectSql,
        })
        .from(warranties)
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, warranties.clientAccountId),
        )
        .where(filter)
        .orderBy(orderBy)
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db
        .select({ value: count() })
        .from(warranties)
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
        .innerJoin(clientProfile, eq(clientProfile.id, warranties.clientAccountId))
        .where(filter),
      this.db
        .select({
          activeWarranties: sql<number>`count(*) filter (where ${effectiveStatusSql} = 'ACTIVE' and ${warranties.endsAt} > ${now.toISOString()})`,
          expiringSoon: sql<number>`count(*) filter (where ${effectiveStatusSql} = 'ACTIVE' and ${warranties.endsAt} > ${now.toISOString()} and ${warranties.endsAt} <= ${thirtyDaysLater.toISOString()})`,
        })
        .from(warranties)
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
        .innerJoin(clientProfile, eq(clientProfile.id, warranties.clientAccountId))
        .where(baseFilter),
      this.db
        .select({ value: count() })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warrantyClaims.warrantyId, warranties.id))
        .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
        .innerJoin(clientProfile, eq(clientProfile.id, warranties.clientAccountId))
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .where(
          and(
            baseFilter,
            inArray(warrantyClaims.status, ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "RETURN_VISIT_SCHEDULED", "ESCALATED"] as const),
          ),
        ),
      this.db
        .select({ value: count() })
        .from(warrantyClaims)
        .innerJoin(warranties, eq(warrantyClaims.warrantyId, warranties.id))
        .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
        .innerJoin(clientProfile, eq(clientProfile.id, warranties.clientAccountId))
        .innerJoin(jobs, eq(jobs.id, warranties.jobId))
        .where(and(baseFilter, eq(warrantyClaims.status, "RESOLVED"))),
      this.db
        .selectDistinct({ service: warranties.serviceNameSnapshot })
        .from(warranties)
        .where(scope)
        .orderBy(warranties.serviceNameSnapshot),
    ]);

    return {
      items: rows.map((row) => ({
        ...row,
        status: row.status as WarrantyStatus,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        openClaimCount: Number(row.openClaimCount),
        latestClaimStatus: (row.latestClaimStatus as WarrantyClaimStatus | null) ?? null,
        latestClaimSubject: row.latestClaimSubject ?? null,
      })),
      page: input.page,
      pageSize: input.pageSize,
      totalItems: totals[0]?.value ?? 0,
      totalPages: Math.max(1, Math.ceil((totals[0]?.value ?? 0) / input.pageSize)),
      summary: {
        activeWarranties: Number(warrantyCounts[0]?.activeWarranties ?? 0),
        expiringSoon: Number(warrantyCounts[0]?.expiringSoon ?? 0),
        openClaims: Number(openClaimsCount[0]?.value ?? 0),
        resolvedClaims: Number(resolvedClaimsCount[0]?.value ?? 0),
      },
      services: services.map((s) => s.service).filter(Boolean) as string[],
    };
  }

  private async detail(
    warrantyId: string,
    scope: SQL<unknown>,
  ): Promise<WarrantyDetail | null> {
    const latestClaimStatusSql = sql<string | null>`(
      select wc.status from warranty_claims wc where wc.warranty_id = ${warranties.id} order by wc.sequence desc limit 1
    )`;
    const latestClaimSubjectSql = sql<string | null>`(
      select wc.subject from warranty_claims wc where wc.warranty_id = ${warranties.id} order by wc.sequence desc limit 1
    )`;
    const [row] = await this.db
      .select({
        ...getTableColumns(warranties),
        providerName: organisations.name,
        providerSlug: organisations.slug,
        clientName: clientProfile.displayName,
        effectiveStatus: effectiveStatusSql,
        openClaimCount: openClaimCountSql,
        latestClaimStatus: latestClaimStatusSql,
        latestClaimSubject: latestClaimSubjectSql,
      })
      .from(warranties)
      .innerJoin(jobs, eq(jobs.id, warranties.jobId))
      .innerJoin(organisations, eq(organisations.id, warranties.organisationId))
      .innerJoin(
        clientProfile,
        eq(clientProfile.id, warranties.clientAccountId),
      )
      .where(and(eq(warranties.id, warrantyId), scope))
      .limit(1);
    if (!row) return null;
    const claims = await this.db
      .select()
      .from(warrantyClaims)
      .where(eq(warrantyClaims.warrantyId, warrantyId))
      .orderBy(desc(warrantyClaims.sequence));
    const claimIds = claims.map((claim) => claim.id);
    const evidence = claimIds.length
      ? await this.db
          .select()
          .from(warrantyClaimEvidence)
          .where(inArray(warrantyClaimEvidence.claimId, claimIds))
          .orderBy(asc(warrantyClaimEvidence.createdAt))
      : [];
    const history = claimIds.length
      ? await this.db
          .select()
          .from(warrantyClaimHistory)
          .where(inArray(warrantyClaimHistory.claimId, claimIds))
          .orderBy(asc(warrantyClaimHistory.createdAt))
      : [];
    return {
      id: row.id,
      jobId: row.jobId,
      organisationId: row.organisationId,
      clientAccountId: row.clientAccountId,
      serviceName: row.serviceNameSnapshot,
      providerName: row.providerName,
      providerSlug: row.providerSlug,
      clientName: row.clientName,
      status: row.effectiveStatus as WarrantyStatus,
      termsSnapshot: row.termsSnapshot,
      exclusionsSnapshot: row.exclusionsSnapshot,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      openClaimCount: Number(row.openClaimCount),
      latestClaimStatus: (row.latestClaimStatus as WarrantyClaimStatus | null) ?? null,
      latestClaimSubject: row.latestClaimSubject ?? null,
      claims: claims.map((claim) => ({
        id: claim.id,
        sequence: claim.sequence,
        status: claim.status as WarrantyClaimStatus,
        subject: claim.subject,
        description: claim.description,
        preferredResolution: claim.preferredResolution,
        decisionReason: claim.decisionReason,
        returnVisitStartsAt: iso(claim.returnVisitStartsAt),
        returnVisitEndsAt: iso(claim.returnVisitEndsAt),
        resolutionNotes: claim.resolutionNotes,
        lockVersion: claim.lockVersion,
        submittedAt: claim.submittedAt.toISOString(),
        reviewedAt: iso(claim.reviewedAt),
        resolvedAt: iso(claim.resolvedAt),
        rejectedAt: iso(claim.rejectedAt),
        escalatedAt: iso(claim.escalatedAt),
        evidence: evidence
          .filter((item) => item.claimId === claim.id)
          .map((item) => ({
            id: item.id,
            assetId: item.assetId,
            evidenceType:
              item.evidenceType as "SUBMISSION" | "REVIEW" | "RESOLUTION",
            caption: item.caption,
            createdAt: item.createdAt.toISOString(),
          })),
        history: history
          .filter((item) => item.claimId === claim.id)
          .map((item) => ({
            id: item.id,
            action: item.action,
            fromStatus: item.fromStatus as WarrantyClaimStatus | null,
            toStatus: item.toStatus as WarrantyClaimStatus,
            reason: item.reason,
            createdAt: item.createdAt.toISOString(),
          })),
      })),
    };
  }
}

function professionalScope(scope: ProfessionalWarrantyScope) {
  return and(
    eq(warranties.organisationId, scope.organisationId),
    ...(scope.assignedJobsOnly
      ? [
          sql`exists (
            select 1 from ${jobAssignments}
            where ${jobAssignments.jobId} = ${warranties.jobId}
              and ${jobAssignments.membershipId} = ${scope.membershipId}
              and ${jobAssignments.active} = true
          )`,
        ]
      : []),
  )!;
}

async function validEvidenceAssets(
  tx: Tx,
  assetIds: string[],
  organisationId: string,
  actorAccountId: string,
) {
  if (assetIds.length === 0) return true;
  if (new Set(assetIds).size !== assetIds.length) return false;
  const rows = await tx
    .select({ id: fileAssets.id })
    .from(fileAssets)
    .where(
      and(
        inArray(fileAssets.id, assetIds),
        eq(fileAssets.organisationId, organisationId),
        eq(fileAssets.ownerAccountId, actorAccountId),
        eq(fileAssets.purpose, "WARRANTY_EVIDENCE"),
        eq(fileAssets.visibility, "private"),
        eq(fileAssets.status, "ready"),
        sql`${fileAssets.linkedEntityType} is null`,
      ),
    );
  return rows.length === assetIds.length;
}

async function linkEvidence(
  tx: Tx,
  input: {
    claimId: string;
    assetIds: string[];
    actorAccountId: string;
    evidenceType: "SUBMISSION" | "REVIEW" | "RESOLUTION";
  },
) {
  if (input.assetIds.length === 0) return;
  await tx.insert(warrantyClaimEvidence).values(
    input.assetIds.map((assetId) => ({
      claimId: input.claimId,
      assetId,
      addedByAccountId: input.actorAccountId,
      evidenceType: input.evidenceType,
    })),
  );
  await tx
    .update(fileAssets)
    .set({
      linkedEntityType: "warranty_claim",
      linkedEntityId: input.claimId,
      updatedAt: new Date(),
    })
    .where(inArray(fileAssets.id, input.assetIds));
}

async function recordClaimChange(
  tx: Tx,
  input: {
    claimId: string;
    warrantyId: string;
    organisationId: string;
    actorAccountId: string;
    action: string;
    fromStatus: WarrantyClaimStatus | null;
    toStatus: WarrantyClaimStatus;
    reason?: string;
    correlationId?: string;
    payload: Record<string, unknown>;
  },
) {
  const [history] = await tx
    .insert(warrantyClaimHistory)
    .values({
      claimId: input.claimId,
      actorAccountId: input.actorAccountId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
    })
    .returning({ id: warrantyClaimHistory.id });
  const eventTypes: Record<string, string> = {
    SUBMITTED: "warranty.claim_submitted",
    START_REVIEW: "warranty.claim_under_review",
    ACCEPT: "warranty.claim_accepted",
    REJECT: "warranty.claim_rejected",
    ESCALATE: "warranty.claim_escalated",
    RETURN_VISIT_SCHEDULED: "warranty.return_visit_scheduled",
    RESOLVED: "warranty.resolved",
  };
  await tx.insert(outboxEvents).values({
    eventType: eventTypes[input.action] ?? "warranty.claim_updated",
    eventVersion: 1,
    aggregateType: "warranty_claim",
    aggregateId: input.claimId,
    organisationId: input.organisationId,
    actorAccountId: input.actorAccountId,
    correlationId: input.correlationId,
    payload: {
      warrantyId: input.warrantyId,
      historyId: history.id,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      ...input.payload,
    },
  });
}

function claimTransition(
  status: WarrantyClaimStatus,
  action: "START_REVIEW" | "ACCEPT" | "REJECT" | "ESCALATE",
): WarrantyClaimStatus | null {
  if (action === "START_REVIEW" && status === "SUBMITTED") return "UNDER_REVIEW";
  if (action === "ACCEPT" && ["SUBMITTED", "UNDER_REVIEW"].includes(status))
    return "ACCEPTED";
  if (action === "REJECT" && ["SUBMITTED", "UNDER_REVIEW"].includes(status))
    return "REJECTED";
  if (
    action === "ESCALATE" &&
    ["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(status)
  )
    return "ESCALATED";
  return null;
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}
