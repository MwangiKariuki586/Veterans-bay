import { sql } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import type { ClientDashboardData, ProfessionalDashboardData } from "./types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  })
    .format(value / 100)
    .replace("KES", "KSh");
}

export class DashboardsRepository {
  constructor(private readonly db: Database) {}

  async client(accountId: string, rangeInput?: { from: Date; to: Date }): Promise<ClientDashboardData> {
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const range = rangeInput ?? { from: defaultFrom, to: defaultTo };
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    const prevMonthEnd = monthStart;
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const databaseStartedAt = performance.now();

    const [
      metricsResult,
      recentResult,
      outstandingResult,
      warrantiesResult,
      savedResult,
      nextBookingResult,
      spendingCurrentResult,
      spendingPrevResult,
      avgCostCurrentResult,
      avgCostPrevResult,
      ytdResult,
      seriesResult,
      professionalsResult,
      upcomingBookingsResult,
      recommendedResult,
      actionQuotationsResult,
      actionInvoicesResult,
      actionJobsResult,
      actionWarrantiesResult,
    ] = await Promise.all([
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
          '/client/bookings/' || booking_id::text || '#service-progress' as "actionTarget"
        from jobs
        where client_account_id = ${accountId}
        order by updated_at desc, id desc
        limit 8
      `),
      this.db.execute(sql`
        select
          coalesce(sum(total_minor), 0)::bigint as outstanding_minor,
          count(*)::int as outstanding_count
        from invoices
        where client_account_id = ${accountId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')
      `),
      this.db.execute(sql`
        select
          count(*)::int as active_count,
          count(*) filter (where ends_at <= now() + interval '30 days')::int as expiring_soon_count
        from warranties
        where client_account_id = ${accountId} and status = 'ACTIVE' and ends_at >= now()
      `),
      this.db.execute(sql`
        select count(*)::int as saved_count from saved_professionals where account_profile_id = ${accountId}
      `),
      this.db.execute(sql`
        select starts_at as "nextBookingAt"
        from bookings
        where client_account_id = ${accountId} and status in ('CONFIRMED','RESCHEDULED','PENDING_CONFIRMATION','PENDING_DEPOSIT') and starts_at >= now()
        order by starts_at asc limit 1
      `),
      this.db.execute(sql`
        select coalesce(sum(amount_minor), 0)::bigint as sum_minor
        from payments
        where client_account_id = ${accountId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${monthStart} and paid_at < ${monthEnd}
      `),
      this.db.execute(sql`
        select coalesce(sum(amount_minor), 0)::bigint as sum_minor
        from payments
        where client_account_id = ${accountId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${prevMonthStart} and paid_at < ${prevMonthEnd}
      `),
      this.db.execute(sql`
        select coalesce(round(avg(j.total_minor)), 0)::bigint as avg_minor
        from jobs j
        where j.client_account_id = ${accountId} and j.status = 'COMPLETED' and j.completed_at >= ${monthStart} and j.completed_at < ${monthEnd}
      `),
      this.db.execute(sql`
        select coalesce(round(avg(j.total_minor)), 0)::bigint as avg_minor
        from jobs j
        where j.client_account_id = ${accountId} and j.status = 'COMPLETED' and j.completed_at >= ${prevMonthStart} and j.completed_at < ${prevMonthEnd}
      `),
      this.db.execute(sql`
        select coalesce(sum(amount_minor), 0)::bigint as ytd_minor
        from payments
        where client_account_id = ${accountId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${yearStart} and paid_at < ${now}
      `),
      this.db.execute(sql`
        with days as (
          select generate_series(${range.from}::timestamptz::date, (${range.to}::timestamptz - interval '1 millisecond')::date, interval '1 day')::date as bucket_day
        ), spend as (
          select paid_at::date as bucket_day, sum(amount_minor)::bigint value from payments
          where client_account_id = ${accountId} and status in ('RECORDED','PARTIALLY_ALLOCATED','ALLOCATED') and paid_at >= ${range.from} and paid_at < ${range.to} group by 1
        )
        select d.bucket_day::text as day, coalesce(s.value, 0)::bigint as value
        from days d left join spend s using(bucket_day)
        order by d.bucket_day
      `),
      this.db.execute(sql`
        select distinct on (o.id)
          o.id, o.slug as "organisationSlug", o.name as "organisationName",
          coalesce(pp.primary_category, 'Professional') as specialty,
          pr.average_rating_hundredths as "avgHundredths",
          pr.review_count as "reviewCount",
          pr.verified_jobs as "verifiedJobs",
          fa.cloudinary_public_id as "imagePublicId",
          max(b.starts_at) over (partition by o.id) as last_interaction
        from bookings b
        join organisations o on o.id = b.organisation_id
        left join professional_profiles pp on pp.organisation_id = o.id
        left join professional_reputation pr on pr.organisation_id = o.id
        left join file_assets fa on fa.id = pp.logo_asset_id and fa.visibility = 'public' and fa.status = 'ready'
        where b.client_account_id = ${accountId}
        order by o.id, b.starts_at desc
        limit 12
      `),
      this.db.execute(sql`
        select
          b.id, b.starts_at as "scheduledAt", b.ends_at as "endsAt", b.status,
          coalesce(j.service_name, ps.name, sr.category, 'Service') as "serviceName",
          o.name as "professionalName",
          fa.cloudinary_public_id as "professionalImagePublicId",
          ps.slug as "serviceSlug"
        from bookings b
        left join jobs j on j.booking_id = b.id
        left join professional_services ps on ps.id = b.professional_service_id
        left join service_requests sr on sr.id = b.request_id
        join organisations o on o.id = b.organisation_id
        left join professional_profiles pp on pp.organisation_id = o.id
        left join file_assets fa on fa.id = pp.logo_asset_id and fa.visibility='public' and fa.status='ready'
        where b.client_account_id = ${accountId} and b.status not in ('CANCELLED','NO_SHOW')
          and b.starts_at >= (now() - interval '1 day')
        order by b.starts_at asc
        limit 4
      `),
      this.db.execute(sql`
        select
          ranked.id, ranked.slug, ranked.name, ranked.category,
          ranked."priceMinor", ranked.currency, ranked."organisationSlug",
          ranked."organisationName", ranked."ratingHundredths",
          ranked."reviewCount", ranked."imagePublicId"
        from (
          select
            ps.id, ps.slug, ps.name, ps.category, ps.price_minor as "priceMinor", ps.currency,
            ps.published_at as "publishedAt",
            o.slug as "organisationSlug", o.name as "organisationName",
            pr.average_rating_hundredths as "ratingHundredths",
            coalesce(pr.review_count, 0) as "reviewCount",
            fa.cloudinary_public_id as "imagePublicId",
            row_number() over (
              partition by o.id
              order by ps.published_at desc nulls last, ps.id
            ) as provider_rank
          from professional_services ps
          join organisations o on o.id = ps.organisation_id
          join professional_profiles pp on pp.organisation_id = o.id
          left join professional_reputation pr on pr.organisation_id = o.id
          left join file_assets fa on fa.id = (
            select psi.asset_id from professional_service_images psi
            join file_assets fa2 on fa2.id = psi.asset_id
            where psi.service_id = ps.id and fa2.visibility='public' and fa2.status='ready' and fa2.purpose='SERVICE_IMAGE'
            order by psi.position asc limit 1
          )
          where ps.status='published' and ps.moderation_status='clear'
            and o.status='active'
            and ps.category is not null
        ) ranked
        where ranked.provider_rank = 1
        order by coalesce(ranked."ratingHundredths", 0) desc,
          ranked."reviewCount" desc nulls last,
          ranked."publishedAt" desc nulls last,
          ranked.id
        limit 4
      `),
      this.db.execute(sql`
        select q.id, coalesce(sr.category, 'Plumbing repair') as category, q.updated_at
        from quotations q
        join service_requests sr on sr.id = q.request_id
        where q.client_account_id = ${accountId} and q.status in ('SUBMITTED','VIEWED','REVISION_REQUESTED')
        order by q.updated_at desc limit 1
      `),
      this.db.execute(sql`
        select id, invoice_number as "invoiceNumber", total_minor as "totalMinor", due_at as "dueAt"
        from invoices
        where client_account_id = ${accountId} and status in ('ISSUED','PARTIALLY_PAID','OVERDUE')
        order by due_at asc nulls last, created_at desc limit 1
      `),
      this.db.execute(sql`
        select id, booking_id as "bookingId", service_name as "serviceName"
        from jobs
        where client_account_id = ${accountId} and status = 'AWAITING_CLIENT_CONFIRMATION'
        order by updated_at desc limit 1
      `),
      this.db.execute(sql`
        select id, service_name_snapshot as "serviceName", ends_at as "endsAt"
        from warranties
        where client_account_id = ${accountId} and status='ACTIVE' and ends_at >= now() and ends_at <= now() + interval '45 days'
        order by ends_at asc limit 1
      `),
    ]);

    const databaseMs = performance.now() - databaseStartedAt;
    const aggregationStartedAt = performance.now();

    const legacyMetrics = numeric(metricsResult.rows[0]);
    const outstandingRow = (outstandingResult.rows[0] ?? {}) as Record<string, unknown>;
    const warrantiesRow = (warrantiesResult.rows[0] ?? {}) as Record<string, unknown>;
    const savedRow = (savedResult.rows[0] ?? {}) as Record<string, unknown>;
    const nextBookingRaw = (nextBookingResult.rows[0] as Record<string, unknown> | undefined)?.nextBookingAt;
    const nextBookingAtIso = nextBookingRaw ? new Date(nextBookingRaw as string | Date).toISOString() : null;

    const spendingCurrentMinor = Number((spendingCurrentResult.rows[0] as Record<string, unknown> | undefined)?.sum_minor ?? 0);
    const spendingPrevMinor = Number((spendingPrevResult.rows[0] as Record<string, unknown> | undefined)?.sum_minor ?? 0);
    const avgCurrentMinor = Number((avgCostCurrentResult.rows[0] as Record<string, unknown> | undefined)?.avg_minor ?? 0);
    const avgPrevMinor = Number((avgCostPrevResult.rows[0] as Record<string, unknown> | undefined)?.avg_minor ?? 0);
    const ytdMinor = Number((ytdResult.rows[0] as Record<string, unknown> | undefined)?.ytd_minor ?? 0);

    const outstandingMinor = Number(outstandingRow.outstanding_minor ?? 0);
    const outstandingCount = Number(outstandingRow.outstanding_count ?? 0);
    const activeWarranties = Number(warrantiesRow.active_count ?? legacyMetrics.active_warranties ?? 0);
    const savedCount = Number(savedRow.saved_count ?? 0);

    let score = 40 + Math.min(activeWarranties * 10, 30) + Math.min(savedCount * 7, 18) + (outstandingCount === 0 ? 12 : 0);
    score = Math.max(0, Math.min(100, Math.round(score)));
    if (score > 93 && activeWarranties < 3) score = 85;
    const protectionStatus: ClientDashboardData["serviceProtection"]["status"] = score >= 85 ? "Excellent" : score >= 65 ? "Good" : "Needs attention";

    const actionCentre: ClientDashboardData["actionCentre"] = [];
    const pendingQuotations = legacyMetrics.pending_quotations ?? 0;
    if (pendingQuotations > 0) {
      const row = actionQuotationsResult.rows[0] as Record<string, unknown> | undefined;
      const category = String(row?.category ?? "Service");
      actionCentre.push({
        id: "quotations",
        title: `Review ${pendingQuotations} quotation${pendingQuotations === 1 ? "" : "s"}`,
        description: `New quotes received for your ${category.toLowerCase()}.`,
        actionLabel: "Review now",
        href: "/client/quotations",
        tone: "purple",
      });
    }
    const invoiceRow = actionInvoicesResult.rows[0] as Record<string, unknown> | undefined;
    if (invoiceRow) {
      actionCentre.push({
        id: String(invoiceRow.id),
        title: `Invoice ${String(invoiceRow.invoiceNumber)} is ready`,
        description: `Total amount ${formatMoney(Number(invoiceRow.totalMinor))}. Payment due.`,
        actionLabel: "View invoice",
        href: `/client/invoices/${String(invoiceRow.id)}`,
        tone: "blue",
      });
    }
    const jobRow = actionJobsResult.rows[0] as Record<string, unknown> | undefined;
    if (jobRow) {
      actionCentre.push({
        id: String(jobRow.id),
        title: `Confirm completion for ${String(jobRow.serviceName).toLowerCase()}`,
        description: `Job #${String(jobRow.id).slice(0, 8).toUpperCase()} is awaiting your confirmation.`,
        actionLabel: "Review job",
        href: `/client/bookings/${String(jobRow.bookingId)}#service-progress`,
        tone: "green",
      });
    }
    const warrantyRow = actionWarrantiesResult.rows[0] as Record<string, unknown> | undefined;
    if (warrantyRow) {
      const endsAt = new Date(String(warrantyRow.endsAt));
      const days = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 86_400_000));
      actionCentre.push({
        id: String(warrantyRow.id),
        title: "Warranty expiring soon",
        description: `${String(warrantyRow.serviceName)} warranty expires in ${days} day${days === 1 ? "" : "s"}.`,
        actionLabel: "View warranty",
        href: `/client/warranties/${String(warrantyRow.id)}`,
        tone: "orange",
      });
    }

    const professionals: ClientDashboardData["professionals"] = professionalsResult.rows.slice(0, 3).map((r) => {
      const row = r as Record<string, unknown>;
      const hundredths = row.avgHundredths as number | null;
      const imagePublicId = row.imagePublicId as string | null;
      return {
        id: String(row.id),
        name: String(row.organisationName),
        specialty: String(row.specialty ?? "Professional"),
        rating: hundredths != null ? Number(hundredths) / 100 : null,
        reviewCount: Number(row.reviewCount ?? 0),
        imageUrl: imagePublicId ? `https://res.cloudinary.com/demo/image/upload/${imagePublicId}` : null,
        organisationSlug: String(row.organisationSlug),
        href: `/professionals/${String(row.organisationSlug)}`,
        verifiedJobs: row.verifiedJobs != null ? Number(row.verifiedJobs) : null,
      };
    });

    const upcomingBookings: ClientDashboardData["upcomingBookings"] = upcomingBookingsResult.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const id = String(row.id);
      return {
        id,
        bookingNumber: `BK-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`,
        professionalName: String(row.professionalName),
        professionalImageUrl: row.professionalImagePublicId ? `https://res.cloudinary.com/demo/image/upload/${String(row.professionalImagePublicId)}` : null,
        serviceName: String(row.serviceName),
        scheduledAt: new Date(String(row.scheduledAt)).toISOString(),
        endsAt: row.endsAt ? new Date(String(row.endsAt as string)).toISOString() : null,
        status: String(row.status),
        href: `/client/bookings/${id}`,
        serviceSlug: row.serviceSlug ? String(row.serviceSlug) : null,
      };
    });

    const recommended: ClientDashboardData["recommended"] = recommendedResult.rows.map((r) => {
      const row = r as Record<string, unknown>;
      const imagePublicId = row.imagePublicId as string | null;
      return {
        id: String(row.id),
        slug: String(row.slug),
        name: String(row.name),
        category: row.category ? String(row.category) : null,
        priceMinor: row.priceMinor != null ? Number(row.priceMinor) : null,
        currency: String(row.currency ?? "KES"),
        imageUrl: imagePublicId ? `https://res.cloudinary.com/demo/image/upload/${imagePublicId}` : null,
        organisationSlug: String(row.organisationSlug),
        organisationName: String(row.organisationName),
        rating: row.ratingHundredths != null ? Number(row.ratingHundredths) / 100 : null,
        reviewCount: Number(row.reviewCount ?? 0),
        href: `/services/${String(row.slug)}`,
      };
    });

    const series = seriesResult.rows.map((r) => {
      const row = r as Record<string, unknown>;
      return { day: String(row.day), value: Number(row.value) };
    });

    const result: ClientDashboardData = {
      metrics: {
        ...legacyMetrics,
        outstanding_payments_minor: outstandingMinor,
        outstanding_payments_count: outstandingCount,
      },
      restrictedMetrics: [],
      recent: recentResult.rows as ClientDashboardData["recent"],
      generatedAt: new Date().toISOString(),
      source: "transactional",
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      summary: {
        openRequests: legacyMetrics.active_requests ?? 0,
        quotesToReview: legacyMetrics.pending_quotations ?? 0,
        upcomingBookings: legacyMetrics.upcoming_bookings ?? 0,
        activeJobs: legacyMetrics.active_jobs ?? 0,
        outstandingPaymentsMinor: outstandingMinor,
        outstandingPaymentsCount: outstandingCount,
        nextBookingAt: nextBookingAtIso,
      },
      serviceProtection: {
        score,
        status: protectionStatus,
        activeWarranties,
        paymentsDue: outstandingCount,
        savedProfessionals: savedCount,
      },
      actionCentre,
      spending: {
        currentMonthMinor: spendingCurrentMinor,
        previousMonthMinor: spendingPrevMinor,
        outstandingMinor,
        outstandingCount,
        upcomingBookings: legacyMetrics.upcoming_bookings ?? 0,
        avgServiceCostMinor: avgCurrentMinor,
        previousAvgServiceCostMinor: avgPrevMinor,
        nextBookingAt: nextBookingAtIso,
        series,
        range: { from: range.from.toISOString(), to: range.to.toISOString() },
      },
      professionals,
      upcomingBookings,
      protectionPayments: {
        totalSpentYtdMinor: ytdMinor,
        outstandingMinor,
        outstandingCount,
        paymentMethodLast4: outstandingCount > 0 ? "4567" : null,
        activeWarranties,
      },
      recommended,
    };
    result.serverTiming = { databaseMs, aggregationMs: performance.now() - aggregationStartedAt };
    return result;
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
