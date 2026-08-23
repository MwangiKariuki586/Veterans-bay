import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  isNotNull,
  lt,
  lte,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import {
  bookings,
  paymentRequirements,
} from "../../platform/database/schema/commercial";
import {
  engagementActivities,
  engagementConversations,
} from "../../platform/database/schema/engagement-conversations";
import { organisations } from "../../platform/database/schema/organisations";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { professionalServices } from "../../platform/database/schema/professional-services";
import {
  organisationMemberships,
  roles,
} from "../../platform/database/schema/roles";
import {
  availabilityBlocks,
  availabilityRules,
  bookingHistory,
  bookingReservations,
} from "../../platform/database/schema/scheduling";
import {
  serviceRequestHistory,
  serviceRequests,
} from "../../platform/database/schema/service-requests";
import {
  buildPageResult,
  paginationOffset,
  type PageResult,
} from "../../platform/http/pagination";
import {
  cancelJobForBooking,
  ensureJobForBooking,
} from "../jobs/repository";
import { ensureRegisteredCustomer } from "../customers/repository";
import { customerRecords } from "../../platform/database/schema/customers";
import type {
  AvailabilityConfiguration,
  BookingDetail,
  BookingOrigin,
  BookingStatus,
  BookingSummary,
  CalendarEntry,
  ClientCreateBookingInput,
  ProfessionalCreateBookingInput,
} from "./types";

const clientProfile = alias(accountProfiles, "booking_client_profile");
const assignedProfile = alias(accountProfiles, "booking_assigned_profile");
const createdByProfile = alias(accountProfiles, "booking_created_by_profile");

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface BookingSlotInputs {
  rules: Array<{
    membershipId: string;
    memberName: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
    timezone: string;
  }>;
  blocks: Array<{
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
  }>;
  reservations: Array<{
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
  }>;
}

export type ScheduleResult =
  | { kind: "scheduled" }
  | { kind: "stale" }
  | { kind: "ineligible" }
  | { kind: "deposit_required" };

export class BookingsRepository {
  constructor(private readonly db: Database) {}

  listProfessional(input: {
    organisationId: string;
    status?: BookingStatus;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    return this.list({
      ...input,
      scope: eq(bookings.organisationId, input.organisationId),
    });
  }

  listClient(input: {
    clientAccountId: string;
    status?: BookingStatus;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    return this.list({
      ...input,
      scope: eq(bookings.clientAccountId, input.clientAccountId),
    });
  }

  getProfessional(organisationId: string, bookingId: string) {
    return this.detail(bookingId, eq(bookings.organisationId, organisationId));
  }

  getClient(clientAccountId: string, bookingId: string) {
    return this.detail(
      bookingId,
      eq(bookings.clientAccountId, clientAccountId),
    );
  }

  async listAvailability(
    organisationId: string,
  ): Promise<AvailabilityConfiguration> {
    const [members, rules, blocks] = await Promise.all([
      this.db
        .select({
          membershipId: organisationMemberships.id,
          accountProfileId: organisationMemberships.accountProfileId,
          displayName: accountProfiles.displayName,
          roleName: roles.name,
        })
        .from(organisationMemberships)
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .innerJoin(roles, eq(roles.id, organisationMemberships.roleId))
        .where(
          and(
            eq(organisationMemberships.organisationId, organisationId),
            eq(organisationMemberships.status, "active"),
            eq(accountProfiles.status, "active"),
          ),
        )
        .orderBy(asc(accountProfiles.displayName)),
      this.db
        .select({
          id: availabilityRules.id,
          membershipId: availabilityRules.membershipId,
          memberName: accountProfiles.displayName,
          weekday: availabilityRules.weekday,
          startMinute: availabilityRules.startMinute,
          endMinute: availabilityRules.endMinute,
          timezone: availabilityRules.timezone,
          active: availabilityRules.active,
        })
        .from(availabilityRules)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, availabilityRules.membershipId),
        )
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .where(eq(availabilityRules.organisationId, organisationId))
        .orderBy(
          asc(accountProfiles.displayName),
          asc(availabilityRules.weekday),
          asc(availabilityRules.startMinute),
        ),
      this.db
        .select({
          id: availabilityBlocks.id,
          membershipId: availabilityBlocks.membershipId,
          memberName: accountProfiles.displayName,
          startsAt: availabilityBlocks.startsAt,
          endsAt: availabilityBlocks.endsAt,
          reason: availabilityBlocks.reason,
        })
        .from(availabilityBlocks)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, availabilityBlocks.membershipId),
        )
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .where(
          and(
            eq(availabilityBlocks.organisationId, organisationId),
            gte(availabilityBlocks.endsAt, new Date()),
          ),
        )
        .orderBy(asc(availabilityBlocks.startsAt)),
    ]);
    return {
      members,
      rules,
      blocks: blocks.map((block) => ({
        ...block,
        startsAt: block.startsAt.toISOString(),
        endsAt: block.endsAt.toISOString(),
      })),
    };
  }

  async replaceAvailability(input: {
    organisationId: string;
    actorAccountId: string;
    membershipId: string;
    timezone: string;
    rules: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (
        !(await activeMembership(
          tx,
          input.organisationId,
          input.membershipId,
        ))
      ) {
        return false;
      }
      await tx
        .delete(availabilityRules)
        .where(
          and(
            eq(availabilityRules.organisationId, input.organisationId),
            eq(availabilityRules.membershipId, input.membershipId),
          ),
        );
      if (input.rules.length > 0) {
        await tx.insert(availabilityRules).values(
          input.rules.map((rule) => ({
            organisationId: input.organisationId,
            membershipId: input.membershipId,
            timezone: input.timezone,
            createdByAccountId: input.actorAccountId,
            ...rule,
          })),
        );
      }
      return true;
    });
  }

  async createAvailabilityBlock(input: {
    organisationId: string;
    actorAccountId: string;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
  }): Promise<boolean> {
    if (
      !(await activeMembership(
        this.db,
        input.organisationId,
        input.membershipId,
      ))
    ) {
      return false;
    }
    await this.db.insert(availabilityBlocks).values({
      organisationId: input.organisationId,
      membershipId: input.membershipId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason,
      createdByAccountId: input.actorAccountId,
    });
    return true;
  }

  async deleteAvailabilityBlock(
    organisationId: string,
    blockId: string,
  ): Promise<boolean> {
    const deleted = await this.db
      .delete(availabilityBlocks)
      .where(
        and(
          eq(availabilityBlocks.id, blockId),
          eq(availabilityBlocks.organisationId, organisationId),
        ),
      )
      .returning({ id: availabilityBlocks.id });
    return deleted.length === 1;
  }

  async slotInputs(input: {
    organisationId: string;
    from: Date;
    to: Date;
  }): Promise<BookingSlotInputs> {
    const [rules, blocks, reservations] = await Promise.all([
      this.db
        .select({
          membershipId: availabilityRules.membershipId,
          memberName: accountProfiles.displayName,
          weekday: availabilityRules.weekday,
          startMinute: availabilityRules.startMinute,
          endMinute: availabilityRules.endMinute,
          timezone: availabilityRules.timezone,
        })
        .from(availabilityRules)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, availabilityRules.membershipId),
        )
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .where(
          and(
            eq(availabilityRules.organisationId, input.organisationId),
            eq(availabilityRules.active, true),
            eq(organisationMemberships.status, "active"),
            eq(accountProfiles.status, "active"),
          ),
        ),
      this.db
        .select({
          membershipId: availabilityBlocks.membershipId,
          startsAt: availabilityBlocks.startsAt,
          endsAt: availabilityBlocks.endsAt,
        })
        .from(availabilityBlocks)
        .where(
          and(
            eq(availabilityBlocks.organisationId, input.organisationId),
            lt(availabilityBlocks.startsAt, input.to),
            sql`${availabilityBlocks.endsAt} > ${input.from}`,
          ),
        ),
      this.db
        .select({
          membershipId: bookingReservations.membershipId,
          startsAt: bookingReservations.startsAt,
          endsAt: bookingReservations.endsAt,
        })
        .from(bookingReservations)
        .where(
          and(
            eq(bookingReservations.organisationId, input.organisationId),
            eq(bookingReservations.status, "ACTIVE"),
            lt(bookingReservations.startsAt, input.to),
            sql`${bookingReservations.endsAt} > ${input.from}`,
          ),
        ),
    ]);
    return { rules, blocks, reservations };
  }

  async slotInputsByOrganisation(input: {
    organisationIds: string[];
    from: Date;
    to: Date;
  }): Promise<Map<string, BookingSlotInputs>> {
    const organisationIds = [...new Set(input.organisationIds)];
    if (organisationIds.length === 0) return new Map();

    const [rules, blocks, reservations] = await Promise.all([
      this.db
        .select({
          organisationId: availabilityRules.organisationId,
          membershipId: availabilityRules.membershipId,
          memberName: accountProfiles.displayName,
          weekday: availabilityRules.weekday,
          startMinute: availabilityRules.startMinute,
          endMinute: availabilityRules.endMinute,
          timezone: availabilityRules.timezone,
        })
        .from(availabilityRules)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, availabilityRules.membershipId),
        )
        .innerJoin(
          accountProfiles,
          eq(accountProfiles.id, organisationMemberships.accountProfileId),
        )
        .where(
          and(
            inArray(availabilityRules.organisationId, organisationIds),
            eq(availabilityRules.active, true),
            eq(organisationMemberships.status, "active"),
            eq(accountProfiles.status, "active"),
          ),
        ),
      this.db
        .select({
          organisationId: availabilityBlocks.organisationId,
          membershipId: availabilityBlocks.membershipId,
          startsAt: availabilityBlocks.startsAt,
          endsAt: availabilityBlocks.endsAt,
        })
        .from(availabilityBlocks)
        .where(
          and(
            inArray(availabilityBlocks.organisationId, organisationIds),
            lt(availabilityBlocks.startsAt, input.to),
            sql`${availabilityBlocks.endsAt} > ${input.from}`,
          ),
        ),
      this.db
        .select({
          organisationId: bookingReservations.organisationId,
          membershipId: bookingReservations.membershipId,
          startsAt: bookingReservations.startsAt,
          endsAt: bookingReservations.endsAt,
        })
        .from(bookingReservations)
        .where(
          and(
            inArray(bookingReservations.organisationId, organisationIds),
            eq(bookingReservations.status, "ACTIVE"),
            lt(bookingReservations.startsAt, input.to),
            sql`${bookingReservations.endsAt} > ${input.from}`,
          ),
        ),
    ]);

    const result = new Map(
      organisationIds.map((organisationId) => [
        organisationId,
        { rules: [], blocks: [], reservations: [] } as BookingSlotInputs,
      ]),
    );
    for (const { organisationId, ...rule } of rules) {
      result.get(organisationId)?.rules.push(rule);
    }
    for (const { organisationId, ...block } of blocks) {
      result.get(organisationId)?.blocks.push(block);
    }
    for (const { organisationId, ...reservation } of reservations) {
      result.get(organisationId)?.reservations.push(reservation);
    }
    return result;
  }

  async directServiceSlotContext(
    professionalSlug: string,
    serviceSlug: string,
  ) {
    const [service] = await this.db
      .select({
        organisationId: professionalServices.organisationId,
        durationMinutes: professionalServices.estimatedDurationMinutes,
      })
      .from(professionalServices)
      .innerJoin(
        organisations,
        eq(organisations.id, professionalServices.organisationId),
      )
      .where(
        and(
          eq(professionalServices.slug, serviceSlug),
          eq(organisations.slug, professionalSlug),
          eq(organisations.status, "active"),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
          eq(professionalServices.directBookingEnabled, true),
          ne(professionalServices.pricingModel, "custom_quote"),
          isNotNull(professionalServices.priceMinor),
          isNotNull(professionalServices.estimatedDurationMinutes),
        ),
      )
      .limit(1);
    return service?.durationMinutes
      ? {
          organisationId: service.organisationId,
          durationMinutes: service.durationMinutes,
        }
      : null;
  }

  async currentServiceSlotContext(serviceId: string) {
    const [service] = await this.db
      .select({
        organisationId: professionalServices.organisationId,
        durationMinutes: professionalServices.estimatedDurationMinutes,
      })
      .from(professionalServices)
      .innerJoin(
        organisations,
        eq(organisations.id, professionalServices.organisationId),
      )
      .where(
        and(
          eq(professionalServices.id, serviceId),
          eq(organisations.status, "active"),
          eq(professionalServices.status, "published"),
          eq(professionalServices.moderationStatus, "clear"),
          eq(professionalServices.directBookingEnabled, true),
          ne(professionalServices.pricingModel, "custom_quote"),
          isNotNull(professionalServices.priceMinor),
          isNotNull(professionalServices.estimatedDurationMinutes),
        ),
      )
      .limit(1);
    return service?.durationMinutes
      ? {
          organisationId: service.organisationId,
          durationMinutes: service.durationMinutes,
        }
      : null;
  }

  async listCalendar(input: {
    organisationId: string;
    from: Date;
    to: Date;
    membershipId?: string;
  }): Promise<CalendarEntry[]> {
    return (
      await this.db
        .select({
          id: bookings.id,
          serviceName: sql<string>`coalesce(${professionalServices.name}, ${serviceRequests.category}, 'Service booking')`,
          clientName: clientProfile.displayName,
          status: bookings.status,
          membershipId: organisationMemberships.id,
          assignmentName: assignedProfile.displayName,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          timezone: bookings.timezone,
        })
        .from(bookings)
        .innerJoin(
          organisationMemberships,
          eq(organisationMemberships.id, bookings.assignedMembershipId),
        )
        .innerJoin(
          assignedProfile,
          eq(assignedProfile.id, organisationMemberships.accountProfileId),
        )
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, bookings.clientAccountId),
        )
        .leftJoin(
          professionalServices,
          eq(professionalServices.id, bookings.professionalServiceId),
        )
        .leftJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
        .where(
          and(
            eq(bookings.organisationId, input.organisationId),
            isNotNull(bookings.startsAt),
            isNotNull(bookings.endsAt),
            lt(bookings.startsAt, input.to),
            sql`${bookings.endsAt} > ${input.from}`,
            ...(input.membershipId
              ? [eq(bookings.assignedMembershipId, input.membershipId)]
              : []),
          ),
        )
        .orderBy(asc(bookings.startsAt), asc(bookings.id))
    ).map((row) => ({
      ...row,
      status: row.status as BookingStatus,
      startsAt: row.startsAt!.toISOString(),
      endsAt: row.endsAt!.toISOString(),
    }));
  }

  async createClient(input: {
    clientAccountId: string;
    actorAccountId: string;
    values: ClientCreateBookingInput;
    correlationId?: string;
  }): Promise<string | null> {
    const values = input.values;
    if (values.origin === "REPEAT_BOOKING") {
      return this.createRepeat({ ...input, values });
    }
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .select(getTableColumns(professionalServices))
        .from(professionalServices)
        .innerJoin(
          organisations,
          eq(organisations.id, professionalServices.organisationId),
        )
        .where(
          and(
            eq(professionalServices.slug, values.serviceSlug),
            eq(organisations.slug, values.professionalSlug),
            eq(organisations.status, "active"),
            eq(professionalServices.status, "published"),
            eq(professionalServices.moderationStatus, "clear"),
            eq(professionalServices.directBookingEnabled, true),
            ne(professionalServices.pricingModel, "custom_quote"),
            isNotNull(professionalServices.priceMinor),
            isNotNull(professionalServices.estimatedDurationMinutes),
          ),
        )
        .limit(1);
      if (!service?.estimatedDurationMinutes) return null;
      const startsAt = new Date(values.requestedStartAt);
      const endsAt = addMinutes(startsAt, service.estimatedDurationMinutes);
      if (
        !(await windowAvailable(tx, {
          organisationId: service.organisationId,
          membershipId: values.membershipId,
          startsAt,
          endsAt,
        }))
      ) {
        return null;
      }
      return insertBooking(tx, {
        origin: "DIRECT_SERVICE",
        organisationId: service.organisationId,
        clientAccountId: input.clientAccountId,
        actorAccountId: input.actorAccountId,
        professionalServiceId: service.id,
        requestedMembershipId: values.membershipId,
        requestedStartAt: startsAt,
        requestedEndAt: endsAt,
        timezone: values.timezone,
        cancellationAcknowledgedAt: new Date(),
        currency: service.currency,
        totalMinor: service.priceMinor ?? 0,
        expectedDurationMinutes: service.estimatedDurationMinutes,
        scope: service.description ?? service.name,
        exclusions: "Work outside the published service scope is excluded.",
        warrantyTerms:
          service.warrantyTerms ??
          "Warranty eligibility will follow the completed service record.",
        paymentTerms:
          service.priceMinor && service.priceMinor > 0
            ? "Payment is recorded separately after service confirmation."
            : "No advance payment is required.",
        correlationId: input.correlationId,
      });
    });
  }

  async createProfessional(input: {
    organisationId: string;
    actorAccountId: string;
    values: ProfessionalCreateBookingInput;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [service] = await tx
        .select()
        .from(professionalServices)
        .where(
          and(
            eq(professionalServices.id, input.values.serviceId),
            eq(professionalServices.organisationId, input.organisationId),
            eq(professionalServices.status, "published"),
            eq(professionalServices.moderationStatus, "clear"),
            eq(professionalServices.directBookingEnabled, true),
            ne(professionalServices.pricingModel, "custom_quote"),
            isNotNull(professionalServices.priceMinor),
            isNotNull(professionalServices.estimatedDurationMinutes),
          ),
        )
        .limit(1);
      if (!service?.estimatedDurationMinutes) return null;
      let clientAccountId: string;
      let requestId: string | undefined;
      if (input.values.origin === "APPROVED_ASSESSMENT") {
        const [request] = await tx
          .select({
            id: serviceRequests.id,
            clientAccountId: serviceRequests.clientAccountId,
          })
          .from(serviceRequests)
          .where(
            and(
              eq(serviceRequests.id, input.values.requestId),
              eq(serviceRequests.organisationId, input.organisationId),
              eq(serviceRequests.status, "ASSESSMENT_REQUIRED"),
            ),
          )
          .limit(1);
        if (!request) return null;
        requestId = request.id;
        clientAccountId = request.clientAccountId;
      } else if (input.values.origin === "PROFESSIONAL_CUSTOMER") {
        const [client] = await tx
          .select({ id: accountProfiles.id })
          .from(accountProfiles)
          .where(
            and(
              eq(accountProfiles.id, input.values.clientAccountId),
              eq(accountProfiles.status, "active"),
            ),
          )
          .limit(1);
        if (!client) return null;
        clientAccountId = client.id;
      } else {
        const [customer] = await tx
          .select({ accountProfileId: customerRecords.accountProfileId })
          .from(customerRecords)
          .innerJoin(
            bookings,
            and(
              eq(bookings.id, input.values.sourceBookingId),
              eq(bookings.organisationId, input.organisationId),
              eq(bookings.clientAccountId, customerRecords.accountProfileId),
              eq(bookings.status, "COMPLETED"),
              eq(bookings.professionalServiceId, input.values.serviceId),
            ),
          )
          .where(
            and(
              eq(customerRecords.id, input.values.customerId),
              eq(customerRecords.organisationId, input.organisationId),
              eq(customerRecords.status, "REGISTERED"),
            ),
          )
          .limit(1);
        if (!customer?.accountProfileId) return null;
        clientAccountId = customer.accountProfileId;
      }
      const startsAt = new Date(input.values.requestedStartAt);
      const endsAt = addMinutes(startsAt, service.estimatedDurationMinutes);
      if (
        !(await windowAvailable(tx, {
          organisationId: input.organisationId,
          membershipId: input.values.membershipId,
          startsAt,
          endsAt,
        }))
      ) {
        return null;
      }
      const bookingId = await insertBooking(tx, {
        origin: input.values.origin,
        organisationId: input.organisationId,
        clientAccountId,
        actorAccountId: input.actorAccountId,
        requestId,
        professionalServiceId: service.id,
        sourceBookingId:
          input.values.origin === "REPEAT_BOOKING"
            ? input.values.sourceBookingId
            : undefined,
        requestedMembershipId: input.values.membershipId,
        requestedStartAt: startsAt,
        requestedEndAt: endsAt,
        timezone: input.values.timezone,
        cancellationAcknowledgedAt: new Date(),
        currency: service.currency,
        totalMinor: service.priceMinor ?? 0,
        expectedDurationMinutes: service.estimatedDurationMinutes,
        scope: service.description ?? service.name,
        exclusions: "Work outside the agreed service scope is excluded.",
        warrantyTerms:
          service.warrantyTerms ??
          "Warranty eligibility will follow the completed service record.",
        paymentTerms:
          service.priceMinor && service.priceMinor > 0
            ? "Payment is recorded separately after service confirmation."
            : "No advance payment is required.",
        correlationId: input.correlationId,
      });
      if (requestId) {
        await tx
          .update(serviceRequests)
          .set({
            status: "CONVERTED",
            version: sql`${serviceRequests.version} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(serviceRequests.id, requestId));
        await tx.insert(serviceRequestHistory).values({
          requestId,
          actorAccountId: input.actorAccountId,
          action: "CONVERTED",
          fromStatus: "ASSESSMENT_REQUIRED",
          toStatus: "CONVERTED",
          clientVisibleNote: "The approved assessment has become a booking.",
        });
      }
      if (input.values.origin === "REPEAT_BOOKING") {
        await tx.insert(outboxEvents).values({
          eventType: "customer.repeat_booking_started",
          eventVersion: 1,
          aggregateType: "booking",
          aggregateId: bookingId,
          organisationId: input.organisationId,
          actorAccountId: input.actorAccountId,
          correlationId: input.correlationId,
          payload: {
            bookingId,
            sourceBookingId: input.values.sourceBookingId,
            customerId: input.values.customerId,
            clientAccountId,
          },
        });
      }
      return bookingId;
    });
  }

  async requestSchedule(input: {
    bookingId: string;
    clientAccountId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
    note?: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [booking] = await tx
        .update(bookings)
        .set({
          requestedMembershipId: input.membershipId,
          requestedStartAt: input.startsAt,
          requestedEndAt: input.endsAt,
          lockVersion: sql`${bookings.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.clientAccountId, input.clientAccountId),
            inArray(bookings.status, [
              "PENDING_CONFIRMATION",
              "PENDING_DEPOSIT",
            ]),
            eq(bookings.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({
          organisationId: bookings.organisationId,
          status: bookings.status,
        });
      if (!booking) return false;
      if (
        !(await windowAvailable(tx, {
          organisationId: booking.organisationId,
          membershipId: input.membershipId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        }))
      ) {
        throw conflictError();
      }
      await recordBookingChange(tx, {
        bookingId: input.bookingId,
        organisationId: booking.organisationId,
        actorAccountId: input.clientAccountId,
        action: "SCHEDULE_REQUESTED",
        fromStatus: booking.status,
        toStatus: booking.status,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        membershipId: input.membershipId,
        note: input.note,
        correlationId: input.correlationId,
      });
      return true;
    });
  }

  async requestReschedule(input: {
    bookingId: string;
    clientAccountId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          organisationId: bookings.organisationId,
          status: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.clientAccountId, input.clientAccountId),
            inArray(bookings.status, ["CONFIRMED", "RESCHEDULED"]),
            eq(bookings.lockVersion, input.expectedLockVersion),
          ),
        )
        .limit(1);
      if (!current) return false;
      if (
        !(await windowAvailable(tx, {
          organisationId: current.organisationId,
          membershipId: input.membershipId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          excludeBookingId: input.bookingId,
        }))
      ) {
        throw conflictError();
      }
      const changed = await tx
        .update(bookings)
        .set({
          status: "RESCHEDULE_REQUESTED",
          requestedMembershipId: input.membershipId,
          requestedStartAt: input.startsAt,
          requestedEndAt: input.endsAt,
          lockVersion: sql`${bookings.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.status, current.status),
            eq(bookings.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: bookings.id });
      if (!changed.length) return false;
      await recordBookingChange(tx, {
        bookingId: input.bookingId,
        organisationId: current.organisationId,
        actorAccountId: input.clientAccountId,
        action: "RESCHEDULE_REQUESTED",
        fromStatus: current.status,
        toStatus: "RESCHEDULE_REQUESTED",
        previousStartsAt: current.startsAt,
        previousEndsAt: current.endsAt,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        membershipId: input.membershipId,
        note: input.reason,
        correlationId: input.correlationId,
      });
      return true;
    });
  }

  schedule(input: {
    bookingId: string;
    organisationId: string;
    actorAccountId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
    reschedule: boolean;
    correlationId?: string;
  }): Promise<ScheduleResult> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          status: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.organisationId, input.organisationId),
            eq(bookings.lockVersion, input.expectedLockVersion),
            input.reschedule
              ? eq(bookings.status, "RESCHEDULE_REQUESTED")
              : inArray(bookings.status, [
                  "PENDING_CONFIRMATION",
                  "PENDING_DEPOSIT",
                ]),
          ),
        )
        .limit(1);
      if (!current) return { kind: "stale" };
      const [pendingDeposit] = await tx
        .select({ id: paymentRequirements.id })
        .from(paymentRequirements)
        .where(
          and(
            eq(paymentRequirements.bookingId, input.bookingId),
            eq(paymentRequirements.requirementType, "DEPOSIT"),
            eq(paymentRequirements.status, "PENDING"),
          ),
        )
        .limit(1);
      if (pendingDeposit) return { kind: "deposit_required" };
      if (
        !(await windowAvailable(tx, {
          organisationId: input.organisationId,
          membershipId: input.membershipId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          excludeBookingId: input.bookingId,
        }))
      ) {
        return { kind: "ineligible" };
      }
      const nextStatus = input.reschedule ? "RESCHEDULED" : "CONFIRMED";
      const [changed] = await tx
        .update(bookings)
        .set({
          status: nextStatus,
          assignedMembershipId: input.membershipId,
          requestedMembershipId: null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          requestedStartAt: null,
          requestedEndAt: null,
          cancellationAcknowledgedAt: new Date(),
          lockVersion: sql`${bookings.lockVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.organisationId, input.organisationId),
            eq(bookings.status, current.status),
            eq(bookings.lockVersion, input.expectedLockVersion),
          ),
        )
        .returning({ id: bookings.id });
      if (!changed) return { kind: "stale" };
      await tx
        .insert(bookingReservations)
        .values({
          bookingId: input.bookingId,
          organisationId: input.organisationId,
          membershipId: input.membershipId,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        })
        .onConflictDoUpdate({
          target: bookingReservations.bookingId,
          set: {
            membershipId: input.membershipId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            status: "ACTIVE",
            releasedAt: null,
            updatedAt: new Date(),
          },
        });
      await recordBookingChange(tx, {
        bookingId: input.bookingId,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        action: input.reschedule ? "RESCHEDULED" : "CONFIRMED",
        fromStatus: current.status,
        toStatus: nextStatus,
        previousStartsAt: current.startsAt,
        previousEndsAt: current.endsAt,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        membershipId: input.membershipId,
        correlationId: input.correlationId,
      });
      await ensureJobForBooking(tx, {
        bookingId: input.bookingId,
        actorAccountId: input.actorAccountId,
        organisationId: input.organisationId,
        correlationId: input.correlationId,
      });
      return { kind: "scheduled" };
    });
  }

  cancel(input: {
    bookingId: string;
    organisationId?: string;
    clientAccountId?: string;
    actorAccountId: string;
    expectedLockVersion: number;
    reason: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (
        !(await cancelJobForBooking(tx, {
          bookingId: input.bookingId,
          actorAccountId: input.actorAccountId,
          reason: input.reason,
          correlationId: input.correlationId,
        }))
      ) {
        return false;
      }
      const now = new Date();
      const [changed] = await tx
        .update(bookings)
        .set({
          status: "CANCELLED",
          cancellationReason: input.reason,
          cancelledAt: now,
          lockVersion: sql`${bookings.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            ...(input.organisationId
              ? [eq(bookings.organisationId, input.organisationId)]
              : []),
            ...(input.clientAccountId
              ? [eq(bookings.clientAccountId, input.clientAccountId)]
              : []),
            eq(bookings.lockVersion, input.expectedLockVersion),
            inArray(bookings.status, [
              "PENDING_CONFIRMATION",
              "PENDING_DEPOSIT",
              "CONFIRMED",
              "RESCHEDULE_REQUESTED",
              "RESCHEDULED",
            ]),
          ),
        )
        .returning({
          organisationId: bookings.organisationId,
          fromStatus: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          membershipId: bookings.assignedMembershipId,
        });
      if (!changed) return false;
      await tx
        .update(bookingReservations)
        .set({ status: "RELEASED", releasedAt: now, updatedAt: now })
        .where(
          and(
            eq(bookingReservations.bookingId, input.bookingId),
            eq(bookingReservations.status, "ACTIVE"),
          ),
        );
      await tx
        .update(paymentRequirements)
        .set({ status: "CANCELLED", updatedAt: now })
        .where(
          and(
            eq(paymentRequirements.bookingId, input.bookingId),
            eq(paymentRequirements.status, "PENDING"),
          ),
        );
      await recordBookingChange(tx, {
        bookingId: input.bookingId,
        organisationId: changed.organisationId,
        actorAccountId: input.actorAccountId,
        action: "CANCELLED",
        fromStatus: changed.fromStatus,
        toStatus: "CANCELLED",
        previousStartsAt: changed.startsAt,
        previousEndsAt: changed.endsAt,
        membershipId: changed.membershipId,
        note: input.reason,
        correlationId: input.correlationId,
      });
      return true;
    });
  }

  terminalTransition(input: {
    bookingId: string;
    organisationId: string;
    actorAccountId: string;
    expectedLockVersion: number;
    action: "COMPLETED" | "NO_SHOW";
    note?: string;
    correlationId?: string;
    now?: Date;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const now = input.now ?? new Date();
      const [changed] = await tx
        .update(bookings)
        .set({
          status: input.action,
          ...(input.action === "COMPLETED"
            ? { completedAt: now }
            : { noShowAt: now }),
          lockVersion: sql`${bookings.lockVersion} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            eq(bookings.organisationId, input.organisationId),
            eq(bookings.lockVersion, input.expectedLockVersion),
            inArray(bookings.status, ["CONFIRMED", "RESCHEDULED"]),
            lte(bookings.endsAt, now),
          ),
        )
        .returning({
          organisationId: bookings.organisationId,
          fromStatus: bookings.status,
          startsAt: bookings.startsAt,
          endsAt: bookings.endsAt,
          membershipId: bookings.assignedMembershipId,
        });
      if (!changed) return false;
      await tx
        .update(bookingReservations)
        .set({ status: "RELEASED", releasedAt: now, updatedAt: now })
        .where(
          and(
            eq(bookingReservations.bookingId, input.bookingId),
            eq(bookingReservations.status, "ACTIVE"),
          ),
        );
      await recordBookingChange(tx, {
        bookingId: input.bookingId,
        organisationId: changed.organisationId,
        actorAccountId: input.actorAccountId,
        action: input.action,
        fromStatus: changed.fromStatus,
        toStatus: input.action,
        previousStartsAt: changed.startsAt,
        previousEndsAt: changed.endsAt,
        membershipId: changed.membershipId,
        note: input.note,
        correlationId: input.correlationId,
      });
      return true;
    });
  }

  private async createRepeat(input: {
    clientAccountId: string;
    actorAccountId: string;
    values: Extract<ClientCreateBookingInput, { origin: "REPEAT_BOOKING" }>;
    correlationId?: string;
  }): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          source: getTableColumns(bookings),
          service: getTableColumns(professionalServices),
        })
        .from(bookings)
        .innerJoin(
          professionalServices,
          eq(professionalServices.id, bookings.professionalServiceId),
        )
        .innerJoin(
          organisations,
          eq(organisations.id, professionalServices.organisationId),
        )
        .where(
          and(
            eq(bookings.id, input.values.sourceBookingId),
            eq(bookings.clientAccountId, input.clientAccountId),
            eq(bookings.status, "COMPLETED"),
            eq(organisations.status, "active"),
            eq(professionalServices.status, "published"),
            eq(professionalServices.moderationStatus, "clear"),
            eq(professionalServices.directBookingEnabled, true),
            ne(professionalServices.pricingModel, "custom_quote"),
            isNotNull(professionalServices.priceMinor),
            isNotNull(professionalServices.estimatedDurationMinutes),
          ),
        )
        .limit(1);
      const durationMinutes = record?.service.estimatedDurationMinutes;
      const currentPriceMinor = record?.service.priceMinor;
      if (!record || !durationMinutes || currentPriceMinor == null) return null;
      const { source, service } = record;
      const startsAt = new Date(input.values.requestedStartAt);
      const endsAt = addMinutes(startsAt, durationMinutes);
      if (
        !(await windowAvailable(tx, {
          organisationId: source.organisationId,
          membershipId: input.values.membershipId,
          startsAt,
          endsAt,
        }))
      ) {
        return null;
      }
      const bookingId = await insertBooking(tx, {
        origin: "REPEAT_BOOKING",
        organisationId: source.organisationId,
        clientAccountId: input.clientAccountId,
        actorAccountId: input.actorAccountId,
        professionalServiceId: source.professionalServiceId ?? undefined,
        sourceBookingId: source.id,
        requestedMembershipId: input.values.membershipId,
        requestedStartAt: startsAt,
        requestedEndAt: endsAt,
        timezone: input.values.timezone,
        cancellationAcknowledgedAt: new Date(),
        currency: service.currency,
        totalMinor: currentPriceMinor,
        depositMinor: 0,
        expectedDurationMinutes: durationMinutes,
        scope: service.description ?? service.name,
        exclusions: "Work outside the current published service scope is excluded.",
        warrantyTerms:
          service.warrantyTerms ??
          "Warranty eligibility will follow the completed service record.",
        paymentTerms:
          service.priceMinor && service.priceMinor > 0
            ? "Payment is recorded separately after service confirmation."
            : "No advance payment is required.",
        correlationId: input.correlationId,
      });
      await tx.insert(outboxEvents).values({
        eventType: "customer.repeat_booking_started",
        eventVersion: 1,
        aggregateType: "booking",
        aggregateId: bookingId,
        organisationId: source.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          bookingId,
          sourceBookingId: source.id,
          clientAccountId: input.clientAccountId,
        },
      });
      return bookingId;
    });
  }

  private async list(input: {
    scope: SQL<unknown>;
    status?: BookingStatus;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<PageResult<BookingSummary>> {
    const filter = and(
      input.scope,
      ...(input.status ? [eq(bookings.status, input.status)] : []),
      ...(input.from ? [gte(bookings.endsAt, input.from)] : []),
      ...(input.to ? [lte(bookings.startsAt, input.to)] : []),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select(summarySelection)
        .from(bookings)
        .innerJoin(
          organisations,
          eq(organisations.id, bookings.organisationId),
        )
        .innerJoin(
          clientProfile,
          eq(clientProfile.id, bookings.clientAccountId),
        )
        .leftJoin(
          serviceRequests,
          eq(serviceRequests.id, bookings.requestId),
        )
        .leftJoin(
          professionalServices,
          eq(professionalServices.id, bookings.professionalServiceId),
        )
        .leftJoin(
          organisationMemberships,
          eq(organisationMemberships.id, bookings.assignedMembershipId),
        )
        .leftJoin(
          assignedProfile,
          eq(assignedProfile.id, organisationMemberships.accountProfileId),
        )
        .where(filter)
        .orderBy(desc(bookings.updatedAt), desc(bookings.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ totalItems: count() }).from(bookings).where(filter),
    ]);
    return buildPageResult(
      rows.map(mapSummary),
      totals[0]?.totalItems ?? 0,
      input,
    );
  }

  private async detail(
    bookingId: string,
    scope: SQL<unknown>,
  ): Promise<BookingDetail | null> {
    const [row] = await this.db
      .select({
        ...getTableColumns(bookings),
        providerName: organisations.name,
        clientName: clientProfile.displayName,
        serviceName: sql<string>`coalesce(${professionalServices.name}, ${serviceRequests.category}, 'Service booking')`,
        assignmentName: assignedProfile.displayName,
      })
      .from(bookings)
      .innerJoin(organisations, eq(organisations.id, bookings.organisationId))
      .innerJoin(
        clientProfile,
        eq(clientProfile.id, bookings.clientAccountId),
      )
      .leftJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
      .leftJoin(
        professionalServices,
        eq(professionalServices.id, bookings.professionalServiceId),
      )
      .leftJoin(
        organisationMemberships,
        eq(organisationMemberships.id, bookings.assignedMembershipId),
      )
      .leftJoin(
        assignedProfile,
        eq(assignedProfile.id, organisationMemberships.accountProfileId),
      )
      .leftJoin(
        createdByProfile,
        eq(createdByProfile.id, bookings.createdByAccountId),
      )
      .where(and(eq(bookings.id, bookingId), scope))
      .limit(1);
    if (!row) return null;
    const [history, requirements] = await Promise.all([
      this.db
        .select()
        .from(bookingHistory)
        .where(eq(bookingHistory.bookingId, bookingId))
        .orderBy(desc(bookingHistory.createdAt), desc(bookingHistory.id)),
      this.db
        .select()
        .from(paymentRequirements)
        .where(eq(paymentRequirements.bookingId, bookingId))
        .orderBy(asc(paymentRequirements.requirementType)),
    ]);
    return {
      ...mapSummary(row),
      requestId: row.requestId,
      quotationId: row.quotationId,
      professionalServiceId: row.professionalServiceId,
      sourceBookingId: row.sourceBookingId,
      organisationId: row.organisationId,
      clientAccountId: row.clientAccountId,
      createdByAccountId: row.createdByAccountId,
      assignedMembershipId: row.assignedMembershipId,
      requestedMembershipId: row.requestedMembershipId,
      proposedStartAt: iso(row.proposedStartAt),
      requestedEndAt: iso(row.requestedEndAt),
      cancellationPolicy: row.cancellationPolicy,
      cancellationAcknowledgedAt: iso(row.cancellationAcknowledgedAt),
      cancellationReason: row.cancellationReason,
      scope: row.scope,
      exclusions: row.exclusions,
      warrantyTerms: row.warrantyTerms,
      paymentTerms: row.paymentTerms,
      depositMinor: row.depositMinor,
      expectedDurationMinutes: row.expectedDurationMinutes,
      lockVersion: row.lockVersion,
      createdAt: row.createdAt.toISOString(),
      history: history.map((item) => ({
        id: item.id,
        action: item.action,
        fromStatus: item.fromStatus as BookingStatus | null,
        toStatus: item.toStatus as BookingStatus,
        previousStartsAt: iso(item.previousStartsAt),
        previousEndsAt: iso(item.previousEndsAt),
        startsAt: iso(item.startsAt),
        endsAt: iso(item.endsAt),
        membershipId: item.membershipId,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
      })),
      paymentRequirements: requirements.map((item) => ({
        id: item.id,
        requirementType: item.requirementType as "DEPOSIT" | "BALANCE",
        status: item.status as
          | "PENDING"
          | "SATISFIED"
          | "WAIVED"
          | "CANCELLED",
        amountMinor: item.amountMinor,
        currency: item.currency,
        dueAt: iso(item.dueAt),
      })),
    };
  }
}

const summarySelection = {
  id: bookings.id,
  origin: bookings.origin,
  status: bookings.status,
  serviceName: sql<string>`coalesce(${professionalServices.name}, ${serviceRequests.category}, 'Service booking')`,
  providerName: organisations.name,
  clientName: clientProfile.displayName,
  startsAt: bookings.startsAt,
  endsAt: bookings.endsAt,
  requestedStartAt: bookings.requestedStartAt,
  timezone: bookings.timezone,
  totalMinor: bookings.totalMinor,
  currency: bookings.currency,
  assignmentName: assignedProfile.displayName,
  updatedAt: bookings.updatedAt,
};

function mapSummary(row: {
  id: string;
  origin: string;
  status: string;
  serviceName: string;
  providerName: string;
  clientName: string;
  startsAt: Date | null;
  endsAt: Date | null;
  requestedStartAt: Date | null;
  timezone: string;
  totalMinor: number;
  currency: string;
  assignmentName: string | null;
  updatedAt: Date;
}): BookingSummary {
  return {
    ...row,
    origin: row.origin as BookingOrigin,
    status: row.status as BookingStatus,
    startsAt: iso(row.startsAt),
    endsAt: iso(row.endsAt),
    requestedStartAt: iso(row.requestedStartAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function activeMembership(
  db: Database | Tx,
  organisationId: string,
  membershipId: string,
) {
  const [member] = await db
    .select({ id: organisationMemberships.id })
    .from(organisationMemberships)
    .innerJoin(
      accountProfiles,
      eq(accountProfiles.id, organisationMemberships.accountProfileId),
    )
    .where(
      and(
        eq(organisationMemberships.id, membershipId),
        eq(organisationMemberships.organisationId, organisationId),
        eq(organisationMemberships.status, "active"),
        eq(accountProfiles.status, "active"),
      ),
    )
    .limit(1);
  return member ?? null;
}

async function windowAvailable(
  tx: Tx,
  input: {
    organisationId: string;
    membershipId: string;
    startsAt: Date;
    endsAt: Date;
    excludeBookingId?: string;
  },
) {
  if (
    !(await activeMembership(
      tx,
      input.organisationId,
      input.membershipId,
    ))
  ) {
    return false;
  }
  const rules = await tx
    .select({
      weekday: availabilityRules.weekday,
      startMinute: availabilityRules.startMinute,
      endMinute: availabilityRules.endMinute,
      timezone: availabilityRules.timezone,
    })
    .from(availabilityRules)
    .where(
      and(
        eq(availabilityRules.organisationId, input.organisationId),
        eq(availabilityRules.membershipId, input.membershipId),
        eq(availabilityRules.active, true),
      ),
    );
  if (
    !rules.some((rule) =>
      withinDatabaseRule(input.startsAt, input.endsAt, rule),
    )
  ) {
    return false;
  }
  const [block] = await tx
    .select({ id: availabilityBlocks.id })
    .from(availabilityBlocks)
    .where(
      and(
        eq(availabilityBlocks.organisationId, input.organisationId),
        eq(availabilityBlocks.membershipId, input.membershipId),
        lt(availabilityBlocks.startsAt, input.endsAt),
        sql`${availabilityBlocks.endsAt} > ${input.startsAt}`,
      ),
    )
    .limit(1);
  if (block) return false;
  const [reservation] = await tx
    .select({ id: bookingReservations.id })
    .from(bookingReservations)
    .where(
      and(
        eq(bookingReservations.membershipId, input.membershipId),
        eq(bookingReservations.status, "ACTIVE"),
        lt(bookingReservations.startsAt, input.endsAt),
        sql`${bookingReservations.endsAt} > ${input.startsAt}`,
        ...(input.excludeBookingId
          ? [ne(bookingReservations.bookingId, input.excludeBookingId)]
          : []),
      ),
    )
    .limit(1);
  return !reservation;
}

function withinDatabaseRule(
  startsAt: Date,
  endsAt: Date,
  rule: {
    weekday: number;
    startMinute: number;
    endMinute: number;
    timezone: string;
  },
) {
  const start = localParts(startsAt, rule.timezone);
  const end = localParts(new Date(endsAt.getTime() - 1), rule.timezone);
  return (
    start.weekday === rule.weekday &&
    end.weekday === rule.weekday &&
    start.minuteOfDay >= rule.startMinute &&
    end.minuteOfDay + 1 <= rule.endMinute
  );
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    weekday: weekdays.indexOf(map.weekday ?? ""),
    minuteOfDay: Number(map.hour ?? 0) * 60 + Number(map.minute ?? 0),
  };
}

async function insertBooking(
  tx: Tx,
  input: {
    origin: Exclude<BookingOrigin, "ACCEPTED_QUOTATION">;
    organisationId: string;
    clientAccountId: string;
    actorAccountId: string;
    requestId?: string;
    professionalServiceId?: string;
    sourceBookingId?: string;
    requestedMembershipId: string;
    requestedStartAt: Date;
    requestedEndAt: Date;
    timezone: string;
    cancellationAcknowledgedAt: Date;
    currency: string;
    totalMinor: number;
    depositMinor?: number;
    expectedDurationMinutes: number;
    scope: string;
    exclusions: string;
    warrantyTerms: string;
    paymentTerms: string;
    correlationId?: string;
  },
) {
  const [booking] = await tx
    .insert(bookings)
    .values({
      origin: input.origin,
      organisationId: input.organisationId,
      clientAccountId: input.clientAccountId,
      createdByAccountId: input.actorAccountId,
      requestId: input.requestId,
      professionalServiceId: input.professionalServiceId,
      sourceBookingId: input.sourceBookingId,
      requestedMembershipId: input.requestedMembershipId,
      requestedStartAt: input.requestedStartAt,
      requestedEndAt: input.requestedEndAt,
      timezone: input.timezone,
      cancellationAcknowledgedAt: input.cancellationAcknowledgedAt,
      status: "PENDING_CONFIRMATION",
      currency: input.currency,
      totalMinor: input.totalMinor,
      depositMinor: input.depositMinor ?? 0,
      expectedDurationMinutes: input.expectedDurationMinutes,
      scope: input.scope,
      exclusions: input.exclusions,
      warrantyTerms: input.warrantyTerms,
      paymentTerms: input.paymentTerms,
    })
    .returning({ id: bookings.id });
  await recordBookingChange(tx, {
    bookingId: booking.id,
    organisationId: input.organisationId,
    actorAccountId: input.actorAccountId,
    action: "CREATED",
    fromStatus: null,
    toStatus: "PENDING_CONFIRMATION",
    startsAt: input.requestedStartAt,
    endsAt: input.requestedEndAt,
    membershipId: input.requestedMembershipId,
    correlationId: input.correlationId,
  });
  await ensureRegisteredCustomer(tx, {
    organisationId: input.organisationId,
    clientAccountId: input.clientAccountId,
    actorAccountId: input.actorAccountId,
    origin: input.origin,
  });
  return booking.id;
}

export async function recordBookingChange(
  tx: Tx,
  input: {
    bookingId: string;
    organisationId: string;
    actorAccountId: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    previousStartsAt?: Date | null;
    previousEndsAt?: Date | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    membershipId?: string | null;
    note?: string;
    correlationId?: string;
  },
) {
  const [history] = await tx
    .insert(bookingHistory)
    .values({
      bookingId: input.bookingId,
      actorAccountId: input.actorAccountId,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      previousStartsAt: input.previousStartsAt,
      previousEndsAt: input.previousEndsAt,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      membershipId: input.membershipId,
      note: input.note,
    })
    .returning({ id: bookingHistory.id, createdAt: bookingHistory.createdAt });
  const conversationId = await ensureBookingConversation(tx, input.bookingId);
  await tx.insert(engagementActivities).values({
    conversationId,
    sourceType: "BOOKING_HISTORY",
    sourceId: history.id,
    activityType: input.action,
    actorAccountId: input.actorAccountId,
    summary: bookingActivitySummary(input.action),
    metadata: {
      bookingId: input.bookingId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      startsAt: input.startsAt?.toISOString(),
      endsAt: input.endsAt?.toISOString(),
      membershipId: input.membershipId,
    },
    occurredAt: history.createdAt,
  });
  const eventType = bookingEventType(input.action);
  if (eventType) {
    await tx.insert(outboxEvents).values([
      {
        eventType,
        eventVersion: 1,
        aggregateType: "booking",
        aggregateId: input.bookingId,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          action: input.action,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          startsAt: input.startsAt?.toISOString(),
          endsAt: input.endsAt?.toISOString(),
          membershipId: input.membershipId,
        },
      },
      {
        eventType: "engagement.activity_recorded",
        eventVersion: 1,
        aggregateType: "booking",
        aggregateId: input.bookingId,
        organisationId: input.organisationId,
        actorAccountId: input.actorAccountId,
        correlationId: input.correlationId,
        payload: {
          contextType: "BOOKING",
          contextId: input.bookingId,
          action: input.action,
        },
      },
    ]);
  }
}

async function ensureBookingConversation(tx: Tx, bookingId: string) {
  const [created] = await tx
    .insert(engagementConversations)
    .values({ contextType: "BOOKING", contextId: bookingId })
    .onConflictDoNothing()
    .returning({ id: engagementConversations.id });
  if (created) return created.id;
  const [existing] = await tx
    .select({ id: engagementConversations.id })
    .from(engagementConversations)
    .where(
      and(
        eq(engagementConversations.contextType, "BOOKING"),
        eq(engagementConversations.contextId, bookingId),
      ),
    )
    .limit(1);
  return existing.id;
}

function bookingEventType(action: string) {
  const events: Record<string, string> = {
    CREATED: "booking.created",
    CONFIRMED: "booking.confirmed",
    RESCHEDULE_REQUESTED: "booking.reschedule_requested",
    RESCHEDULED: "booking.rescheduled",
    CANCELLED: "booking.cancelled",
    NO_SHOW: "booking.no_show_recorded",
  };
  return events[action] ?? null;
}

function bookingActivitySummary(action: string) {
  const summaries: Record<string, string> = {
    CREATED: "Booking created and awaiting confirmation.",
    SCHEDULE_REQUESTED: "A booking time was requested.",
    CONFIRMED: "Booking confirmed.",
    RESCHEDULE_REQUESTED: "A booking reschedule was requested.",
    RESCHEDULED: "Booking rescheduled.",
    CANCELLED: "Booking cancelled.",
    COMPLETED: "Booking marked complete.",
    NO_SHOW: "Booking marked as a no-show.",
  };
  return summaries[action] ?? "Booking updated.";
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function iso(date: Date | null | undefined) {
  return date?.toISOString() ?? null;
}

function conflictError() {
  const error = new Error("BOOKING_CONFLICT");
  error.name = "BookingConflictError";
  return error;
}
