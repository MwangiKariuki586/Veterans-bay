import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { accountProfiles } from "./account-profiles";
import { bookings } from "./commercial";
import { organisations } from "./organisations";
import { organisationMemberships } from "./roles";

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    timezone: text("timezone").notNull().default("Africa/Nairobi"),
    active: boolean("active").notNull().default(true),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("availability_rules_member_window_unique").on(
      table.membershipId,
      table.weekday,
      table.startMinute,
      table.endMinute,
    ),
    check(
      "availability_rules_weekday_check",
      sql`${table.weekday} between 0 and 6`,
    ),
    check(
      "availability_rules_minutes_check",
      sql`${table.startMinute} between 0 and 1439
        and ${table.endMinute} between 1 and 1440
        and ${table.endMinute} > ${table.startMinute}`,
    ),
    check(
      "availability_rules_timezone_check",
      sql`char_length(${table.timezone}) between 1 and 64`,
    ),
    index("availability_rules_org_day_idx").on(
      table.organisationId,
      table.weekday,
      table.active,
    ),
    index("availability_rules_member_day_idx").on(
      table.membershipId,
      table.weekday,
      table.active,
    ),
    index("availability_rules_created_by_idx").on(table.createdByAccountId),
  ],
);

export const availabilityBlocks = pgTable(
  "availability_blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull(),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "availability_blocks_window_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      "availability_blocks_reason_check",
      sql`char_length(trim(${table.reason})) between 3 and 240`,
    ),
    index("availability_blocks_org_window_idx").on(
      table.organisationId,
      table.startsAt,
      table.endsAt,
    ),
    index("availability_blocks_member_window_idx").on(
      table.membershipId,
      table.startsAt,
      table.endsAt,
    ),
    index("availability_blocks_created_by_idx").on(table.createdByAccountId),
  ],
);

export const bookingReservations = pgTable(
  "booking_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    organisationId: uuid("organisation_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => organisationMemberships.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("ACTIVE"),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("booking_reservations_booking_unique").on(table.bookingId),
    check(
      "booking_reservations_status_check",
      sql`${table.status} in ('ACTIVE', 'RELEASED')`,
    ),
    check(
      "booking_reservations_window_check",
      sql`${table.endsAt} > ${table.startsAt}`,
    ),
    check(
      "booking_reservations_release_check",
      sql`(${table.status} = 'ACTIVE' and ${table.releasedAt} is null)
        or (${table.status} = 'RELEASED' and ${table.releasedAt} is not null)`,
    ),
    index("booking_reservations_org_window_idx").on(
      table.organisationId,
      table.startsAt,
      table.endsAt,
    ),
    index("booking_reservations_member_window_idx").on(
      table.membershipId,
      table.startsAt,
      table.endsAt,
    ),
  ],
);

export const bookingHistory = pgTable(
  "booking_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    actorAccountId: uuid("actor_account_id").references(
      () => accountProfiles.id,
      { onDelete: "set null" },
    ),
    action: text("action").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    previousStartsAt: timestamp("previous_starts_at", { withTimezone: true }),
    previousEndsAt: timestamp("previous_ends_at", { withTimezone: true }),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    membershipId: uuid("membership_id").references(
      () => organisationMemberships.id,
      { onDelete: "restrict" },
    ),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "booking_history_schedule_pair_check",
      sql`(${table.startsAt} is null and ${table.endsAt} is null)
        or (${table.startsAt} is not null
          and ${table.endsAt} is not null
          and ${table.endsAt} > ${table.startsAt})`,
    ),
    index("booking_history_booking_idx").on(
      table.bookingId,
      table.createdAt,
      table.id,
    ),
    index("booking_history_actor_idx").on(table.actorAccountId),
    index("booking_history_membership_idx").on(table.membershipId),
  ],
);
