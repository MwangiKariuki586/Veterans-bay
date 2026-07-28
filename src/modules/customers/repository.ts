import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import {
  bookings,
  quotations,
} from "../../platform/database/schema/commercial";
import {
  customerNotes,
  customerRecords,
  customerRecordTags,
  customerTags,
} from "../../platform/database/schema/customers";
import {
  invoices,
  paymentAdjustmentAllocations,
  paymentAllocations,
} from "../../platform/database/schema/financial";
import { jobs } from "../../platform/database/schema/fulfilment";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import {
  buildPageResult,
  paginationOffset,
} from "../../platform/http/pagination";
import type {
  CustomerBalance,
  CustomerDetail,
  CustomerOrigin,
  CustomerPage,
  CustomerStatus,
} from "./types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export class CustomersRepository {
  constructor(private readonly db: Database) {}

  async list(input: {
    organisationId: string;
    search?: string;
    status?: CustomerStatus;
    page: number;
    pageSize: number;
  }): Promise<CustomerPage> {
    const filter = and(
      eq(customerRecords.organisationId, input.organisationId),
      ...(input.status ? [eq(customerRecords.status, input.status)] : []),
      ...(input.search
        ? [
            or(
              ilike(customerRecords.displayName, `%${input.search}%`),
              ilike(customerRecords.email, `%${input.search}%`),
              ilike(customerRecords.phone, `%${input.search}%`),
            )!,
          ]
        : []),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(customerRecords)
        .where(filter)
        .orderBy(desc(customerRecords.updatedAt), desc(customerRecords.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ value: count() }).from(customerRecords).where(filter),
    ]);
    const tags = await this.tagsFor(rows.map((row) => row.id));
    const lastServices = rows.length
      ? await this.db
          .select({
            customerId: customerRecords.id,
            lastServiceAt: sql<Date | null>`max(${jobs.completedAt})`,
          })
          .from(customerRecords)
          .leftJoin(
            jobs,
            and(
              eq(jobs.organisationId, customerRecords.organisationId),
              eq(jobs.clientAccountId, customerRecords.accountProfileId),
            ),
          )
          .where(inArray(customerRecords.id, rows.map((row) => row.id)))
          .groupBy(customerRecords.id)
      : [];
    return buildPageResult(
      rows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        phone: row.phone,
        acquisitionSource: row.acquisitionSource as CustomerOrigin,
        status: row.status as CustomerStatus,
        duplicateOfCustomerId: row.duplicateOfCustomerId,
        tags: tags
          .filter((tag) => tag.customerId === row.id)
          .map((tag) => tag.name),
        lastServiceAt:
          lastServices
            .find((item) => item.customerId === row.id)
            ?.lastServiceAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      totals[0]?.value ?? 0,
      input,
    );
  }

  async create(input: {
    organisationId: string;
    actorAccountId: string;
    displayName: string;
    email?: string;
    phone?: string;
    acquisitionSource: CustomerOrigin;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const email = normalizeEmail(input.email);
      const phone = normalizePhone(input.phone);
      const [duplicate] = await tx
        .select({ id: customerRecords.id })
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.organisationId, input.organisationId),
            or(
              ...(email ? [eq(customerRecords.email, email)] : []),
              ...(phone ? [eq(customerRecords.phone, phone)] : []),
            ),
          ),
        )
        .limit(1);
      const [record] = await tx
        .insert(customerRecords)
        .values({
          organisationId: input.organisationId,
          createdByAccountId: input.actorAccountId,
          displayName: input.displayName,
          email,
          phone,
          acquisitionSource: input.acquisitionSource,
          status: duplicate ? "DUPLICATE_CANDIDATE" : "IMPORTED",
          duplicateOfCustomerId: duplicate?.id,
        })
        .returning();
      await customerEvent(
        tx,
        record,
        input.actorAccountId,
        "customer.added",
        input.correlationId,
      );
      return { id: record.id, duplicateOfCustomerId: duplicate?.id ?? null };
    });
  }

  async get(
    customerId: string,
    organisationId: string,
  ): Promise<CustomerDetail | null> {
    const [row] = await this.db
      .select()
      .from(customerRecords)
      .where(
        and(
          eq(customerRecords.id, customerId),
          eq(customerRecords.organisationId, organisationId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [tags, notes, bookingRows, jobRows, quotationRows] =
      await Promise.all([
        this.tagsFor([row.id]),
        this.db
          .select({
            ...getTableColumns(customerNotes),
            authorName: accountProfiles.displayName,
          })
          .from(customerNotes)
          .innerJoin(
            accountProfiles,
            eq(accountProfiles.id, customerNotes.authorAccountId),
          )
          .where(
            and(
              eq(customerNotes.customerId, row.id),
              eq(customerNotes.organisationId, organisationId),
            ),
          )
          .orderBy(desc(customerNotes.createdAt)),
        row.accountProfileId
          ? this.db
              .select()
              .from(bookings)
              .where(
                and(
                  eq(bookings.organisationId, organisationId),
                  eq(bookings.clientAccountId, row.accountProfileId),
                ),
              )
              .orderBy(desc(bookings.createdAt))
              .limit(20)
          : [],
        row.accountProfileId
          ? this.db
              .select()
              .from(jobs)
              .where(
                and(
                  eq(jobs.organisationId, organisationId),
                  eq(jobs.clientAccountId, row.accountProfileId),
                ),
              )
              .orderBy(desc(jobs.createdAt))
              .limit(20)
          : [],
        row.accountProfileId
          ? this.db
              .select()
              .from(quotations)
              .where(
                and(
                  eq(quotations.organisationId, organisationId),
                  eq(quotations.clientAccountId, row.accountProfileId),
                ),
              )
              .orderBy(desc(quotations.createdAt))
              .limit(20)
          : [],
      ]);
    const history = [
      ...bookingRows.map((item) => ({
        id: item.id,
        kind: "BOOKING" as const,
        label: "Service booking",
        status: item.status,
        occurredAt: item.createdAt.toISOString(),
      })),
      ...jobRows.map((item) => ({
        id: item.id,
        kind: "JOB" as const,
        label: item.serviceName,
        status: item.status,
        occurredAt: item.createdAt.toISOString(),
      })),
      ...quotationRows.map((item) => ({
        id: item.id,
        kind: "QUOTATION" as const,
        label: `Quotation v${item.currentVersionNumber}`,
        status: item.status,
        occurredAt: item.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return {
      id: row.id,
      accountProfileId: row.accountProfileId,
      displayName: row.displayName,
      email: row.email,
      phone: row.phone,
      acquisitionSource: row.acquisitionSource as CustomerOrigin,
      status: row.status as CustomerStatus,
      duplicateOfCustomerId: row.duplicateOfCustomerId,
      tags: tags.map((tag) => tag.name),
      lastServiceAt:
        jobRows.find((job) => job.completedAt)?.completedAt?.toISOString() ??
        null,
      createdAt: row.createdAt.toISOString(),
      notes: notes.map((note) => ({
        id: note.id,
        body: note.body,
        authorName: note.authorName,
        createdAt: note.createdAt.toISOString(),
      })),
      history,
    };
  }

  async addNote(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    body: string;
  }) {
    const [record] = await this.db
      .select({ id: customerRecords.id })
      .from(customerRecords)
      .where(
        and(
          eq(customerRecords.id, input.customerId),
          eq(customerRecords.organisationId, input.organisationId),
        ),
      )
      .limit(1);
    if (!record) return false;
    await this.db
      .insert(customerNotes)
      .values({
        customerId: input.customerId,
        organisationId: input.organisationId,
        authorAccountId: input.actorAccountId,
        body: input.body,
      });
    return true;
  }

  async addTag(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    name: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.id, input.customerId),
            eq(customerRecords.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!record) return false;
      const [inserted] = await tx
        .insert(customerTags)
        .values({
          organisationId: input.organisationId,
          name: input.name,
          createdByAccountId: input.actorAccountId,
        })
        .onConflictDoNothing({
          target: [customerTags.organisationId, customerTags.name],
        })
        .returning();
      const [tag] = inserted
        ? [inserted]
        : await tx
            .select()
            .from(customerTags)
            .where(
              and(
                eq(customerTags.organisationId, input.organisationId),
                eq(customerTags.name, input.name),
              ),
            )
            .limit(1);
      await tx
        .insert(customerRecordTags)
        .values({
          customerId: record.id,
          tagId: tag.id,
          addedByAccountId: input.actorAccountId,
        })
        .onConflictDoNothing();
      await customerEvent(
        tx,
        record,
        input.actorAccountId,
        "customer.tagged",
        input.correlationId,
        { tag: input.name },
      );
      return true;
    });
  }

  async invite(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    correlationId?: string;
  }) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.id, input.customerId),
            eq(customerRecords.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!record?.email || record.status === "REGISTERED") return false;
      await tx
        .update(customerRecords)
        .set({
          status: "INVITATION_PENDING",
          invitedAt: new Date(),
          acquisitionSource:
            record.acquisitionSource === "PROFESSIONAL_IMPORTED"
              ? "PROFESSIONAL_INVITED"
              : record.acquisitionSource,
          updatedAt: new Date(),
        })
        .where(eq(customerRecords.id, record.id));
      await customerEvent(
        tx,
        record,
        input.actorAccountId,
        "customer.invited",
        input.correlationId,
      );
      return true;
    });
  }

  async reconcile(input: { customerId: string; organisationId: string }) {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select()
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.id, input.customerId),
            eq(customerRecords.organisationId, input.organisationId),
          ),
        )
        .limit(1);
      if (!record?.email) return false;
      const [account] = await tx
        .select()
        .from(accountProfiles)
        .where(sql`lower(${accountProfiles.primaryEmail}) = ${record.email}`)
        .limit(1);
      if (!account) return false;
      const [linked] = await tx
        .select({ id: customerRecords.id })
        .from(customerRecords)
        .where(
          and(
            eq(customerRecords.organisationId, input.organisationId),
            eq(customerRecords.accountProfileId, account.id),
          ),
        )
        .limit(1);
      if (linked && linked.id !== record.id) {
        await tx
          .update(customerRecords)
          .set({
            status: "DUPLICATE_CANDIDATE",
            duplicateOfCustomerId: linked.id,
            updatedAt: new Date(),
          })
          .where(eq(customerRecords.id, record.id));
        return true;
      }
      await tx
        .update(customerRecords)
        .set({
          accountProfileId: account.id,
          displayName: account.displayName,
          email: normalizeEmail(account.primaryEmail),
          phone: record.phone ?? account.phone,
          status: "REGISTERED",
          reconciledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customerRecords.id, record.id));
      return true;
    });
  }

  async balance(
    customerId: string,
    organisationId: string,
  ): Promise<CustomerBalance | null> {
    const [record] = await this.db
      .select()
      .from(customerRecords)
      .where(
        and(
          eq(customerRecords.id, customerId),
          eq(customerRecords.organisationId, organisationId),
        ),
      )
      .limit(1);
    if (!record?.accountProfileId)
      return {
        invoiceTotalMinor: 0,
        paidMinor: 0,
        outstandingMinor: 0,
        currency: "KES",
      };
    const result = await this.db.execute(sql`
      select
        coalesce(sum(i.total_minor), 0)::bigint as invoice_total,
        coalesce(sum((
          select coalesce(sum(
            pa.amount_minor - coalesce((
              select sum(paa.amount_minor)
              from ${paymentAdjustmentAllocations} paa
              where paa.payment_allocation_id = pa.id
            ), 0)
          ), 0)
          from ${paymentAllocations} pa
          where pa.invoice_id = i.id
        )), 0)::bigint as paid,
        coalesce(max(i.currency), 'KES') as currency
      from ${invoices} i
      where i.organisation_id = ${organisationId}
        and i.client_account_id = ${record.accountProfileId}
        and i.status <> 'CANCELLED'
    `);
    const row = result.rows[0] as unknown as {
      invoice_total: string | number;
      paid: string | number;
      currency: string;
    };
    const total = Number(row.invoice_total);
    const paid = Number(row.paid);
    return {
      invoiceTotalMinor: total,
      paidMinor: paid,
      outstandingMinor: total - paid,
      currency: row.currency,
    };
  }

  private async tagsFor(customerIds: string[]) {
    if (!customerIds.length) return [];
    return this.db
      .select({
        customerId: customerRecordTags.customerId,
        name: customerTags.name,
      })
      .from(customerRecordTags)
      .innerJoin(customerTags, eq(customerTags.id, customerRecordTags.tagId))
      .where(inArray(customerRecordTags.customerId, customerIds));
  }
}

export async function ensureRegisteredCustomer(
  tx: Tx,
  input: {
    organisationId: string;
    clientAccountId: string;
    actorAccountId: string;
    origin: string;
  },
) {
  const [account] = await tx
    .select()
    .from(accountProfiles)
    .where(eq(accountProfiles.id, input.clientAccountId))
    .limit(1);
  if (!account) return;
  await tx
    .insert(customerRecords)
    .values({
      organisationId: input.organisationId,
      accountProfileId: account.id,
      displayName: account.displayName,
      email: normalizeEmail(account.primaryEmail),
      phone: normalizePhone(account.phone),
      acquisitionSource:
        input.origin === "REPEAT_BOOKING"
          ? "REPEAT_CLIENT"
          : input.origin === "PROFESSIONAL_CUSTOMER"
            ? "PROFESSIONAL_INVITED"
            : "MARKETPLACE_ACQUIRED",
      status: "REGISTERED",
      createdByAccountId: input.actorAccountId,
      reconciledAt: new Date(),
    })
    .onConflictDoNothing();
}
function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() || null;
}
function normalizePhone(value?: string | null) {
  return value?.replace(/[^\d+]/g, "") || null;
}
async function customerEvent(
  tx: Tx,
  record: typeof customerRecords.$inferSelect,
  actorAccountId: string,
  eventType: string,
  correlationId?: string,
  extra: Record<string, unknown> = {},
) {
  await tx
    .insert(outboxEvents)
    .values({
      eventType,
      eventVersion: 1,
      aggregateType: "customer",
      aggregateId: record.id,
      organisationId: record.organisationId,
      actorAccountId,
      correlationId,
      payload: { customerId: record.id, ...extra },
    });
}
