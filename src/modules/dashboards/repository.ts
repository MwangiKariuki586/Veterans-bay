import { sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import type { ProfessionalDashboardData } from "./types";

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
    accountProfileId: string,
    range: { from: Date; to: Date },
    financialDataAccess: boolean,
  ): Promise<ProfessionalDashboardData> {
    const periodMs = Math.max(range.to.getTime() - range.from.getTime(), 0);
    const previousTo = range.from;
    const previousFrom = new Date(range.from.getTime() - periodMs);
    const databaseStartedAt = performance.now();
    const queryLabels = ["metrics", "recent", "schedule", "series", "team", "profile", "reputation", "actions"];
    const [metricsResult, recentResult, scheduleResult, seriesResult, teamResult, profileResult, reputationResult, actionResult] = await Promise.all([
      this.db.execute(sql`
        select
          (select count(*)::int from service_requests where organisation_id = ${organisationId} and status in ('SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_REQUIRED')) as new_enquiries,
          (select count(*)::int from service_requests where organisation_id = ${organisationId} and urgency = 'URGENT' and status in ('SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_REQUIRED')) as urgent_enquiries,
          (select count(*)::int from quotations where organisation_id = ${organisationId} and status in ('SUBMITTED','VIEWED','REVISION_REQUESTED')) as quotations_awaiting_response,
          (select count(*)::int from quotations q join quotation_versions qv on qv.quotation_id = q.id and qv.version_number = q.current_version_number where q.organisation_id = ${organisationId} and q.status in ('SUBMITTED','VIEWED') and qv.valid_until between now() and now() + interval '24 hours') as expiring_quotations,
          (select count(*)::int from bookings where organisation_id = ${organisationId} and status in ('CONFIRMED','RESCHEDULED') and ends_at >= now()) as upcoming_bookings,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and status in ('CREATED','SCHEDULED','TEAM_ASSIGNED','EN_ROUTE','IN_PROGRESS','ON_HOLD','RETURN_VISIT_REQUIRED')) as jobs_in_progress,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and scheduled_starts_at >= date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi' and scheduled_starts_at < (date_trunc('day', now() at time zone 'Africa/Nairobi') + interval '1 day') at time zone 'Africa/Nairobi' and status not in ('CANCELLED','COMPLETED')) as jobs_today,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and scheduled_starts_at <= now() and checked_in_at is null and status in ('SCHEDULED','TEAM_ASSIGNED','EN_ROUTE')) as jobs_needing_check_in,
          (select count(*)::int from invoices where organisation_id = ${organisationId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_payments,
          (select count(*)::int from invoices where organisation_id = ${organisationId} and status = 'OVERDUE') as overdue_invoices,
          (select coalesce(sum(total_minor), 0)::bigint from invoices where organisation_id = ${organisationId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')) as outstanding_invoices_minor,
          (select min(due_at) from invoices where organisation_id = ${organisationId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE') and due_at is not null) as next_invoice_due_at,
          (select count(*)::int from warranty_claims wc join warranties w on w.id = wc.warranty_id where w.organisation_id = ${organisationId} and wc.status in ('SUBMITTED','UNDER_REVIEW','ESCALATED','ACCEPTED','RETURN_VISIT_SCHEDULED')) as warranty_claims,
          (select count(*)::int from reviews where organisation_id = ${organisationId} and submitted_at >= ${range.from} and submitted_at < ${range.to}) as recent_reviews,
          (select coalesce(round(avg(overall_rating)::numeric, 2), 0) from reviews where organisation_id = ${organisationId} and status = 'PUBLISHED' and submitted_at >= ${range.from} and submitted_at < ${range.to}) as average_rating,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and status = 'COMPLETED' and completed_at >= ${range.from} and completed_at < ${range.to}) as completed_jobs,
          (select count(*)::int from jobs where organisation_id = ${organisationId} and created_at >= ${range.from} and created_at < ${range.to}) as total_jobs,
          (select coalesce(sum(amount_minor), 0)::bigint from payments where organisation_id = ${organisationId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${range.from} and paid_at < ${range.to}) as revenue_minor,
          (select coalesce(sum(amount_minor), 0)::bigint from payments where organisation_id = ${organisationId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${previousFrom} and paid_at < ${previousTo}) as previous_revenue_minor,
          (select coalesce(round(avg(total_minor)), 0)::bigint from jobs where organisation_id = ${organisationId} and status = 'COMPLETED' and completed_at >= ${range.from} and completed_at < ${range.to}) as average_job_value_minor,
          (select coalesce(round(avg(total_minor)), 0)::bigint from jobs where organisation_id = ${organisationId} and status = 'COMPLETED' and completed_at >= ${previousFrom} and completed_at < ${previousTo}) as previous_average_job_value_minor,
          (select count(*)::int from notifications where recipient_account_id = ${accountProfileId} and organisation_id = ${organisationId} and read_at is null) as unread_notifications,
          (select count(*)::int from bookings where organisation_id = ${organisationId} and status not in ('CANCELLED','NO_SHOW') and starts_at >= (date_trunc('day', now() at time zone 'Africa/Nairobi') + interval '1 day') at time zone 'Africa/Nairobi' and starts_at < (date_trunc('day', now() at time zone 'Africa/Nairobi') + interval '2 day') at time zone 'Africa/Nairobi') as tomorrow_jobs,
          (select count(*)::int from bookings where organisation_id = ${organisationId} and status not in ('CANCELLED','NO_SHOW') and starts_at >= date_trunc('week', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi' and starts_at < (date_trunc('week', now() at time zone 'Africa/Nairobi') + interval '1 week') at time zone 'Africa/Nairobi') as week_jobs,
          (select count(*)::int from bookings where organisation_id = ${organisationId} and status not in ('CANCELLED','NO_SHOW') and assigned_membership_id is null and starts_at >= date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi' and starts_at < (date_trunc('day', now() at time zone 'Africa/Nairobi') + interval '1 day') at time zone 'Africa/Nairobi') as unassigned_today
      `),
      this.db.execute(sql`
        select id, service_name as title, status, updated_at as "updatedAt",
          '/professional/jobs/' || id::text as "actionTarget"
        from jobs
        where organisation_id = ${organisationId}
        order by updated_at desc, id desc
        limit 8
      `),
      this.db.execute(sql`
        select b.id, b.starts_at as "startsAt", b.ends_at as "endsAt",
          coalesce(j.service_name, ps.name, 'Scheduled service') as "serviceName",
          client.display_name as "clientName",
          coalesce(sr.location, pp.operating_location, 'Location to confirm') as location,
          coalesce(j.status, b.status) as status,
          coalesce(assignee.display_name, 'Unassigned') as "assignmentName"
        from bookings b
        left join jobs j on j.booking_id = b.id
        left join professional_services ps on ps.id = b.professional_service_id
        left join service_requests sr on sr.id = b.request_id
        left join professional_profiles pp on pp.organisation_id = b.organisation_id
        join account_profiles client on client.id = b.client_account_id
        left join organisation_memberships om on om.id = b.assigned_membership_id
        left join account_profiles assignee on assignee.id = om.account_profile_id
        where b.organisation_id = ${organisationId}
          and b.starts_at >= date_trunc('day', now() at time zone b.timezone) at time zone b.timezone
          and b.starts_at < (date_trunc('day', now() at time zone b.timezone) + interval '1 day') at time zone b.timezone
          and b.status not in ('CANCELLED','NO_SHOW')
        order by b.starts_at asc, b.id asc limit 8
      `),
      this.db.execute(sql`
        with days as (
          select generate_series(${range.from}::timestamptz::date, (${range.to}::timestamptz - interval '1 millisecond')::date, interval '1 day')::date as bucket_day
        ), revenue as (
          select paid_at::date as bucket_day, sum(amount_minor)::bigint value from payments
          where organisation_id = ${organisationId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${range.from} and paid_at < ${range.to} group by 1
        ), completed as (
          select completed_at::date as bucket_day, count(*)::int value from jobs where organisation_id = ${organisationId} and status = 'COMPLETED' and completed_at >= ${range.from} and completed_at < ${range.to} group by 1
        ), enquiries as (
          select submitted_at::date as bucket_day, count(*)::int value from service_requests where organisation_id = ${organisationId} and submitted_at >= ${range.from} and submitted_at < ${range.to} group by 1
        ), quotes as (
          select created_at::date as bucket_day, count(*)::int total, count(*) filter (where status = 'ACCEPTED')::int accepted from quotations where organisation_id = ${organisationId} and created_at >= ${range.from} and created_at < ${range.to} group by 1
        )
        select d.bucket_day::text as day, coalesce(r.value, 0)::bigint revenue,
          coalesce(c.value, 0)::int as "jobsCompleted", coalesce(e.value, 0)::int enquiries,
          case when coalesce(q.total, 0) = 0 then 0 else round(q.accepted::numeric * 100 / q.total)::int end as "quoteConversion"
        from days d left join revenue r using(bucket_day) left join completed c using(bucket_day) left join enquiries e using(bucket_day) left join quotes q using(bucket_day)
        order by d.bucket_day
      `),
      this.db.execute(sql`
        select om.id, ap.display_name as name, u.image as "imageUrl",
          case
            when exists (select 1 from availability_blocks ab where ab.membership_id = om.id and ab.starts_at < now() and ab.ends_at > now()) then 'unavailable'
            when exists (select 1 from job_assignments ja join jobs j on j.id = ja.job_id where ja.membership_id = om.id and ja.active = true and j.status in ('EN_ROUTE','IN_PROGRESS')) then 'on_job'
            else 'available'
          end as status
        from organisation_memberships om join account_profiles ap on ap.id = om.account_profile_id
        left join "user" u on u.id = ap.auth_user_id
        where om.organisation_id = ${organisationId} and om.status = 'active'
        order by ap.display_name asc limit 12
      `),
      this.db.execute(sql`
        select o.name, pp.description, pp.primary_category as "primaryCategory", pp.phone, pp.email,
          pp.operating_location as "operatingLocation", pp.service_areas as "serviceAreas",
          pp.working_hours as "workingHours", pp.logo_asset_id as "logoAssetId", pp.verification_status as "verificationStatus",
          (select count(*)::int from professional_services where organisation_id = ${organisationId} and status = 'published') as "publishedServices",
          (select count(*)::int from professional_service_images psi join professional_services ps on ps.id = psi.service_id where ps.organisation_id = ${organisationId}) as "portfolioImages"
        from organisations o left join professional_profiles pp on pp.organisation_id = o.id where o.id = ${organisationId}
      `),
      this.db.execute(sql`
        select coalesce(pr.review_count, (select count(*)::int from reviews where organisation_id = ${organisationId} and status = 'PUBLISHED')) as "reviewCount",
          coalesce(pr.average_rating_hundredths, (select round(avg(overall_rating) * 100)::int from reviews where organisation_id = ${organisationId} and status = 'PUBLISHED')) as "averageRatingHundredths",
          coalesce(pr.response_rate_basis_points, 0) as "responseRateBasisPoints",
          (select json_build_object('feedback', r.feedback, 'clientName', ap.display_name, 'submittedAt', r.submitted_at) from reviews r join account_profiles ap on ap.id = r.client_account_id where r.organisation_id = ${organisationId} and r.status = 'PUBLISHED' order by r.submitted_at desc limit 1) as "latestReview",
          (select json_build_object('serviceQuality', avg(service_quality_rating), 'communication', avg(communication_rating), 'timeliness', avg(timeliness_rating), 'professionalism', avg(professionalism_rating), 'value', avg(value_rating)) from reviews where organisation_id = ${organisationId} and status = 'PUBLISHED') as dimensions
        from (select 1) seed left join professional_reputation pr on pr.organisation_id = ${organisationId}
      `),
      this.db.execute(sql`
        select 'enquiry' kind, id, category as title, location as meta, submitted_at as "occurredAt", urgency, status, null::timestamptz as "validUntil"
        from service_requests where organisation_id = ${organisationId} and status in ('SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','ASSESSMENT_REQUIRED')
        union all
        select 'quotation', q.id, coalesce(sr.category, 'Quotation'), coalesce(sr.location, 'Client request'), q.updated_at, null, q.status, qv.valid_until
        from quotations q join service_requests sr on sr.id = q.request_id left join quotation_versions qv on qv.quotation_id = q.id and qv.version_number = q.current_version_number
        where q.organisation_id = ${organisationId} and q.status in ('SUBMITTED','VIEWED','REVISION_REQUESTED')
        union all
        select 'invoice', i.id, i.invoice_number, coalesce(ap.display_name, 'Client'), i.updated_at, null, i.status, i.due_at
        from invoices i join account_profiles ap on ap.id = i.client_account_id where i.organisation_id = ${organisationId} and i.status in ('ISSUED','PARTIALLY_PAID','OVERDUE')
        order by "occurredAt" desc limit 16
      `),
    ].map((query, index) => query.catch((cause) => {
      console.error("professional_dashboard_query_failed", { query: queryLabels[index], cause });
      throw cause;
    })));
    const databaseMs = performance.now() - databaseStartedAt;
    const aggregationStartedAt = performance.now();
    const metrics = numeric(metricsResult.rows[0]);
    const metricsRow = (metricsResult.rows[0] ?? {}) as Record<string, unknown>;
    const nextInvoiceDueRaw = metricsRow.next_invoice_due_at;
    const nextInvoiceDueAt =
      nextInvoiceDueRaw instanceof Date
        ? nextInvoiceDueRaw.toISOString()
        : typeof nextInvoiceDueRaw === "string" && nextInvoiceDueRaw
          ? new Date(nextInvoiceDueRaw).toISOString()
          : null;
    const totalJobs = metrics.total_jobs ?? 0;
    const completedJobs = metrics.completed_jobs ?? 0;
    const visibleMetrics: Record<string, number | null> = {
        ...metrics,
        completion_rate:
          totalJobs === 0 ? 0 : Math.round((completedJobs / totalJobs) * 100),
        revenue_minor: financialDataAccess ? metrics.revenue_minor ?? 0 : null,
    };
    const teamMembers = teamResult.rows.map((item) => ({
      id: String(item.id), name: String(item.name), imageUrl: item.imageUrl ? String(item.imageUrl) : null,
      status: String(item.status) as "available" | "on_job" | "unavailable",
    }));
    const profile = (profileResult.rows[0] ?? {}) as Record<string, unknown>;
    const profileChecks = [profile.description, profile.primaryCategory, profile.phone, profile.email, profile.operatingLocation,
      Array.isArray(profile.serviceAreas) && profile.serviceAreas.length > 0,
      profile.workingHours && Object.keys(profile.workingHours as object).length > 0, profile.logoAssetId,
      Number(profile.publishedServices) > 0, Number(profile.portfolioImages) > 0, profile.verificationStatus === "verified"];
    const score = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);
    const nextAction = !profile.description
      ? ["Add description", "/professional/profile"]
      : Number(profile.portfolioImages) === 0
        ? ["Add photos", "/professional/profile"]
        : Number(profile.publishedServices) === 0
          ? ["Publish service", "/professional/services"]
          : ["Review profile", "/professional/profile"];
    const reputation = (reputationResult.rows[0] ?? {}) as Record<string, unknown>;
    const dimensions = (reputation.dimensions ?? {}) as Record<string, unknown>;
    const strengths = Object.entries(dimensions).sort((a, b) => Number(b[1] ?? 0) - Number(a[1] ?? 0)).slice(0, 3).map(([key]) => ({ serviceQuality: "Quality workmanship", communication: "Clear communication", timeliness: "On-time arrival", professionalism: "Professional service", value: "Good value" })[key] ?? key);
    const actionGroups = buildActionGroups(actionResult.rows);
    const outstandingMinor = financialDataAccess ? metrics.outstanding_invoices_minor ?? 0 : null;
    const result: ProfessionalDashboardData = {
      metrics: visibleMetrics,
      restrictedMetrics: financialDataAccess ? [] : ["revenue_minor", "outstanding_invoices_minor", "average_job_value_minor"],
      recent: recentResult.rows as ProfessionalDashboardData["recent"],
      summary: {
        newEnquiries: metrics.new_enquiries ?? 0, urgentEnquiries: metrics.urgent_enquiries ?? 0,
        quotationsAwaitingDecision: metrics.quotations_awaiting_response ?? 0, expiringQuotations: metrics.expiring_quotations ?? 0,
        jobsToday: metrics.jobs_today ?? 0, jobsNeedingCheckIn: metrics.jobs_needing_check_in ?? 0,
        jobsInProgress: metrics.jobs_in_progress ?? 0, upcomingBookings: metrics.upcoming_bookings ?? 0,
        outstandingInvoices: metrics.outstanding_payments ?? 0, overdueInvoices: metrics.overdue_invoices ?? 0,
        outstandingInvoicesMinor: outstandingMinor, revenueMinor: financialDataAccess ? metrics.revenue_minor ?? 0 : null,
        expectedPaymentsMinor: outstandingMinor, averageJobValueMinor: financialDataAccess ? metrics.average_job_value_minor ?? 0 : null,
        previousRevenueMinor: financialDataAccess ? metrics.previous_revenue_minor ?? 0 : null,
        previousAverageJobValueMinor: financialDataAccess ? metrics.previous_average_job_value_minor ?? 0 : null,
        nextInvoiceDueAt,
      },
      navigationBadges: { enquiries: metrics.new_enquiries ?? 0, quotations: metrics.quotations_awaiting_response ?? 0, invoices: metrics.outstanding_payments ?? 0, reviews: metrics.recent_reviews ?? 0 },
      utilityBadges: { notifications: metrics.unread_notifications ?? 0, messages: 0 },
      profileVisibility: { score, status: score >= 85 ? "Excellent" : score >= 65 ? "Good" : "Needs attention", description: score >= 85 ? "Your profile is highly visible in the marketplace." : "Complete your profile to improve client confidence.", nextAction: nextAction[0], nextActionHref: nextAction[1] },
      actionGroups,
      schedule: scheduleResult.rows.map((item) => ({
        id: String(item.id),
        reference: `BKG-${String(item.id).replace(/-/g, "").slice(0, 4).toUpperCase()}`,
        timeRange: formatRange(item.startsAt, item.endsAt),
        serviceName: String(item.serviceName),
        clientName: String(item.clientName),
        location: String(item.location),
        status: String(item.status),
        assignmentName: String(item.assignmentName),
        href: `/professional/bookings/${item.id}`,
        action:
          item.status === "IN_PROGRESS"
            ? "Check in"
            : item.assignmentName === "Unassigned"
              ? "Assign"
              : "View",
      })),
      scheduleSummary: {
        tomorrowJobs: metrics.tomorrow_jobs ?? 0,
        weekJobs: metrics.week_jobs ?? 0,
        unassignedToday: metrics.unassigned_today ?? 0,
      },
      performance: { range: { from: range.from.toISOString(), to: range.to.toISOString() }, series: seriesResult.rows.map((item) => ({ day: String(item.day), revenue: financialDataAccess ? Number(item.revenue) : null, jobsCompleted: Number(item.jobsCompleted), enquiries: Number(item.enquiries), quoteConversion: Number(item.quoteConversion) })) },
      teamToday: { members: teamMembers, available: teamMembers.filter((member) => member.status === "available").length, onJobs: teamMembers.filter((member) => member.status === "on_job").length, unavailable: teamMembers.filter((member) => member.status === "unavailable").length, conflicts: 0 },
      marketplaceInsights: buildInsights(profile, metrics),
      reputation: { averageRating: Number(reputation.averageRatingHundredths ?? 0) / 100, reviewCount: Number(reputation.reviewCount ?? 0), newReviews: metrics.recent_reviews ?? 0, responseRate: Number(reputation.responseRateBasisPoints ?? 0) / 100, topStrengths: strengths, latestReview: reputation.latestReview as ProfessionalDashboardData["reputation"]["latestReview"] ?? null },
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      generatedAt: new Date().toISOString(),
      source: "transactional" as const,
    };
    result.serverTiming = { databaseMs, aggregationMs: performance.now() - aggregationStartedAt };
    return result;
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

function buildActionGroups(rows: Array<Record<string, unknown>>): ProfessionalDashboardData["actionGroups"] {
  const groups: ProfessionalDashboardData["actionGroups"] = [
    { id: "priority", label: "High priority", items: [] }, { id: "today", label: "Today", items: [] }, { id: "follow-up", label: "Follow-up", items: [] },
  ];
  for (const row of rows) {
    const kind = String(row.kind);
    const urgent = row.urgency === "URGENT" || row.status === "OVERDUE" || (row.validUntil && new Date(String(row.validUntil)).getTime() - Date.now() < 86_400_000);
    const group = groups[urgent ? 0 : kind === "enquiry" ? 1 : 2];
    group.items.push({ id: String(row.id), title: kind === "invoice" ? `${row.title} needs payment follow-up` : kind === "quotation" ? `${row.title} quote awaits a decision` : `${row.title} enquiry from ${row.meta}`, meta: kind === "invoice" ? `Client: ${row.meta}` : String(row.meta), href: `/professional/${kind === "enquiry" ? "enquiries" : kind === "quotation" ? "quotations" : "invoices"}/${row.id}`, action: kind === "enquiry" ? "Respond" : kind === "quotation" ? "Follow up" : "Review", tone: urgent ? "danger" : kind === "quotation" ? "warning" : "info" });
  }
  return groups.filter((group) => group.items.length > 0);
}

function buildInsights(profile: Record<string, unknown>, metrics: Record<string, number>): ProfessionalDashboardData["marketplaceInsights"] {
  const area = Array.isArray(profile.serviceAreas) && profile.serviceAreas[0] ? String(profile.serviceAreas[0]) : String(profile.operatingLocation ?? "your service area");
  return [
    { id: "demand", title: `${profile.primaryCategory ?? "Service"} demand is active in ${area}`, description: `${metrics.new_enquiries ?? 0} open enquiries currently need attention.`, tone: "green" },
    { id: "response", title: metrics.urgent_enquiries ? "Urgent enquiries are waiting" : "No urgent enquiries are waiting", description: metrics.urgent_enquiries ? "Responding promptly can improve quote conversion." : "Your urgent queue is clear.", tone: "blue" },
    { id: "availability", title: "Keep availability current", description: "Accurate working hours and blocks help avoid assignment conflicts.", tone: "violet" },
  ];
}

function formatRange(start: unknown, end: unknown) {
  const formatter = new Intl.DateTimeFormat("en-KE", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Nairobi" });
  return `${formatter.format(new Date(String(start)))}–${formatter.format(new Date(String(end)))}`;
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
