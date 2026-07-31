import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  isNull,
  ne,
  sql,
} from "drizzle-orm";

import type { DomainEventEnvelope } from "../../platform/events/contracts";
import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { bookings } from "../../platform/database/schema/commercial";
import { invoices } from "../../platform/database/schema/financial";
import { engagementConversations } from "../../platform/database/schema/engagement-conversations";
import {
  jobAssignments,
  jobs,
} from "../../platform/database/schema/fulfilment";
import { notifications } from "../../platform/database/schema/notifications";
import { outboxEvents } from "../../platform/database/schema/outbox-events";
import { processedEvents } from "../../platform/database/schema/consumer-events";
import { professionalServices } from "../../platform/database/schema/professional-services";
import { reviews } from "../../platform/database/schema/reviews";
import {
  organisationMemberships,
  permissions,
  rolePermissions,
} from "../../platform/database/schema/roles";
import { serviceRequests } from "../../platform/database/schema/service-requests";
import { quotations } from "../../platform/database/schema/commercial";
import {
  warranties,
  warrantyClaims,
} from "../../platform/database/schema/warranties";
import {
  buildPageResult,
  paginationOffset,
} from "../../platform/http/pagination";
import { permissionKeys, type PermissionKey } from "../../platform/permissions/keys";
import type {
  NotificationItem,
  NotificationListResult,
} from "./types";

export const NOTIFICATION_CONSUMER = "in-app-notification-consumer";

export const notificationSourceEvents = [
  "service_request.submitted",
  "service_request.updated",
  "service_request.information_requested",
  "service_request.declined",
  "service_request.cancelled",
  "service_request.expired",
  "message.sent",
  "quotation.submitted",
  "quotation.viewed",
  "quotation.accepted",
  "quotation.declined",
  "quotation.revision_requested",
  "quotation.expired",
  "booking.created",
  "booking.confirmed",
  "booking.reschedule_requested",
  "booking.rescheduled",
  "booking.cancelled",
  "booking.no_show_recorded",
  "job.created",
  "job.assigned",
  "job.started",
  "job.progress_updated",
  "job.awaiting_confirmation",
  "job.variation_requested",
  "job.variation_approved",
  "job.completed",
  "warranty.created",
  "warranty.claim_submitted",
  "warranty.claim_under_review",
  "warranty.claim_accepted",
  "warranty.claim_rejected",
  "warranty.claim_escalated",
  "warranty.return_visit_scheduled",
  "warranty.resolved",
  "service_reminder.due",
  "invoice.issued",
  "invoice.cancelled",
  "invoice.paid",
  "payment.recorded",
  "payment.reversed",
  "refund.recorded",
  "review.requested",
  "review.submitted",
  "review.responded",
  "review.reported",
  "review.moderated",
  "content.hidden",
  "content.restored",
  "account.suspended",
  "account.restored",
  "dispute.opened",
  "dispute.resolved",
  "attachment.added",
] as const;

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

interface NotificationDraft {
  recipientAccountId: string;
  organisationId: string | null;
  title: string;
  body: string;
  actionTarget: string | null;
}

export class NotificationsRepository {
  constructor(private readonly db: Database) {}

  async consume(
    event: DomainEventEnvelope,
  ): Promise<{ created: number; duplicate: boolean }> {
    return this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .insert(processedEvents)
        .values({
          eventId: event.eventId,
          consumerName: NOTIFICATION_CONSUMER,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
        })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });
      if (!claimed) return { created: 0, duplicate: true };

      const drafts = await resolveNotificationDrafts(tx, event);
      if (drafts.length === 0) return { created: 0, duplicate: false };
      const created = await tx
        .insert(notifications)
        .values(
          drafts.map((draft) => ({
            ...draft,
            sourceEventId: event.eventId,
            sourceEventType: event.eventType,
            sourceAggregateType: event.aggregateType,
            sourceAggregateId: event.aggregateId,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: notifications.id, ...notificationRecipientSelection });
      if (created.length > 0) {
        await tx.insert(outboxEvents).values(
          created.flatMap((notification) =>
            ["notification.created", "notification.delivered"].map(
              (eventType) => ({
                eventType,
                eventVersion: 1,
                aggregateType: "notification",
                aggregateId: notification.id,
                organisationId: notification.organisationId,
                actorAccountId: null,
                correlationId: event.correlationId,
                payload: {
                  recipientAccountId: notification.recipientAccountId,
                  sourceEventId: event.eventId,
                  sourceEventType: event.eventType,
                },
              }),
            ),
          ),
        );
      }
      return { created: created.length, duplicate: false };
    });
  }

  async recordFailureEvent(input: {
    event: DomainEventEnvelope;
    failureCategory: string;
  }) {
    await this.db.transaction(async (tx) => {
      const [claimed] = await tx
        .insert(processedEvents)
        .values({
          eventId: input.event.eventId,
          consumerName: "in-app-notification-failure-recorder",
          eventType: input.event.eventType,
          eventVersion: input.event.eventVersion,
        })
        .onConflictDoNothing()
        .returning({ eventId: processedEvents.eventId });
      if (!claimed) return;
      await tx.insert(outboxEvents).values({
        eventType: "notification.failed",
        eventVersion: 1,
        aggregateType: input.event.aggregateType,
        aggregateId: input.event.aggregateId,
        organisationId: input.event.organisationId ?? null,
        actorAccountId: null,
        correlationId: input.event.correlationId ?? null,
        payload: {
          sourceEventId: input.event.eventId,
          sourceEventType: input.event.eventType,
          failureCategory: input.failureCategory,
        },
      });
    });
  }

  async list(input: {
    recipientAccountId: string;
    unreadOnly: boolean;
    page: number;
    pageSize: number;
  }): Promise<NotificationListResult> {
    const filter = and(
      eq(notifications.recipientAccountId, input.recipientAccountId),
      ...(input.unreadOnly ? [isNull(notifications.readAt)] : []),
    );
    const [rows, totals, unread] = await Promise.all([
      this.db
        .select(getTableColumns(notifications))
        .from(notifications)
        .where(filter)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(input.pageSize)
        .offset(paginationOffset(input)),
      this.db.select({ value: count() }).from(notifications).where(filter),
      this.db
        .select({ value: count() })
        .from(notifications)
        .where(
          and(
            eq(notifications.recipientAccountId, input.recipientAccountId),
            isNull(notifications.readAt),
          ),
        ),
    ]);
    const page = buildPageResult(
      rows.map(mapNotification),
      totals[0]?.value ?? 0,
      input,
    );
    return { ...page, unreadCount: unread[0]?.value ?? 0 };
  }

  async unreadCount(recipientAccountId: string) {
    const [result] = await this.db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientAccountId, recipientAccountId),
          isNull(notifications.readAt),
        ),
      );
    return result?.value ?? 0;
  }

  async markRead(input: {
    recipientAccountId: string;
    notificationId: string;
    correlationId?: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const [changed] = await tx
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.id, input.notificationId),
            eq(notifications.recipientAccountId, input.recipientAccountId),
            isNull(notifications.readAt),
          ),
        )
        .returning({
          id: notifications.id,
          organisationId: notifications.organisationId,
        });
      if (!changed) {
        const [existing] = await tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.id, input.notificationId),
              eq(
                notifications.recipientAccountId,
                input.recipientAccountId,
              ),
            ),
          )
          .limit(1);
        return Boolean(existing);
      }
      await insertReadEvent(tx, {
        notificationId: changed.id,
        recipientAccountId: input.recipientAccountId,
        organisationId: changed.organisationId,
        correlationId: input.correlationId,
      });
      return true;
    });
  }

  async markAllRead(input: {
    recipientAccountId: string;
    correlationId?: string;
  }): Promise<number> {
    return this.db.transaction(async (tx) => {
      const changed = await tx
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.recipientAccountId, input.recipientAccountId),
            isNull(notifications.readAt),
          ),
        )
        .returning({
          id: notifications.id,
          organisationId: notifications.organisationId,
        });
      if (changed.length > 0) {
        await tx.insert(outboxEvents).values(
          changed.map((notification) =>
            readEventValues({
              notificationId: notification.id,
              recipientAccountId: input.recipientAccountId,
              organisationId: notification.organisationId,
              correlationId: input.correlationId,
            }),
          ),
        );
      }
      return changed.length;
    });
  }
}

const notificationRecipientSelection = {
  recipientAccountId: notifications.recipientAccountId,
  organisationId: notifications.organisationId,
};

async function resolveNotificationDrafts(
  tx: Tx,
  event: DomainEventEnvelope,
): Promise<NotificationDraft[]> {
  if (
    event.eventType === "account.suspended" ||
    event.eventType === "account.restored"
  ) {
    const recipientAccountId =
      typeof event.payload.subjectAccountId === "string"
        ? event.payload.subjectAccountId
        : null;
    if (!recipientAccountId) return [];
    return [
      {
        recipientAccountId,
        organisationId: event.organisationId ?? null,
        title:
          event.eventType === "account.suspended"
            ? "Account access suspended"
            : "Account access restored",
        body:
          event.eventType === "account.suspended"
            ? "Your account access has been suspended following a platform review. Contact support if you need help."
            : "Your account access has been restored following a platform review.",
        actionTarget: "/help",
      },
    ];
  }
  if (
    event.eventType === "content.hidden" ||
    event.eventType === "content.restored"
  ) {
    if (!event.organisationId) return [];
    return professionalDrafts(tx, {
      event,
      organisationId: event.organisationId,
      permission: permissionKeys.servicesManage,
      title:
        event.eventType === "content.hidden"
          ? "Marketplace listing hidden"
          : "Marketplace listing restored",
      body:
        event.eventType === "content.hidden"
          ? "A listing was hidden following platform review. Open your service catalogue for its current status."
          : "A listing was restored following platform review.",
      actionTarget: "/professional/services",
    });
  }
  if (event.eventType === "dispute.opened") {
    if (!event.organisationId) return [];
    const jobId =
      typeof event.payload.jobId === "string" ? event.payload.jobId : null;
    if (!jobId) return [];
    return professionalDrafts(tx, {
      event,
      organisationId: event.organisationId,
      permission: permissionKeys.jobsView,
      title: "Service dispute opened",
      body: "A client opened a dispute for a completed service. Open the job for the current status.",
      actionTarget: `/professional/jobs/${jobId}`,
    });
  }
  if (event.eventType === "dispute.resolved") {
    const recipientAccountId =
      typeof event.payload.clientAccountId === "string"
        ? event.payload.clientAccountId
        : null;
    const jobId =
      typeof event.payload.jobId === "string" ? event.payload.jobId : null;
    if (!recipientAccountId || !jobId) return [];
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: recipientAccountId,
      organisationId: event.organisationId ?? null,
      title: "Dispute decision recorded",
      body: "A platform administrator recorded a decision. Open the job for the current status.",
      actionTarget: `/client/jobs/${jobId}`,
    });
    return client ? [client] : [];
  }
  if (event.eventType.startsWith("service_request.")) {
    return requestDrafts(tx, event, event.aggregateId);
  }
  if (event.eventType === "message.sent") {
    const [conversation] = await tx
      .select({
        contextType: engagementConversations.contextType,
        contextId: engagementConversations.contextId,
      })
      .from(engagementConversations)
      .where(eq(engagementConversations.id, event.aggregateId))
      .limit(1);
    if (conversation?.contextType === "SERVICE_REQUEST") {
      return requestDrafts(tx, event, conversation.contextId);
    }
    if (conversation?.contextType === "JOB") {
      return jobDrafts(tx, event, conversation.contextId);
    }
    return [];
  }
  if (event.eventType.startsWith("quotation.")) {
    return quotationDrafts(tx, event);
  }
  if (event.eventType.startsWith("booking.")) {
    return bookingDrafts(tx, event);
  }
  if (
    event.eventType.startsWith("job.") ||
    (event.eventType === "attachment.added" &&
      event.aggregateType === "job")
  ) {
    return jobDrafts(tx, event, event.aggregateId);
  }
  if (event.eventType.startsWith("warranty.")) {
    return warrantyDrafts(tx, event);
  }
  if (event.eventType === "service_reminder.due") {
    const recipientAccountId =
      typeof event.payload.recipientAccountId === "string"
        ? event.payload.recipientAccountId
        : null;
    if (!recipientAccountId) return [];
    const [recipient] = await tx
      .select({ id: accountProfiles.id })
      .from(accountProfiles)
      .where(
        and(
          eq(accountProfiles.id, recipientAccountId),
          eq(accountProfiles.status, "active"),
        ),
      )
      .limit(1);
    if (!recipient) return [];
    return [
      {
        recipientAccountId,
        organisationId: event.organisationId ?? null,
        title: "Service reminder",
        body:
          typeof event.payload.reason === "string"
            ? event.payload.reason
            : "A scheduled service may be due.",
        actionTarget: "/client/bookings",
      },
    ];
  }
  if (
    event.eventType.startsWith("invoice.") ||
    event.eventType === "payment.recorded" ||
    event.eventType === "payment.reversed" ||
    event.eventType === "refund.recorded"
  ) {
    return invoiceDrafts(tx, event);
  }
  if (event.eventType.startsWith("review.")) {
    return reviewDrafts(tx, event);
  }
  return [];
}

async function invoiceDrafts(tx: Tx, event: DomainEventEnvelope) {
  const invoiceId =
    event.aggregateType === "invoice"
      ? event.aggregateId
      : typeof event.payload.invoiceId === "string"
        ? event.payload.invoiceId
        : null;
  if (!invoiceId) return [];
  const [invoice] = await tx
    .select({
      id: invoices.id,
      organisationId: invoices.organisationId,
      clientAccountId: invoices.clientAccountId,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!invoice) return [];
  if (event.eventType === "payment.recorded") {
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: invoice.clientAccountId,
      organisationId: invoice.organisationId,
      title: "Payment record updated",
      body: "A payment record was added to your invoice.",
      actionTarget: `/client/invoices/${invoice.id}`,
    });
    return client ? [client] : [];
  }
  if (event.eventType === "payment.reversed" || event.eventType === "refund.recorded") {
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: invoice.clientAccountId,
      organisationId: invoice.organisationId,
      title: "Invoice payment record changed",
      body: "A payment adjustment was recorded. Open the invoice for the current balance.",
      actionTarget: `/client/invoices/${invoice.id}`,
    });
    return client ? [client] : [];
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: invoice.clientAccountId,
    organisationId: invoice.organisationId,
    title:
      event.eventType === "invoice.issued"
        ? "Invoice issued"
        : event.eventType === "invoice.paid"
          ? "Invoice marked paid"
          : "Invoice cancelled",
    body:
      event.eventType === "invoice.issued"
        ? "A new invoice is ready to review."
        : event.eventType === "invoice.paid"
          ? "Your invoice payment record is complete."
          : "An invoice was cancelled. Open it for the preserved record.",
    actionTarget: `/client/invoices/${invoice.id}`,
  });
  return client ? [client] : [];
}

async function reviewDrafts(tx: Tx, event: DomainEventEnvelope) {
  if (event.eventType === "review.requested") {
    const [job] = await tx
      .select({
        id: jobs.id,
        organisationId: jobs.organisationId,
        clientAccountId: jobs.clientAccountId,
      })
      .from(jobs)
      .where(eq(jobs.id, event.aggregateId))
      .limit(1);
    if (!job) return [];
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: job.clientAccountId,
      organisationId: job.organisationId,
      title: "How did the service go?",
      body: "Your completed job is ready for a verified review.",
      actionTarget: `/client/jobs/${job.id}`,
    });
    return client ? [client] : [];
  }
  const [review] = await tx
    .select({
      id: reviews.id,
      jobId: reviews.jobId,
      organisationId: reviews.organisationId,
      clientAccountId: reviews.clientAccountId,
    })
    .from(reviews)
    .where(eq(reviews.id, event.aggregateId))
    .limit(1);
  if (!review) return [];
  if (event.eventType === "review.responded") {
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: review.clientAccountId,
      organisationId: review.organisationId,
      title: "Professional responded to your review",
      body: "A public response was added to your verified review.",
      actionTarget: `/client/jobs/${review.jobId}`,
    });
    return client ? [client] : [];
  }
  if (event.eventType === "review.moderated") {
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: review.clientAccountId,
      organisationId: review.organisationId,
      title: "Review moderation decision",
      body: "A platform administrator completed a review decision. The original review record remains preserved.",
      actionTarget: `/client/jobs/${review.jobId}`,
    });
    const professional = await professionalDrafts(tx, {
      event,
      organisationId: review.organisationId,
      permission: permissionKeys.jobsView,
      title: "Review moderation decision",
      body: "A platform administrator completed a review decision. The original record remains preserved.",
      actionTarget: "/professional/reviews",
    });
    return client ? [client, ...professional] : professional;
  }
  return professionalDrafts(tx, {
    event,
    organisationId: review.organisationId,
    permission: permissionKeys.jobsView,
    title:
      event.eventType === "review.submitted"
        ? "New verified review"
        : "Review moderation status changed",
    body:
      event.eventType === "review.submitted"
        ? "A client submitted verified feedback for a completed job."
        : "A review was reported. The original record remains preserved.",
    actionTarget: "/professional/reviews",
  });
}

async function warrantyDrafts(tx: Tx, event: DomainEventEnvelope) {
  const [warranty] =
    event.aggregateType === "warranty"
      ? await tx
          .select({
            id: warranties.id,
            jobId: warranties.jobId,
            clientAccountId: warranties.clientAccountId,
            organisationId: warranties.organisationId,
            serviceName: warranties.serviceNameSnapshot,
          })
          .from(warranties)
          .where(eq(warranties.id, event.aggregateId))
          .limit(1)
      : await tx
          .select({
            id: warranties.id,
            jobId: warranties.jobId,
            clientAccountId: warranties.clientAccountId,
            organisationId: warranties.organisationId,
            serviceName: warranties.serviceNameSnapshot,
          })
          .from(warrantyClaims)
          .innerJoin(warranties, eq(warranties.id, warrantyClaims.warrantyId))
          .where(eq(warrantyClaims.id, event.aggregateId))
          .limit(1);
  if (!warranty) return [];
  if (event.actorAccountId === warranty.clientAccountId) {
    return professionalDrafts(tx, {
      event,
      organisationId: warranty.organisationId,
      permission: permissionKeys.jobsView,
      title:
        event.eventType === "warranty.claim_escalated"
          ? "Warranty claim escalated"
          : "New warranty claim",
      body: `The ${warranty.serviceName} warranty needs professional attention.`,
      actionTarget: `/professional/warranties/${warranty.id}`,
    });
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: warranty.clientAccountId,
    organisationId: warranty.organisationId,
    title: warrantyClientTitle(event.eventType),
    body: `Your ${warranty.serviceName} warranty has new activity.`,
    actionTarget: `/client/warranties/${warranty.id}`,
  });
  return client ? [client] : [];
}

async function jobDrafts(
  tx: Tx,
  event: DomainEventEnvelope,
  jobId: string,
) {
  const [job] = await tx
    .select({
      clientAccountId: jobs.clientAccountId,
      organisationId: jobs.organisationId,
      serviceName: jobs.serviceName,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  if (!job) return [];
  if (event.eventType === "job.assigned") {
    const professional = await professionalJobDrafts(tx, {
      event,
      jobId,
      organisationId: job.organisationId,
      title: "Job assignment updated",
      body: `The ${job.serviceName} job assignment changed.`,
      actionTarget: `/professional/jobs/${jobId}`,
    });
    const client = await activeClientDraft(tx, {
      event,
      clientAccountId: job.clientAccountId,
      organisationId: job.organisationId,
      title: "Team assigned",
      body: `The team for your ${job.serviceName} job has been updated.`,
      actionTarget: `/client/jobs/${jobId}`,
    });
    return client ? [...professional, client] : professional;
  }
  const professionalEvent =
    event.actorAccountId === job.clientAccountId ||
    event.eventType === "job.created";
  if (professionalEvent) {
    return professionalJobDrafts(tx, {
      event,
      jobId,
      organisationId: job.organisationId,
      title: jobProfessionalTitle(event),
      body: `The ${job.serviceName} job needs professional attention.`,
      actionTarget: `/professional/jobs/${jobId}`,
    });
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: job.clientAccountId,
    organisationId: job.organisationId,
    title: jobClientTitle(event.eventType),
    body: `Your ${job.serviceName} job has new activity.`,
    actionTarget: `/client/jobs/${jobId}`,
  });
  return client ? [client] : [];
}

async function professionalJobDrafts(
  tx: Tx,
  input: {
    event: DomainEventEnvelope;
    jobId: string;
    organisationId: string;
    title: string;
    body: string;
    actionTarget: string;
  },
): Promise<NotificationDraft[]> {
  const recipients = await tx
    .selectDistinct({ accountId: organisationMemberships.accountProfileId })
    .from(organisationMemberships)
    .innerJoin(
      accountProfiles,
      eq(accountProfiles.id, organisationMemberships.accountProfileId),
    )
    .innerJoin(
      rolePermissions,
      eq(rolePermissions.roleId, organisationMemberships.roleId),
    )
    .innerJoin(
      permissions,
      eq(permissions.id, rolePermissions.permissionId),
    )
    .where(
      and(
        eq(organisationMemberships.organisationId, input.organisationId),
        eq(organisationMemberships.status, "active"),
        eq(accountProfiles.status, "active"),
        eq(permissions.key, permissionKeys.jobsView),
        sql`(
          ${organisationMemberships.assignedJobsOnly} = false
          or exists (
            select 1 from ${jobAssignments}
            where ${jobAssignments.jobId} = ${input.jobId}
              and ${jobAssignments.membershipId} = ${organisationMemberships.id}
              and ${jobAssignments.active} = true
          )
        )`,
        ...(input.event.actorAccountId
          ? [
              ne(
                organisationMemberships.accountProfileId,
                input.event.actorAccountId,
              ),
            ]
          : []),
      ),
    );
  return recipients.map((recipient) => ({
    recipientAccountId: recipient.accountId,
    organisationId: input.organisationId,
    title: input.title,
    body: input.body,
    actionTarget: safeActionTarget(input.actionTarget),
  }));
}

async function requestDrafts(
  tx: Tx,
  event: DomainEventEnvelope,
  requestId: string,
) {
  const [request] = await tx
    .select({
      clientAccountId: serviceRequests.clientAccountId,
      organisationId: serviceRequests.organisationId,
      category: serviceRequests.category,
    })
    .from(serviceRequests)
    .where(eq(serviceRequests.id, requestId))
    .limit(1);
  if (!request) return [];
  const clientTarget = `/client/requests/${requestId}`;
  const professionalTarget = `/professional/enquiries/${requestId}`;
  if (
    event.eventType === "service_request.submitted" ||
    event.eventType === "service_request.cancelled" ||
    (event.eventType === "service_request.updated" &&
      event.actorAccountId === request.clientAccountId) ||
    (event.eventType === "message.sent" &&
      event.actorAccountId === request.clientAccountId)
  ) {
    return professionalDrafts(tx, {
      event,
      organisationId: request.organisationId,
      permission: permissionKeys.enquiriesView,
      title:
        event.eventType === "message.sent"
          ? "New request message"
          : event.eventType === "service_request.submitted"
            ? "New service request"
            : event.eventType === "service_request.cancelled"
              ? "Service request cancelled"
              : "Service request updated",
      body:
        event.eventType === "message.sent"
          ? `A client sent a message about the ${request.category} request.`
          : `The ${request.category} request has new activity.`,
      actionTarget: professionalTarget,
    });
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: request.clientAccountId,
    organisationId: request.organisationId,
    title:
      event.eventType === "message.sent"
        ? "New professional message"
        : event.eventType === "service_request.information_requested"
          ? "More information requested"
          : event.eventType === "service_request.declined"
            ? "Service request declined"
            : event.eventType === "service_request.expired"
              ? "Service request expired"
              : "Service request updated",
    body:
      event.eventType === "message.sent"
        ? `A professional sent a message about your ${request.category} request.`
        : `Your ${request.category} request has new activity.`,
    actionTarget: clientTarget,
  });
  return client ? [client] : [];
}

async function quotationDrafts(tx: Tx, event: DomainEventEnvelope) {
  const [quotation] = await tx
    .select({
      clientAccountId: quotations.clientAccountId,
      organisationId: quotations.organisationId,
      category: serviceRequests.category,
    })
    .from(quotations)
    .innerJoin(
      serviceRequests,
      eq(serviceRequests.id, quotations.requestId),
    )
    .where(eq(quotations.id, event.aggregateId))
    .limit(1);
  if (!quotation) return [];
  if (
    inEventTypes(event.eventType, [
      "quotation.viewed",
      "quotation.accepted",
      "quotation.declined",
      "quotation.revision_requested",
    ])
  ) {
    return professionalDrafts(tx, {
      event,
      organisationId: quotation.organisationId,
      permission: permissionKeys.quotationsView,
      title: quotationProfessionalTitle(event.eventType),
      body: `The ${quotation.category} quotation has new client activity.`,
      actionTarget: `/professional/quotations/${event.aggregateId}`,
    });
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: quotation.clientAccountId,
    organisationId: quotation.organisationId,
    title:
      event.eventType === "quotation.expired"
        ? "Quotation expired"
        : "New quotation received",
    body:
      event.eventType === "quotation.expired"
        ? `The ${quotation.category} quotation is no longer available.`
        : `A professional submitted a quotation for your ${quotation.category} request.`,
    actionTarget: `/client/quotations/${event.aggregateId}`,
  });
  return client ? [client] : [];
}

async function bookingDrafts(tx: Tx, event: DomainEventEnvelope) {
  const [booking] = await tx
    .select({
      clientAccountId: bookings.clientAccountId,
      organisationId: bookings.organisationId,
      serviceName: sql<string>`coalesce(${professionalServices.name}, ${serviceRequests.category}, 'service')`,
    })
    .from(bookings)
    .leftJoin(
      professionalServices,
      eq(professionalServices.id, bookings.professionalServiceId),
    )
    .leftJoin(serviceRequests, eq(serviceRequests.id, bookings.requestId))
    .where(eq(bookings.id, event.aggregateId))
    .limit(1);
  if (!booking) return [];
  const professionalEvent =
    event.eventType === "booking.reschedule_requested" ||
    (inEventTypes(event.eventType, [
      "booking.created",
      "booking.cancelled",
    ]) &&
      event.actorAccountId === booking.clientAccountId);
  if (professionalEvent) {
    return professionalDrafts(tx, {
      event,
      organisationId: booking.organisationId,
      permission: permissionKeys.bookingsView,
      title:
        event.eventType === "booking.reschedule_requested"
          ? "Booking reschedule requested"
          : event.eventType === "booking.cancelled"
            ? "Booking cancelled"
            : "New booking",
      body: `The ${booking.serviceName} booking has new client activity.`,
      actionTarget: `/professional/bookings/${event.aggregateId}`,
    });
  }
  const client = await activeClientDraft(tx, {
    event,
    clientAccountId: booking.clientAccountId,
    organisationId: booking.organisationId,
    title: bookingClientTitle(event.eventType),
    body: `Your ${booking.serviceName} booking has new activity.`,
    actionTarget: `/client/bookings/${event.aggregateId}`,
  });
  return client ? [client] : [];
}

async function professionalDrafts(
  tx: Tx,
  input: {
    event: DomainEventEnvelope;
    organisationId: string | null;
    permission: PermissionKey;
    title: string;
    body: string;
    actionTarget: string;
  },
): Promise<NotificationDraft[]> {
  if (!input.organisationId) return [];
  const recipients = await tx
    .selectDistinct({ accountId: organisationMemberships.accountProfileId })
    .from(organisationMemberships)
    .innerJoin(
      accountProfiles,
      eq(accountProfiles.id, organisationMemberships.accountProfileId),
    )
    .innerJoin(
      rolePermissions,
      eq(rolePermissions.roleId, organisationMemberships.roleId),
    )
    .innerJoin(
      permissions,
      eq(permissions.id, rolePermissions.permissionId),
    )
    .where(
      and(
        eq(organisationMemberships.organisationId, input.organisationId),
        eq(organisationMemberships.status, "active"),
        eq(accountProfiles.status, "active"),
        eq(permissions.key, input.permission),
        ...(input.event.actorAccountId
          ? [
              ne(
                organisationMemberships.accountProfileId,
                input.event.actorAccountId,
              ),
            ]
          : []),
      ),
    );
  return recipients.map((recipient) => ({
    recipientAccountId: recipient.accountId,
    organisationId: input.organisationId,
    title: input.title,
    body: input.body,
    actionTarget: safeActionTarget(input.actionTarget),
  }));
}

async function activeClientDraft(
  tx: Tx,
  input: {
    event: DomainEventEnvelope;
    clientAccountId: string;
    organisationId: string | null;
    title: string;
    body: string;
    actionTarget: string;
  },
): Promise<NotificationDraft | null> {
  if (input.event.actorAccountId === input.clientAccountId) return null;
  const [client] = await tx
    .select({ id: accountProfiles.id })
    .from(accountProfiles)
    .where(
      and(
        eq(accountProfiles.id, input.clientAccountId),
        eq(accountProfiles.status, "active"),
      ),
    )
    .limit(1);
  return client
    ? {
        recipientAccountId: client.id,
        organisationId: input.organisationId,
        title: input.title,
        body: input.body,
        actionTarget: safeActionTarget(input.actionTarget),
      }
    : null;
}

function safeActionTarget(target: string): string | null {
  return /^(?:\/(?:client|professional)\/(?:requests|enquiries|quotations|bookings|jobs|warranties|invoices|customers)\/[0-9a-f-]{36}|\/professional\/reviews|\/client\/bookings)$/.test(target)
    ? target
    : null;
}

function warrantyClientTitle(eventType: string) {
  const titles: Record<string, string> = {
    "warranty.created": "Warranty coverage recorded",
    "warranty.claim_under_review": "Warranty claim under review",
    "warranty.claim_accepted": "Warranty claim accepted",
    "warranty.claim_rejected": "Warranty claim decision recorded",
    "warranty.return_visit_scheduled": "Warranty return visit scheduled",
    "warranty.resolved": "Warranty claim resolved",
  };
  return titles[eventType] ?? "Warranty updated";
}

function jobProfessionalTitle(event: DomainEventEnvelope) {
  if (event.eventType === "job.variation_approved") {
    return "Variation approved";
  }
  const action = String(event.payload.action ?? "");
  if (action === "UNRESOLVED_REPORTED") return "Unresolved work reported";
  if (action === "CLARIFICATION_REQUESTED") {
    return "Completion clarification requested";
  }
  return event.eventType === "job.created"
    ? "Job ready for fulfilment"
    : "Job updated";
}

function jobClientTitle(eventType: string) {
  const titles: Record<string, string> = {
    "job.assigned": "Team assigned",
    "job.started": "Work started",
    "job.progress_updated": "Job progress updated",
    "job.awaiting_confirmation": "Work ready for confirmation",
    "job.variation_requested": "Additional work approval needed",
    "job.completed": "Job completed",
    "attachment.added": "New job evidence",
    "message.sent": "New job message",
  };
  return titles[eventType] ?? "Job updated";
}

function mapNotification(
  row: typeof notifications.$inferSelect,
): NotificationItem {
  return {
    id: row.id,
    sourceEventType: row.sourceEventType,
    title: row.title,
    body: row.body,
    actionTarget: row.actionTarget,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function inEventTypes(value: string, values: readonly string[]) {
  return values.includes(value);
}

function quotationProfessionalTitle(eventType: string) {
  const titles: Record<string, string> = {
    "quotation.viewed": "Quotation viewed",
    "quotation.accepted": "Quotation accepted",
    "quotation.declined": "Quotation declined",
    "quotation.revision_requested": "Quotation revision requested",
  };
  return titles[eventType] ?? "Quotation updated";
}

function bookingClientTitle(eventType: string) {
  const titles: Record<string, string> = {
    "booking.created": "Booking created",
    "booking.confirmed": "Booking confirmed",
    "booking.rescheduled": "Booking rescheduled",
    "booking.cancelled": "Booking cancelled",
    "booking.no_show_recorded": "Booking marked no-show",
  };
  return titles[eventType] ?? "Booking updated";
}

async function insertReadEvent(
  tx: Tx,
  input: {
    notificationId: string;
    recipientAccountId: string;
    organisationId: string | null;
    correlationId?: string;
  },
) {
  await tx.insert(outboxEvents).values(readEventValues(input));
}

function readEventValues(input: {
  notificationId: string;
  recipientAccountId: string;
  organisationId: string | null;
  correlationId?: string;
}) {
  return {
    eventType: "notification.read",
    eventVersion: 1,
    aggregateType: "notification",
    aggregateId: input.notificationId,
    organisationId: input.organisationId,
    actorAccountId: input.recipientAccountId,
    correlationId: input.correlationId,
    payload: { recipientAccountId: input.recipientAccountId },
  };
}
