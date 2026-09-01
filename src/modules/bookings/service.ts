import { AppError } from "../../platform/errors/app-error";
import type { PageResult } from "../../platform/http/pagination";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import {
  assertValidTimezone,
  buildAvailableSlots,
} from "./availability";
import {
  BookingsRepository,
  type ScheduleResult,
} from "./repository";
import type {
  AvailabilityConfiguration,
  BookingDetail,
  BookingSlot,
  BookingStatus,
  BookingSummary,
  CalendarEntry,
  ClientCreateBookingInput,
  ProfessionalCreateBookingInput,
} from "./types";

export class BookingsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: BookingsRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  listProfessional(input: {
    organisationId: string;
    status?: BookingStatus;
    bucket?: import("./types").BookingBucket;
    origin?: import("./types").BookingOrigin;
    search?: string;
    sort?: import("./types").BookingSort;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<BookingSummary> & { summary: import("./types").BookingSummaryStats; origins: string[] }> {
    return this.store.listProfessional({
      ...input,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
    });
  }

  async listClient(input: {
    authUserId: string;
    status?: BookingStatus;
    bucket?: import("./types").BookingBucket;
    stage?: import("./types").ClientBookingStage;
    origin?: import("./types").BookingOrigin;
    search?: string;
    sort?: import("./types").BookingSort;
    from?: string;
    to?: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<BookingSummary> & { summary: import("./types").BookingSummaryStats; origins: string[] }> {
    const account = await this.activeAccount(input.authUserId);
    return this.store.listClient({
      clientAccountId: account.id,
      status: input.status,
      bucket: input.bucket,
      stage: input.stage,
      origin: input.origin,
      search: input.search,
      sort: input.sort,
      from: input.from ? new Date(input.from) : undefined,
      to: input.to ? new Date(input.to) : undefined,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async getProfessional(
    organisationId: string,
    bookingId: string,
  ): Promise<BookingDetail> {
    return requireBooking(
      await this.store.getProfessional(organisationId, bookingId),
    );
  }

  async getClient(
    authUserId: string,
    bookingId: string,
  ): Promise<BookingDetail> {
    const account = await this.activeAccount(authUserId);
    return requireBooking(await this.store.getClient(account.id, bookingId));
  }

  async createClient(input: {
    authUserId: string;
    values: ClientCreateBookingInput;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const account = await this.activeAccount(input.authUserId);
    validateRequestedStart(
      input.values.requestedStartAt,
      input.values.timezone,
    );
    const bookingId = await this.store.createClient({
      clientAccountId: account.id,
      actorAccountId: account.id,
      values: input.values,
      correlationId: input.correlationId,
    });
    if (!bookingId) throw bookingUnavailable();
    return requireBooking(await this.store.getClient(account.id, bookingId));
  }

  async createProfessional(input: {
    organisationId: string;
    actorAccountId: string;
    values: ProfessionalCreateBookingInput;
    correlationId?: string;
  }): Promise<BookingDetail> {
    validateRequestedStart(
      input.values.requestedStartAt,
      input.values.timezone,
    );
    const bookingId = await this.store.createProfessional(input);
    if (!bookingId) throw bookingUnavailable();
    return requireBooking(
      await this.store.getProfessional(input.organisationId, bookingId),
    );
  }

  listAvailability(
    organisationId: string,
  ): Promise<AvailabilityConfiguration> {
    return this.store.listAvailability(organisationId);
  }

  async replaceAvailability(input: {
    organisationId: string;
    actorAccountId: string;
    membershipId: string;
    timezone: string;
    rules: Array<{ weekday: number; startMinute: number; endMinute: number }>;
  }): Promise<AvailabilityConfiguration> {
    validateTimezone(input.timezone);
    ensureNonOverlappingRules(input.rules);
    if (!(await this.store.replaceAvailability(input))) {
      throw memberUnavailable();
    }
    return this.store.listAvailability(input.organisationId);
  }

  async createAvailabilityBlock(input: {
    organisationId: string;
    actorAccountId: string;
    membershipId: string;
    startsAt: string;
    endsAt: string;
    reason: string;
  }): Promise<AvailabilityConfiguration> {
    if (
      !(await this.store.createAvailabilityBlock({
        ...input,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
      }))
    ) {
      throw memberUnavailable();
    }
    return this.store.listAvailability(input.organisationId);
  }

  async deleteAvailabilityBlock(
    organisationId: string,
    blockId: string,
  ): Promise<AvailabilityConfiguration> {
    if (!(await this.store.deleteAvailabilityBlock(organisationId, blockId))) {
      throw new AppError({
        code: "AVAILABILITY_BLOCK_NOT_FOUND",
        message: "The unavailable period was not found.",
        status: 404,
      });
    }
    return this.store.listAvailability(organisationId);
  }

  async listSlotsForProfessional(input: {
    organisationId: string;
    bookingId: string;
    from: string;
    to: string;
  }): Promise<BookingSlot[]> {
    const booking = await this.getProfessional(
      input.organisationId,
      input.bookingId,
    );
    if (booking.status === "COMPLETED" && booking.professionalServiceId) {
      const current = await this.store.currentServiceSlotContext(
        booking.professionalServiceId,
      );
      if (!current) throw bookingUnavailable();
      return this.slotsForWindow({
        ...current,
        from: input.from,
        to: input.to,
      });
    }
    return this.slots(booking, input.from, input.to);
  }

  async listSlotsForClient(input: {
    authUserId: string;
    bookingId: string;
    from: string;
    to: string;
  }): Promise<BookingSlot[]> {
    const booking = await this.getClient(input.authUserId, input.bookingId);
    if (booking.status === "COMPLETED" && booking.professionalServiceId) {
      const current = await this.store.currentServiceSlotContext(
        booking.professionalServiceId,
      );
      if (!current) throw bookingUnavailable();
      return this.slotsForWindow({
        ...current,
        from: input.from,
        to: input.to,
      });
    }
    return this.slots(booking, input.from, input.to);
  }

  async listDirectServiceSlots(input: {
    authUserId: string;
    professionalSlug: string;
    serviceSlug: string;
    from: string;
    to: string;
  }): Promise<BookingSlot[]> {
    await this.activeAccount(input.authUserId);
    const service = await this.store.directServiceSlotContext(
      input.professionalSlug,
      input.serviceSlug,
    );
    if (!service) throw bookingUnavailable();
    return this.slotsForWindow({
      organisationId: service.organisationId,
      durationMinutes: service.durationMinutes,
      from: input.from,
      to: input.to,
    });
  }

  listCalendar(input: {
    organisationId: string;
    from: string;
    to: string;
    membershipId?: string;
  }): Promise<CalendarEntry[]> {
    return this.store.listCalendar({
      ...input,
      from: new Date(input.from),
      to: new Date(input.to),
    });
  }

  async requestSchedule(input: {
    authUserId: string;
    bookingId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: string;
    note?: string;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const account = await this.activeAccount(input.authUserId);
    const current = requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
    requireLock(current, input.expectedLockVersion);
    const startsAt = futureStart(input.startsAt);
    const endsAt = addMinutes(startsAt, current.expectedDurationMinutes);
    try {
      if (
        !(await this.store.requestSchedule({
          ...input,
          clientAccountId: account.id,
          startsAt,
          endsAt,
        }))
      ) {
        throw staleBooking();
      }
    } catch (error) {
      if (isBookingConflict(error)) throw bookingConflict();
      throw error;
    }
    return requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
  }

  async requestReschedule(input: {
    authUserId: string;
    bookingId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: string;
    reason: string;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const account = await this.activeAccount(input.authUserId);
    const current = requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
    requireLock(current, input.expectedLockVersion);
    const startsAt = futureStart(input.startsAt);
    const endsAt = addMinutes(startsAt, current.expectedDurationMinutes);
    try {
      if (
        !(await this.store.requestReschedule({
          ...input,
          clientAccountId: account.id,
          startsAt,
          endsAt,
        }))
      ) {
        throw staleBooking();
      }
    } catch (error) {
      if (isBookingConflict(error)) throw bookingConflict();
      throw error;
    }
    return requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
  }

  async confirm(input: {
    organisationId: string;
    actorAccountId: string;
    bookingId: string;
    expectedLockVersion: number;
    membershipId: string;
    startsAt: string;
    reschedule: boolean;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const current = await this.getProfessional(
      input.organisationId,
      input.bookingId,
    );
    requireLock(current, input.expectedLockVersion);
    const startsAt = futureStart(input.startsAt);
    const endsAt = addMinutes(startsAt, current.expectedDurationMinutes);
    let result: ScheduleResult;
    try {
      result = await this.store.schedule({
        ...input,
        startsAt,
        endsAt,
      });
    } catch (error) {
      if (postgresConflict(error)) throw bookingConflict();
      throw error;
    }
    if (result.kind === "deposit_required") {
      throw new AppError({
        code: "BOOKING_DEPOSIT_REQUIRED",
        message:
          "The deposit requirement must be satisfied or waived before confirmation.",
        status: 409,
      });
    }
    if (result.kind === "ineligible") throw bookingConflict();
    if (result.kind === "stale") throw staleBooking();
    return this.getProfessional(input.organisationId, input.bookingId);
  }

  async cancelClient(input: {
    authUserId: string;
    bookingId: string;
    expectedLockVersion: number;
    reason: string;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const account = await this.activeAccount(input.authUserId);
    const current = requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
    requireLock(current, input.expectedLockVersion);
    if (
      !(await this.store.cancel({
        ...input,
        actorAccountId: account.id,
        clientAccountId: account.id,
      }))
    ) {
      throw staleBooking();
    }
    return requireBooking(
      await this.store.getClient(account.id, input.bookingId),
    );
  }

  async cancelProfessional(input: {
    organisationId: string;
    actorAccountId: string;
    bookingId: string;
    expectedLockVersion: number;
    reason: string;
    correlationId?: string;
  }): Promise<BookingDetail> {
    const current = await this.getProfessional(
      input.organisationId,
      input.bookingId,
    );
    requireLock(current, input.expectedLockVersion);
    if (
      !(await this.store.cancel({
        ...input,
        organisationId: input.organisationId,
      }))
    ) {
      throw staleBooking();
    }
    return this.getProfessional(input.organisationId, input.bookingId);
  }

  async terminalTransition(input: {
    organisationId: string;
    actorAccountId: string;
    bookingId: string;
    expectedLockVersion: number;
    action: "NO_SHOW";
    note?: string;
    correlationId?: string;
  }): Promise<BookingDetail> {
    if (!(await this.store.terminalTransition(input))) {
      throw new AppError({
        code: "BOOKING_TRANSITION_INVALID",
        message:
          "This booking is not eligible for that action or its scheduled end has not passed.",
        status: 409,
      });
    }
    return this.getProfessional(input.organisationId, input.bookingId);
  }

  private async slots(
    booking: BookingDetail,
    from: string,
    to: string,
  ): Promise<BookingSlot[]> {
    return this.slotsForWindow({
      organisationId: booking.organisationId,
      durationMinutes: booking.expectedDurationMinutes,
      from,
      to,
    });
  }

  private async slotsForWindow(input: {
    organisationId: string;
    durationMinutes: number;
    from: string;
    to: string;
  }): Promise<BookingSlot[]> {
    const rangeStart = new Date(input.from);
    const rangeEnd = new Date(input.to);
    if (rangeEnd.getTime() - rangeStart.getTime() > 31 * 86_400_000) {
      throw new AppError({
        code: "AVAILABILITY_RANGE_TOO_LARGE",
        message: "Availability can be checked for at most 31 days at a time.",
        status: 422,
      });
    }
    const inputs = await this.store.slotInputs({
      organisationId: input.organisationId,
      from: rangeStart,
      to: rangeEnd,
    });
    return buildAvailableSlots({
      ...inputs,
      from: rangeStart,
      to: rangeEnd,
      durationMinutes: input.durationMinutes,
    });
  }

  private async activeAccount(authUserId: string) {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    return profile;
  }
}

function validateRequestedStart(value: string, timezone: string) {
  validateTimezone(timezone);
  futureStart(value);
}

function validateTimezone(timezone: string) {
  try {
    assertValidTimezone(timezone);
  } catch {
    throw new AppError({
      code: "TIMEZONE_INVALID",
      message: "Choose a valid IANA timezone.",
      status: 422,
      issues: [{ code: "invalid", path: "timezone" }],
    });
  }
}

function ensureNonOverlappingRules(
  rules: Array<{ weekday: number; startMinute: number; endMinute: number }>,
) {
  for (const rule of rules) {
    if (
      rules.some(
        (other) =>
          other !== rule &&
          other.weekday === rule.weekday &&
          rule.startMinute < other.endMinute &&
          other.startMinute < rule.endMinute,
      )
    ) {
      throw new AppError({
        code: "AVAILABILITY_RULES_OVERLAP",
        message: "Working-hour windows for the same day cannot overlap.",
        status: 422,
      });
    }
  }
}

function futureStart(value: string) {
  const date = new Date(value);
  if (date <= new Date()) {
    throw new AppError({
      code: "BOOKING_START_INVALID",
      message: "Choose a future booking time.",
      status: 422,
      issues: [{ code: "invalid", path: "startsAt" }],
    });
  }
  return date;
}

function requireBooking(booking: BookingDetail | null): BookingDetail {
  if (!booking) {
    throw new AppError({
      code: "BOOKING_NOT_FOUND",
      message: "The requested booking was not found.",
      status: 404,
    });
  }
  return booking;
}

function requireLock(booking: BookingDetail, expectedLockVersion: number) {
  if (booking.lockVersion !== expectedLockVersion) throw staleBooking();
}

function staleBooking() {
  return new AppError({
    code: "BOOKING_STALE",
    message: "This booking changed. Refresh it before continuing.",
    status: 409,
  });
}

function bookingUnavailable() {
  return new AppError({
    code: "BOOKING_NOT_ELIGIBLE",
    message:
      "This service, source record, customer, or requested time is not eligible for booking.",
    status: 409,
  });
}

function memberUnavailable() {
  return new AppError({
    code: "BOOKING_MEMBER_NOT_ELIGIBLE",
    message: "Choose an active member in this organisation.",
    status: 422,
  });
}

function bookingConflict() {
  return new AppError({
    code: "BOOKING_CONFLICT",
    message:
      "That time is no longer available for the selected team member. Choose another slot.",
    status: 409,
  });
}

function isBookingConflict(error: unknown) {
  return error instanceof Error && error.name === "BookingConflictError";
}

function postgresConflict(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01"
  );
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}
