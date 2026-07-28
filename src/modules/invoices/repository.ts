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
import {
  invoiceItems,
  invoices,
  paymentAdjustmentAllocations,
  paymentAdjustments,
  paymentAllocations,
  payments,
} from "../../platform/database/schema/financial";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { jobVariations, jobs } from "../../platform/database/schema/fulfilment";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import {
  buildPageResult,
  paginationOffset,
} from "../../platform/http/pagination";
import type {
  InvoiceDetail,
  InvoicePage,
  InvoiceStatus,
  InvoiceSummary,
  PaymentMethod,
  PaymentSummary,
} from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const clientProfile = alias(accountProfiles, "invoice_client_profile");
const netPaidSql = sql<number>`(
  coalesce((
    select sum(pa.amount_minor)
    from payment_allocations pa
    join invoice_items ii on ii.id = pa.invoice_item_id
    where ii.invoice_id = ${sql.raw('"invoices"."id"')}
  ), 0)
  -
  coalesce((
    select sum(paa.amount_minor)
    from payment_adjustment_allocations paa
    join payment_allocations pa on pa.id = paa.payment_allocation_id
    join invoice_items ii on ii.id = pa.invoice_item_id
    where ii.invoice_id = ${sql.raw('"invoices"."id"')}
  ), 0)
)`;
const effectiveStatusSql = sql<string>`case
  when ${invoices.status} = 'ISSUED'
    and ${invoices.dueAt} is not null
    and ${invoices.dueAt} < now()
  then 'OVERDUE'
  else ${invoices.status}
end`;

export interface ProfessionalInvoiceScope {
  organisationId: string;
}

export class InvoicesRepository {
  constructor(private readonly db: Database) {}

  async createFromJob(input: {
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
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.jobId, input.jobId))
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
      if (!job) return null;

      const [invoice] = await tx
        .insert(invoices)
        .values({
          jobId: job.id,
          organisationId: job.organisationId,
          clientAccountId: job.clientAccountId,
          createdByAccountId: input.actorAccountId,
          invoiceNumber: invoiceNumber(),
          currency: job.currency,
          subtotalMinor: job.totalMinor,
          totalMinor: job.totalMinor,
          paymentTermsSnapshot: job.paymentTermsSnapshot,
        })
        .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

      const variations = await tx
        .select({
          id: jobVariations.id,
          description: jobVariations.description,
          amountMinor: jobVariations.additionalAmountMinor,
        })
        .from(jobVariations)
        .where(
          and(
            eq(jobVariations.jobId, job.id),
            eq(jobVariations.status, "ACCEPTED"),
          ),
        )
        .orderBy(asc(jobVariations.sequence));
      await tx.insert(invoiceItems).values([
        {
          invoiceId: invoice.id,
          sourceType: "JOB_BASE",
          sourceId: job.id,
          description: job.serviceName,
          quantity: 1,
          unitPriceMinor: job.baseTotalMinor,
          totalMinor: job.baseTotalMinor,
          position: 0,
        },
        ...variations.map((variation, index) => ({
          invoiceId: invoice.id,
          sourceType: "JOB_VARIATION",
          sourceId: variation.id,
          description: variation.description,
          quantity: 1,
          unitPriceMinor: variation.amountMinor,
          totalMinor: variation.amountMinor,
          position: index + 1,
        })),
      ]);
      await tx.insert(outboxEvents).values({
        eventType: "invoice.created",
        eventVersion: 1,
        aggregateType: "invoice",
        aggregateId: invoice.id,
        organisationId: job.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          jobId: job.id,
          clientAccountId: job.clientAccountId,
          totalMinor: job.totalMinor,
          currency: job.currency,
        },
      });
      return invoice.id;
    });
  }

  async issue(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    expectedLockVersion: number;
    dueAt: Date;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [updated] = await tx
        .update(invoices)
        .set({
          status: "ISSUED",
          issuedAt: now,
          dueAt: input.dueAt,
          lockVersion: sql`${invoices.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organisationId, input.organisationId),
            eq(invoices.status, "DRAFT"),
            eq(invoices.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({
          id: invoices.id,
          clientAccountId: invoices.clientAccountId,
          totalMinor: invoices.totalMinor,
          currency: invoices.currency,
        });
      if (!updated) return false;
      await tx.insert(outboxEvents).values({
        eventType: "invoice.issued",
        eventVersion: 1,
        aggregateType: "invoice",
        aggregateId: updated.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          clientAccountId: updated.clientAccountId,
          totalMinor: updated.totalMinor,
          currency: updated.currency,
          dueAt: input.dueAt.toISOString(),
        },
      });
      return true;
    });
  }

  async cancel(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    expectedLockVersion: number;
    reason: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(invoices)
        .set({
          status: "CANCELLED",
          cancelledAt: new Date(),
          lockVersion: sql`${invoices.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organisationId, input.organisationId),
            inArray(invoices.status, ["DRAFT", "ISSUED", "OVERDUE"]),
            eq(invoices.lockVersion, input.expectedLockVersion),
            sql`${netPaidSql} = 0`,
          ),
        )
        .returning({ id: invoices.id });
      if (!updated) return false;
      await tx.insert(outboxEvents).values({
        eventType: "invoice.cancelled",
        eventVersion: 1,
        aggregateType: "invoice",
        aggregateId: updated.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: { reason: input.reason },
      });
      return true;
    });
  }

  listProfessional(input: {
    scope: ProfessionalInvoiceScope;
    status?: InvoiceStatus;
    page: number;
    pageSize: number;
  }): Promise<InvoicePage> {
    return this.list(
      eq(invoices.organisationId, input.scope.organisationId),
      input,
    );
  }

  listClient(input: {
    clientAccountId: string;
    status?: InvoiceStatus;
    page: number;
    pageSize: number;
  }): Promise<InvoicePage> {
    return this.list(
      and(
        eq(invoices.clientAccountId, input.clientAccountId),
        sql`${invoices.status} <> 'DRAFT'`,
      )!,
      input,
    );
  }

  getProfessional(
    invoiceId: string,
    organisationId: string,
  ): Promise<InvoiceDetail | null> {
    return this.detail(
      invoiceId,
      eq(invoices.organisationId, organisationId),
    );
  }

  getClient(
    invoiceId: string,
    clientAccountId: string,
  ): Promise<InvoiceDetail | null> {
    return this.detail(
      invoiceId,
      and(
        eq(invoices.clientAccountId, clientAccountId),
        sql`${invoices.status} <> 'DRAFT'`,
      )!,
    );
  }

  async listPayments(input: {
    organisationId: string;
    page: number;
    pageSize: number;
  }): Promise<{
    items: PaymentSummary[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }> {
    const allocatedSql = sql<number>`coalesce((
      select sum(pa.amount_minor) from payment_allocations pa
      where pa.payment_id = ${payments.id}
    ), 0)`;
    const adjustedSql = sql<number>`coalesce((
      select sum(paa.amount_minor)
      from payment_adjustment_allocations paa
      join payment_allocations pa on pa.id = paa.payment_allocation_id
      where pa.payment_id = ${payments.id}
    ), 0)`;
    const filter = eq(payments.organisationId, input.organisationId);
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          clientName: clientProfile.displayName,
          amountMinor: payments.amountMinor,
          allocatedMinor: allocatedSql,
          adjustedMinor: adjustedSql,
          currency: payments.currency,
          method: payments.method,
          status: payments.status,
          transactionReference: payments.transactionReference,
          paidAt: payments.paidAt,
        })
        .from(payments)
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, payments.clientAccountId),
        )
        .where(filter)
        .orderBy(desc(payments.paidAt), desc(payments.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ value: count() }).from(payments).where(filter),
    ]);
    return buildPageResult(
      rows.map((row) => ({
        ...row,
        allocatedMinor: Number(row.allocatedMinor),
        adjustedMinor: Number(row.adjustedMinor),
        method: row.method as PaymentMethod,
        status: row.status as PaymentSummary["status"],
        paidAt: row.paidAt.toISOString(),
      })),
      totals[0]?.value ?? 0,
      input,
    );
  }

  async recordPayment(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    method: PaymentMethod;
    transactionReference?: string;
    notes?: string;
    evidenceAssetId?: string;
    paidAt: Date;
    allocations: { invoiceItemId: string; amountMinor: number }[];
    correlationId?: string;
  }): Promise<{ paymentId: string; invoiceId: string } | null> {
    return this.db.transaction(async (tx) => {
      const [duplicate] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.organisationId, input.organisationId),
            eq(payments.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (duplicate) return { paymentId: duplicate.id, invoiceId: input.invoiceId };

      await tx.execute(
        sql`select id from invoices where id = ${input.invoiceId} for update`,
      );
      const [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.organisationId, input.organisationId),
            inArray(invoices.status, [
              "ISSUED",
              "PARTIALLY_PAID",
              "OVERDUE",
            ]),
          ),
        )
        .limit(1);
      if (!invoice || invoice.currency !== input.currency) return null;
      if (
        new Set(input.allocations.map((item) => item.invoiceItemId)).size !==
        input.allocations.length
      ) {
        return null;
      }
      const requestedTotal = input.allocations.reduce(
        (sum, item) => sum + item.amountMinor,
        0,
      );
      if (requestedTotal > input.amountMinor) return null;

      const itemRows = await tx
        .select({
          id: invoiceItems.id,
          totalMinor: invoiceItems.totalMinor,
          paidMinor: sql<number>`coalesce((
            select sum(pa.amount_minor)
            from payment_allocations pa
            where pa.invoice_item_id = ${sql.raw('"invoice_items"."id"')}
          ), 0) - coalesce((
            select sum(paa.amount_minor)
            from payment_adjustment_allocations paa
            join payment_allocations pa on pa.id = paa.payment_allocation_id
            where pa.invoice_item_id = ${sql.raw('"invoice_items"."id"')}
          ), 0)`,
        })
        .from(invoiceItems)
        .where(
          and(
            eq(invoiceItems.invoiceId, invoice.id),
            inArray(
              invoiceItems.id,
              input.allocations.map((item) => item.invoiceItemId),
            ),
          ),
        );
      const itemMap = new Map(itemRows.map((item) => [item.id, item]));
      if (
        input.allocations.some((allocation) => {
          const item = itemMap.get(allocation.invoiceItemId);
          return !item || allocation.amountMinor > item.totalMinor - item.paidMinor;
        })
      ) {
        return null;
      }
      if (
        input.evidenceAssetId &&
        !(await validEvidence(
          tx,
          input.evidenceAssetId,
          input.organisationId,
          input.actorAccountId,
        ))
      ) {
        return null;
      }

      const status =
        requestedTotal === input.amountMinor
          ? "ALLOCATED"
          : requestedTotal > 0
            ? "PARTIALLY_ALLOCATED"
            : "RECORDED";
      const [payment] = await tx
        .insert(payments)
        .values({
          organisationId: input.organisationId,
          clientAccountId: invoice.clientAccountId,
          recordedByAccountId: input.actorAccountId,
          idempotencyKey: input.idempotencyKey,
          status,
          amountMinor: input.amountMinor,
          currency: input.currency,
          method: input.method,
          transactionReference: input.transactionReference,
          notes: input.notes,
          evidenceAssetId: input.evidenceAssetId,
          paidAt: input.paidAt,
        })
        .returning({ id: payments.id });
      const insertedAllocations = await tx
        .insert(paymentAllocations)
        .values(
          input.allocations.map((allocation) => ({
            paymentId: payment.id,
            invoiceItemId: allocation.invoiceItemId,
            allocatedByAccountId: input.actorAccountId,
            amountMinor: allocation.amountMinor,
          })),
        )
        .returning({ id: paymentAllocations.id });
      if (input.evidenceAssetId) {
        await tx
          .update(fileAssets)
          .set({
            linkedEntityType: "payment",
            linkedEntityId: payment.id,
            updatedAt: new Date(),
          })
          .where(eq(fileAssets.id, input.evidenceAssetId));
      }
      const nextStatus = await refreshInvoiceStatus(tx, invoice.id);
      await tx.insert(outboxEvents).values([
        {
          eventType: "payment.recorded",
          eventVersion: 1,
          aggregateType: "payment",
          aggregateId: payment.id,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            invoiceId: invoice.id,
            clientAccountId: invoice.clientAccountId,
            amountMinor: input.amountMinor,
            currency: input.currency,
            manualRecord: true,
          },
        },
        {
          eventType: "payment.allocated",
          eventVersion: 1,
          aggregateType: "payment",
          aggregateId: payment.id,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            invoiceId: invoice.id,
            allocationCount: insertedAllocations.length,
            allocatedMinor: requestedTotal,
          },
        },
        ...(nextStatus === "PAID"
          ? [
              {
                eventType: "invoice.paid",
                eventVersion: 1,
                aggregateType: "invoice",
                aggregateId: invoice.id,
                organisationId: input.organisationId,
                actorAccountId: input.actorAccountId,
                correlationId: input.correlationId,
                payload: {
                  clientAccountId: invoice.clientAccountId,
                  totalMinor: invoice.totalMinor,
                  currency: invoice.currency,
                },
              },
            ]
          : []),
      ]);
      return { paymentId: payment.id, invoiceId: invoice.id };
    });
  }

  async adjustPayment(input: {
    paymentId: string;
    organisationId: string;
    actorAccountId: string;
    idempotencyKey: string;
    adjustmentType: "REVERSAL" | "REFUND";
    amountMinor: number;
    reason: string;
    transactionReference?: string;
    evidenceAssetId?: string;
    recordedAt: Date;
    correlationId?: string;
  }): Promise<{ paymentId: string; invoiceId: string } | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(
        sql`select id from payments where id = ${input.paymentId} for update`,
      );
      const [duplicate] = await tx
        .select({ id: paymentAdjustments.id })
        .from(paymentAdjustments)
        .where(
          and(
            eq(paymentAdjustments.paymentId, input.paymentId),
            eq(paymentAdjustments.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      const allocations = await allocationBalances(tx, input.paymentId);
      const invoiceId = allocations[0]?.invoiceId;
      if (duplicate && invoiceId) return { paymentId: input.paymentId, invoiceId };

      const [payment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, input.paymentId),
            eq(payments.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      const available = allocations.reduce(
        (sum, item) => sum + item.amountMinor - item.adjustedMinor,
        0,
      );
      if (
        !payment ||
        !invoiceId ||
        input.amountMinor > available ||
        input.amountMinor > payment.amountMinor
      ) {
        return null;
      }
      if (
        input.evidenceAssetId &&
        !(await validEvidence(
          tx,
          input.evidenceAssetId,
          input.organisationId,
          input.actorAccountId,
        ))
      ) {
        return null;
      }
      const [adjustment] = await tx
        .insert(paymentAdjustments)
        .values({
          paymentId: payment.id,
          recordedByAccountId: input.actorAccountId,
          idempotencyKey: input.idempotencyKey,
          adjustmentType: input.adjustmentType,
          amountMinor: input.amountMinor,
          reason: input.reason,
          transactionReference: input.transactionReference,
          evidenceAssetId: input.evidenceAssetId,
          recordedAt: input.recordedAt,
        })
        .returning({ id: paymentAdjustments.id });
      let remaining = input.amountMinor;
      const adjustmentAllocations: {
        adjustmentId: string;
        paymentAllocationId: string;
        amountMinor: number;
      }[] = [];
      for (const allocation of allocations) {
        const reversible = allocation.amountMinor - allocation.adjustedMinor;
        const amountMinor = Math.min(reversible, remaining);
        if (amountMinor > 0) {
          adjustmentAllocations.push({
            adjustmentId: adjustment.id,
            paymentAllocationId: allocation.id,
            amountMinor,
          });
          remaining -= amountMinor;
        }
      }
      await tx
        .insert(paymentAdjustmentAllocations)
        .values(adjustmentAllocations);
      if (input.evidenceAssetId) {
        await tx
          .update(fileAssets)
          .set({
            linkedEntityType: "payment_adjustment",
            linkedEntityId: adjustment.id,
            updatedAt: new Date(),
          })
          .where(eq(fileAssets.id, input.evidenceAssetId));
      }
      if (input.adjustmentType === "REVERSAL" && input.amountMinor === available) {
        await tx
          .update(payments)
          .set({ status: "REVERSED", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
      }
      await refreshInvoiceStatus(tx, invoiceId);
      await tx.insert(outboxEvents).values({
        eventType:
          input.adjustmentType === "REVERSAL"
            ? "payment.reversed"
            : "refund.recorded",
        eventVersion: 1,
        aggregateType: "payment",
        aggregateId: payment.id,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          adjustmentId: adjustment.id,
          invoiceId,
          amountMinor: input.amountMinor,
          currency: payment.currency,
        },
      });
      return { paymentId: payment.id, invoiceId };
    });
  }

  private async list(
    scope: SQL<unknown>,
    input: {
      status?: InvoiceStatus;
      page: number;
      pageSize: number;
    },
  ): Promise<InvoicePage> {
    const filter = and(
      scope,
      ...(input.status ? [sql`${effectiveStatusSql} = ${input.status}`] : []),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: invoices.id,
          invoiceNumber: invoices.invoiceNumber,
          jobId: invoices.jobId,
          serviceName: jobs.serviceName,
          providerName: organisations.name,
          clientName: clientProfile.displayName,
          status: effectiveStatusSql,
          currency: invoices.currency,
          totalMinor: invoices.totalMinor,
          paidMinor: netPaidSql,
          issuedAt: invoices.issuedAt,
          dueAt: invoices.dueAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .innerJoin(jobs, eq(jobs.id, invoices.jobId))
        .innerJoin(organisations, eq(organisations.id, invoices.organisationId))
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, invoices.clientAccountId),
        )
        .where(filter)
        .orderBy(desc(invoices.updatedAt), desc(invoices.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ value: count() }).from(invoices).where(filter),
    ]);
    return buildPageResult(
      rows.map((row) => mapSummary(row)),
      totals[0]?.value ?? 0,
      input,
    );
  }

  private async detail(
    invoiceId: string,
    scope: SQL<unknown>,
  ): Promise<InvoiceDetail | null> {
    const [row] = await this.db
      .select({
        ...getTableColumns(invoices),
        serviceName: jobs.serviceName,
        providerName: organisations.name,
        clientName: clientProfile.displayName,
        effectiveStatus: effectiveStatusSql,
        paidMinor: netPaidSql,
      })
      .from(invoices)
      .innerJoin(jobs, eq(jobs.id, invoices.jobId))
      .innerJoin(organisations, eq(organisations.id, invoices.organisationId))
      .innerJoin(
        clientProfile,
        eq(clientProfile.id, invoices.clientAccountId),
      )
      .where(and(eq(invoices.id, invoiceId), scope))
      .limit(1);
    if (!row) return null;
    const itemRows = await this.db
      .select({
        id: invoiceItems.id,
        sourceType: invoiceItems.sourceType,
        description: invoiceItems.description,
        quantity: invoiceItems.quantity,
        unitPriceMinor: invoiceItems.unitPriceMinor,
        totalMinor: invoiceItems.totalMinor,
        paidMinor: sql<number>`coalesce((
          select sum(pa.amount_minor) from payment_allocations pa
          where pa.invoice_item_id = ${sql.raw('"invoice_items"."id"')}
        ), 0) - coalesce((
          select sum(paa.amount_minor)
          from payment_adjustment_allocations paa
          join payment_allocations pa on pa.id = paa.payment_allocation_id
          where pa.invoice_item_id = ${sql.raw('"invoice_items"."id"')}
        ), 0)`,
      })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId))
      .orderBy(asc(invoiceItems.position));
    const allocationRows = await this.db
      .select({
        id: paymentAllocations.id,
        paymentId: paymentAllocations.paymentId,
        invoiceItemId: paymentAllocations.invoiceItemId,
        amountMinor: paymentAllocations.amountMinor,
        adjustedMinor: sql<number>`coalesce((
          select sum(paa.amount_minor)
          from payment_adjustment_allocations paa
          where paa.payment_allocation_id = ${sql.raw('"payment_allocations"."id"')}
        ), 0)`,
      })
      .from(paymentAllocations)
      .innerJoin(
        invoiceItems,
        eq(invoiceItems.id, paymentAllocations.invoiceItemId),
      )
      .where(eq(invoiceItems.invoiceId, invoiceId));
    const paymentIds = [...new Set(allocationRows.map((item) => item.paymentId))];
    const paymentRows = paymentIds.length
      ? await this.db
          .select()
          .from(payments)
          .where(inArray(payments.id, paymentIds))
          .orderBy(desc(payments.paidAt), desc(payments.id))
      : [];
    const adjustmentRows = paymentIds.length
      ? await this.db
          .select()
          .from(paymentAdjustments)
          .where(inArray(paymentAdjustments.paymentId, paymentIds))
          .orderBy(desc(paymentAdjustments.recordedAt))
      : [];
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      jobId: row.jobId,
      organisationId: row.organisationId,
      clientAccountId: row.clientAccountId,
      serviceName: row.serviceName,
      providerName: row.providerName,
      clientName: row.clientName,
      status: row.effectiveStatus as InvoiceStatus,
      currency: row.currency,
      subtotalMinor: row.subtotalMinor,
      taxMinor: row.taxMinor,
      totalMinor: row.totalMinor,
      paidMinor: Number(row.paidMinor),
      balanceMinor: Math.max(0, row.totalMinor - Number(row.paidMinor)),
      notes: row.notes,
      paymentTermsSnapshot: row.paymentTermsSnapshot,
      issuedAt: iso(row.issuedAt),
      dueAt: iso(row.dueAt),
      updatedAt: row.updatedAt.toISOString(),
      lockVersion: row.lockVersion,
      items: itemRows.map((item) => ({
        ...item,
        paidMinor: Number(item.paidMinor),
        sourceType: item.sourceType as InvoiceDetail["items"][number]["sourceType"],
        balanceMinor: Math.max(0, item.totalMinor - Number(item.paidMinor)),
      })),
      payments: paymentRows.map((payment) => ({
        id: payment.id,
        status: payment.status as InvoiceDetail["payments"][number]["status"],
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        method: payment.method as PaymentMethod,
        transactionReference: payment.transactionReference,
        notes: payment.notes,
        evidenceAssetId: payment.evidenceAssetId,
        paidAt: payment.paidAt.toISOString(),
        createdAt: payment.createdAt.toISOString(),
        allocations: allocationRows
          .filter((item) => item.paymentId === payment.id)
          .map((item) => ({
            id: item.id,
            invoiceItemId: item.invoiceItemId,
            amountMinor: item.amountMinor,
            adjustedMinor: Number(item.adjustedMinor),
          })),
        adjustments: adjustmentRows
          .filter((item) => item.paymentId === payment.id)
          .map((item) => ({
            id: item.id,
            adjustmentType:
              item.adjustmentType as "REVERSAL" | "REFUND",
            amountMinor: item.amountMinor,
            reason: item.reason,
            transactionReference: item.transactionReference,
            evidenceAssetId: item.evidenceAssetId,
            recordedAt: item.recordedAt.toISOString(),
          })),
      })),
    };
  }
}

async function validEvidence(
  tx: Tx,
  assetId: string,
  organisationId: string,
  actorAccountId: string,
) {
  const [asset] = await tx
    .select({ id: fileAssets.id })
    .from(fileAssets)
    .where(
      and(
        eq(fileAssets.id, assetId),
        eq(fileAssets.organisationId, organisationId),
        eq(fileAssets.ownerAccountId, actorAccountId),
        eq(fileAssets.purpose, "PAYMENT_EVIDENCE"),
        eq(fileAssets.visibility, "private"),
        eq(fileAssets.status, "ready"),
        sql`${fileAssets.linkedEntityType} is null`,
      ),
    )
    .limit(1);
  return Boolean(asset);
}

async function allocationBalances(tx: Tx, paymentId: string) {
  return tx
    .select({
      id: paymentAllocations.id,
      invoiceId: invoiceItems.invoiceId,
      amountMinor: paymentAllocations.amountMinor,
      adjustedMinor: sql<number>`coalesce((
        select sum(paa.amount_minor)
        from payment_adjustment_allocations paa
        where paa.payment_allocation_id = ${sql.raw('"payment_allocations"."id"')}
      ), 0)`,
    })
    .from(paymentAllocations)
    .innerJoin(
      invoiceItems,
      eq(invoiceItems.id, paymentAllocations.invoiceItemId),
    )
    .where(eq(paymentAllocations.paymentId, paymentId))
    .orderBy(asc(paymentAllocations.createdAt), asc(paymentAllocations.id));
}

async function refreshInvoiceStatus(
  tx: Tx,
  invoiceId: string,
): Promise<InvoiceStatus> {
  const [invoice] = await tx
    .select({
      status: invoices.status,
      totalMinor: invoices.totalMinor,
      issuedAt: invoices.issuedAt,
      dueAt: invoices.dueAt,
      paidMinor: netPaidSql,
      adjustedMinor: sql<number>`coalesce((
        select sum(paa.amount_minor)
        from payment_adjustment_allocations paa
        join payment_allocations pa on pa.id = paa.payment_allocation_id
        join invoice_items ii on ii.id = pa.invoice_item_id
        where ii.invoice_id = ${sql.raw('"invoices"."id"')}
      ), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) throw new Error("Invoice disappeared during transaction.");
  let status = invoice.status as InvoiceStatus;
  if (status !== "CANCELLED" && invoice.issuedAt) {
    if (Number(invoice.paidMinor) >= invoice.totalMinor) status = "PAID";
    else if (Number(invoice.paidMinor) > 0) status = "PARTIALLY_PAID";
    else if (Number(invoice.adjustedMinor) > 0) status = "REFUNDED";
    else if (invoice.dueAt && invoice.dueAt < new Date()) status = "OVERDUE";
    else status = "ISSUED";
  }
  await tx
    .update(invoices)
    .set({
      status,
      lockVersion: sql`${invoices.lockVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));
  return status;
}

function invoiceNumber() {
  return `INV-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function mapSummary(row: {
  id: string;
  invoiceNumber: string;
  jobId: string;
  serviceName: string;
  providerName: string;
  clientName: string;
  status: string;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  issuedAt: Date | null;
  dueAt: Date | null;
  updatedAt: Date;
}): InvoiceSummary {
  return {
    ...row,
    status: row.status as InvoiceStatus,
    paidMinor: Number(row.paidMinor),
    balanceMinor: Math.max(0, row.totalMinor - Number(row.paidMinor)),
    issuedAt: iso(row.issuedAt),
    dueAt: iso(row.dueAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null;
}
