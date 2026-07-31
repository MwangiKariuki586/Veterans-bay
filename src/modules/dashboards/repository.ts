import { sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";

export class DashboardsRepository {
  constructor(private readonly db: Database) {}

  async client(accountId: string) {
    const [metricsResult, recentResult] = await Promise.all([
      this.db.execute(sql`
        select
          (select count(*)::int from service_requests where client_account_id = ${accountId} and status in ('SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_REQUIRED')) as active_requests,
          (select count(*)::int from quotations where client_account_id = ${accountId} and status in ('SUBMITTED','VIEWED','REVISION_REQUESTED')) as pending_quotations,
          (select count(*)::int from bookings where client_account_id = ${accountId} and status in ('CONFIRMED','RESCHEDULED') and ends_at >= now()) as upcoming_bookings,
          (select count(*)::int from jobs where client_account_id = ${accountId} and status in ('CREATED','SCHEDULED','TEAM_ASSIGNED','EN_ROUTE','IN_PROGRESS','ON_HOLD','RETURN_VISIT_REQUIRED')) as active_jobs,
          (select count(*)::int from jobs where client_account_id = ${accountId} and status = 'AWAITING_CLIENT_CONFIRMATION') as completion_confirmations,
          (select count(*)::int from warranties where client_account_id = ${accountId} and status = 'ACTIVE' and ends_at >= now()) as active_warranties
      `),
      this.db.execute(sql`
        select id, service_name as title, status, updated_at as "updatedAt",
          case when status = 'AWAITING_CLIENT_CONFIRMATION' then '/client/jobs/' || id::text
               else '/client/jobs/' || id::text end as "actionTarget"
        from jobs
        where client_account_id = ${accountId}
        order by updated_at desc, id desc
        limit 8
      `),
    ]);
    return {
      metrics: numeric(metricsResult.rows[0]),
      recent: recentResult.rows,
      generatedAt: new Date().toISOString(),
      source: "transactional" as const,
    };
  }

  async professional(
    organisationId: string,
    range: { from: Date; to: Date },
    financialDataAccess: boolean,
  ) {
    const [metricsResult, recentResult] = await Promise.all([
      this.db.execute(sql`
        select
          (select count(*)::int from service_requests where organisation_id = ${organisationId} and status in ('SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_REQUIRED')) as new_enquiries,
          (select count(*)::int from quotations where organisation_id = ${organisationId} and status in ('SUBMITTED','VIEWED','REVISION_REQUESTED')) as quotations_awaiting_response,
          (select count(*)::int from bookings where organisation_id = ${organisationId} and status in ('CONFIRMED','RESCHEDULED') and ends_at >= now()) as upcoming_bookings,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and status in ('CREATED','SCHEDULED','TEAM_ASSIGNED','EN_ROUTE','IN_PROGRESS','ON_HOLD','RETURN_VISIT_REQUIRED')) as jobs_in_progress,
          (select count(*)::int from invoices where organisation_id = ${organisationId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_payments,
          (select count(*)::int from warranty_claims wc join warranties w on w.id = wc.warranty_id where w.organisation_id = ${organisationId} and wc.status in ('SUBMITTED','UNDER_REVIEW','ESCALATED','ACCEPTED','RETURN_VISIT_SCHEDULED')) as warranty_claims,
          (select count(*)::int from reviews where organisation_id = ${organisationId} and submitted_at >= ${range.from} and submitted_at < ${range.to}) as recent_reviews,
          (select coalesce(round(avg(overall_rating)::numeric, 2), 0) from reviews where organisation_id = ${organisationId} and status = 'PUBLISHED' and submitted_at >= ${range.from} and submitted_at < ${range.to}) as average_rating,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and status = 'COMPLETED' and completed_at >= ${range.from} and completed_at < ${range.to}) as completed_jobs,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and created_at >= ${range.from} and created_at < ${range.to}) as total_jobs,
          (select coalesce(sum(amount_minor), 0)::bigint from payments where organisation_id = ${organisationId} and status = 'RECORDED' and paid_at >= ${range.from} and paid_at < ${range.to}) as revenue_minor
      `),
      this.db.execute(sql`
        select id, service_name as title, status, updated_at as "updatedAt",
          '/professional/jobs/' || id::text as "actionTarget"
        from jobs
        where organisation_id = ${organisationId}
        order by updated_at desc, id desc
        limit 8
      `),
    ]);
    const metrics = numeric(metricsResult.rows[0]);
    const totalJobs = metrics.total_jobs ?? 0;
    const completedJobs = metrics.completed_jobs ?? 0;
    return {
      metrics: {
        ...metrics,
        completion_rate:
          totalJobs === 0 ? 0 : Math.round((completedJobs / totalJobs) * 100),
        revenue_minor: financialDataAccess ? metrics.revenue_minor ?? 0 : null,
      },
      restrictedMetrics: financialDataAccess ? [] : ["revenue_minor"],
      recent: recentResult.rows,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: "transactional" as const,
    };
  }

  async administrator(range: { from: Date; to: Date }) {
    const [metricsResult, trendResult, recentResult] = await Promise.all([
      this.db.execute(sql`
        select
          (select count(*)::int from organisations where status = 'pending_review') as pending_professional_reviews,
          (select count(*)::int from organisations where status = 'active') as active_professionals,
          (select count(*)::int from service_requests where submitted_at >= ${range.from} and submitted_at < ${range.to}) as new_requests,
          (select count(*)::int from jobs where status = 'COMPLETED' and completed_at >= ${range.from} and completed_at < ${range.to}) as completed_jobs,
          (select count(*)::int from moderation_reports where status in ('OPEN','IN_REVIEW')) as open_reports,
          (select count(*)::int from disputes where status in ('OPEN','INVESTIGATING','AWAITING_DECISION')) as active_disputes,
          (select count(*)::int from jobs where created_at >= ${range.from} and created_at < ${range.to}) as total_jobs
      `),
      this.db.execute(sql`
        select day::text as day, sum(event_count)::int as value
        from analytics_daily_counts
        where day >= ${range.from}::date and day < ${range.to}::date
          and event_type in ('service_request.submitted','quotation.accepted','booking.confirmed','job.completed')
        group by day
        order by day asc
        limit 366
      `),
      this.db.execute(sql`
        select id, action as title, entity_type as "entityType", created_at as "updatedAt",
          '/admin/audit' as "actionTarget"
        from audit_events
        order by created_at desc, id desc
        limit 8
      `),
    ]);
    const metrics = numeric(metricsResult.rows[0]);
    const totalJobs = metrics.total_jobs ?? 0;
    const completedJobs = metrics.completed_jobs ?? 0;
    return {
      metrics: {
        ...metrics,
        completion_rate:
          totalJobs === 0 ? 0 : Math.round((completedJobs / totalJobs) * 100),
      },
      engagementTrend: trendResult.rows,
      recent: recentResult.rows,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: "event-backed-live-summary" as const,
    };
  }
}

function numeric(row: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!row || typeof row !== "object") return result;
  for (const [key, value] of Object.entries(row)) {
    const converted = Number(value);
    result[key] = Number.isFinite(converted) ? converted : 0;
  }
  return result;
}
