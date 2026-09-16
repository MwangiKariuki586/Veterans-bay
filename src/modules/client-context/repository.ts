import { and, count, desc, eq } from "drizzle-orm";

import type { Database } from "../../platform/database/client";
import { accountProfiles } from "../../platform/database/schema/account-profiles";
import { bookings } from "../../platform/database/schema/commercial";
import { fileAssets } from "../../platform/database/schema/file-assets";
import { jobs, jobAssignments } from "../../platform/database/schema/fulfilment";
import { customerRecords } from "../../platform/database/schema/customers";
import { quotations } from "../../platform/database/schema/commercial";
import { serviceRequests } from "../../platform/database/schema/service-requests";

export class ClientContextRepository {
  constructor(private readonly db: Database) {}

  async findClientProfile(clientAccountId: string) {
    const [row] = await this.db
      .select({
        profile: accountProfiles,
        avatarPublicId: fileAssets.cloudinaryPublicId,
      })
      .from(accountProfiles)
      .leftJoin(fileAssets, eq(fileAssets.id, accountProfiles.avatarAssetId))
      .where(eq(accountProfiles.id, clientAccountId))
      .limit(1);
    if (!row) return null;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const avatarUrl =
      row.avatarPublicId && cloudName
        ? `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/${row.avatarPublicId.split("/").map(encodeURIComponent).join("/")}`
        : row.avatarPublicId
          ? `https://res.cloudinary.com/image/upload/${row.avatarPublicId}`
          : null;
    return {
      id: row.profile.id,
      displayName: row.profile.displayName,
      primaryEmail: row.profile.primaryEmail,
      phone: row.profile.phone,
      location: row.profile.location,
      bio: row.profile.bio,
      avatarUrl,
      status: row.profile.status,
      createdAt: row.profile.createdAt,
    };
  }

  async hasLegitimateRelationship(organisationId: string, clientAccountId: string): Promise<boolean> {
    const [requestRow] = await this.db
      .select({ count: count() })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.organisationId, organisationId), eq(serviceRequests.clientAccountId, clientAccountId)))
      .limit(1);
    if (requestRow && Number(requestRow.count) > 0) return true;

    const [quotationRow] = await this.db
      .select({ count: count() })
      .from(quotations)
      .where(and(eq(quotations.organisationId, organisationId), eq(quotations.clientAccountId, clientAccountId)))
      .limit(1);
    if (quotationRow && Number(quotationRow.count) > 0) return true;

    const [bookingRow] = await this.db
      .select({ count: count() })
      .from(bookings)
      .where(and(eq(bookings.organisationId, organisationId), eq(bookings.clientAccountId, clientAccountId)))
      .limit(1);
    if (bookingRow && Number(bookingRow.count) > 0) return true;

    const [jobRow] = await this.db
      .select({ count: count() })
      .from(jobs)
      .where(and(eq(jobs.organisationId, organisationId), eq(jobs.clientAccountId, clientAccountId)))
      .limit(1);
    if (jobRow && Number(jobRow.count) > 0) return true;

    const [customerRow] = await this.db
      .select({ count: count() })
      .from(customerRecords)
      .where(and(eq(customerRecords.organisationId, organisationId), eq(customerRecords.accountProfileId, clientAccountId)))
      .limit(1);
    if (customerRow && Number(customerRow.count) > 0) return true;

    return false;
  }

  async hasAssignedJobRelationship(
    organisationId: string,
    clientAccountId: string,
    membershipId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ count: count() })
      .from(jobs)
      .innerJoin(jobAssignments, and(eq(jobAssignments.jobId, jobs.id), eq(jobAssignments.membershipId, membershipId), eq(jobAssignments.active, true)))
      .where(and(eq(jobs.organisationId, organisationId), eq(jobs.clientAccountId, clientAccountId)))
      .limit(1);
    return Boolean(row && Number(row.count) > 0);
  }

  async listJobs(organisationId: string, clientAccountId: string, membershipId: string | null, assignedOnly: boolean) {
    if (assignedOnly && membershipId) {
      return this.db
        .select({
          id: jobs.id,
          status: jobs.status,
          serviceName: jobs.serviceName,
          scheduledStartsAt: jobs.scheduledStartsAt,
          completedAt: jobs.completedAt,
          createdAt: jobs.createdAt,
        })
        .from(jobs)
        .innerJoin(jobAssignments, and(eq(jobAssignments.jobId, jobs.id), eq(jobAssignments.membershipId, membershipId), eq(jobAssignments.active, true)))
        .where(and(eq(jobs.organisationId, organisationId), eq(jobs.clientAccountId, clientAccountId)))
        .orderBy(desc(jobs.createdAt));
    }

    return this.db
      .select({
        id: jobs.id,
        status: jobs.status,
        serviceName: jobs.serviceName,
        scheduledStartsAt: jobs.scheduledStartsAt,
        completedAt: jobs.completedAt,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .where(and(eq(jobs.organisationId, organisationId), eq(jobs.clientAccountId, clientAccountId)))
      .orderBy(desc(jobs.createdAt));
  }

  async countBookings(organisationId: string, clientAccountId: string) {
    const [row] = await this.db
      .select({ count: count() })
      .from(bookings)
      .where(and(eq(bookings.organisationId, organisationId), eq(bookings.clientAccountId, clientAccountId)));
    return Number(row?.count ?? 0);
  }

  async countQuotations(organisationId: string, clientAccountId: string) {
    const [row] = await this.db
      .select({ count: count() })
      .from(quotations)
      .where(and(eq(quotations.organisationId, organisationId), eq(quotations.clientAccountId, clientAccountId)));
    return Number(row?.count ?? 0);
  }

  async findContextJob(organisationId: string, jobId: string, clientAccountId: string) {
    const [row] = await this.db
      .select({
        id: jobs.id,
        status: jobs.status,
        serviceName: jobs.serviceName,
        scheduledStartsAt: jobs.scheduledStartsAt,
        bookingId: jobs.bookingId,
      })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.organisationId, organisationId), eq(jobs.clientAccountId, clientAccountId)))
      .limit(1);
    return row ?? null;
  }

  async findContextBooking(organisationId: string, bookingId: string, clientAccountId: string) {
    const [row] = await this.db
      .select({
        id: bookings.id,
        status: bookings.status,
        scope: bookings.scope,
        startsAt: bookings.startsAt,
      })
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.organisationId, organisationId), eq(bookings.clientAccountId, clientAccountId)))
      .limit(1);
    return row ?? null;
  }

  async findServiceLocationForJob(jobId: string, organisationId: string) {
    const { professionalProfiles } = await import("../../platform/database/schema/professional-onboarding");
    const [row] = await this.db
      .select({ operatingLocation: professionalProfiles.operatingLocation })
      .from(professionalProfiles)
      .where(eq(professionalProfiles.organisationId, organisationId))
      .limit(1);
    return row?.operatingLocation ?? null;
  }
}
