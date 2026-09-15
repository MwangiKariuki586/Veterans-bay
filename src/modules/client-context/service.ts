import { AppError } from "../../platform/errors/app-error";

import type { ClientContextQuery, ClientContextProfile } from "./types";
import type { ClientContextRepository } from "./repository";

export class ClientContextService {
  constructor(private readonly repository: ClientContextRepository) {}

  async getClientContext(query: ClientContextQuery): Promise<ClientContextProfile> {
    const client = await this.repository.findClientProfile(query.clientAccountId);
    if (!client) {
      throw new AppError({ code: "NOT_FOUND", message: "Client not found.", status: 404 });
    }
    if (client.status === "deactivated") {
      throw new AppError({ code: "NOT_FOUND", message: "Client not found.", status: 404 });
    }

    let hasRelationship = await this.repository.hasLegitimateRelationship(query.organisationId, query.clientAccountId);

    // If team member is assigned-jobs-only, further scope to assigned jobs
    let limitedView = false;
    let limitedReason: string | null = null;

    if (query.assignedJobsOnly && query.membershipId) {
      const hasAssigned = await this.repository.hasAssignedJobRelationship(
        query.organisationId,
        query.clientAccountId,
        query.membershipId,
      );
      if (!hasAssigned) {
        // Check if there's any relationship at all — if so, hide with permission notice
        if (hasRelationship) {
          limitedView = true;
          limitedReason = "You're viewing client information related to assigned jobs only.";
          hasRelationship = false;
        }
      } else {
        limitedView = true;
        limitedReason = "You're viewing client information related to this job.";
      }
    } else if (query.assignedJobsOnly) {
      limitedView = true;
      limitedReason = "You're viewing client information related to assigned jobs only.";
    }

    if (!hasRelationship) {
      if (limitedView && limitedReason) {
        // For assigned-only members with no assigned relationship, return limited tombstone instead of 404
        // but still require a legitimate relationship to show anything.
        throw new AppError({
          code: "NOT_FOUND",
          message: "No permitted relationship found for this client.",
          status: 404,
        });
      }
      throw new AppError({
        code: "NOT_FOUND",
        message: "No permitted relationship found for this client.",
        status: 404,
      });
    }

    const jobs = await this.repository.listJobs(
      query.organisationId,
      query.clientAccountId,
      query.membershipId,
      query.assignedJobsOnly,
    );
    const bookingsCount = await this.repository.countBookings(query.organisationId, query.clientAccountId);
    const quotationsCount = await this.repository.countQuotations(query.organisationId, query.clientAccountId);

    const activeJob =
      jobs.find((j) => !["COMPLETED", "CANCELLED", "DISPUTED"].includes(j.status)) ?? null;
    const completedJobs = jobs.filter((j) => j.status === "COMPLETED");
    const lastCompletedAt =
      completedJobs.length > 0
        ? (completedJobs
            .map((j) => j.completedAt ?? j.createdAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b as Date).getTime() - new Date(a as Date).getTime())[0] as Date | null)
        : null;

    // Job location — only when workflow permits (status >= scheduled/assigned).
    // For now expose if we have an active or completed job with scheduled time.
    let jobLocation: ClientContextProfile["jobLocation"] = null;
    if (activeJob?.scheduledStartsAt || completedJobs[0]?.scheduledStartsAt) {
      const refJob = activeJob ?? completedJobs[0] ?? null;
      if (refJob) {
        const location = await this.repository.findServiceLocationForJob(refJob.id, query.organisationId);
        // Try to enrich with booking address if present — for now use operatingLocation as proxy.
        jobLocation = {
          serviceLocation: location,
          bookingId: null, // enriched if contextType=booking/job supplied
          jobId: refJob.id,
          scheduledStartsAt: refJob.scheduledStartsAt ? new Date(refJob.scheduledStartsAt).toISOString() : null,
        };
      }
    }

    // If explicit contextId provided, override jobLocation with that context
    if (query.contextId && query.contextType === "job") {
      const ctxJob = await this.repository.findContextJob(query.organisationId, query.contextId, query.clientAccountId);
      if (ctxJob) {
        const location = await this.repository.findServiceLocationForJob(ctxJob.id, query.organisationId);
        jobLocation = {
          serviceLocation: location,
          bookingId: ctxJob.bookingId ?? null,
          jobId: ctxJob.id,
          scheduledStartsAt: ctxJob.scheduledStartsAt ? new Date(ctxJob.scheduledStartsAt).toISOString() : null,
        };
      }
    } else if (query.contextId && query.contextType === "booking") {
      const ctxBooking = await this.repository.findContextBooking(query.organisationId, query.contextId, query.clientAccountId);
      if (ctxBooking) {
        jobLocation = {
          serviceLocation: null,
          bookingId: ctxBooking.id,
          jobId: null,
          scheduledStartsAt: ctxBooking.startsAt ? new Date(ctxBooking.startsAt).toISOString() : null,
        };
      }
    }

    const canViewContact = !query.assignedJobsOnly || Boolean(query.membershipId && (await this.repository.hasAssignedJobRelationship(query.organisationId, query.clientAccountId, query.membershipId)));
    // For assigned-only, contact only if assigned; otherwise full contact is permitted
    const canViewLocation = hasRelationship && (query.assignedJobsOnly ? canViewContact : true);

    return {
      client: {
        id: client.id,
        displayName: client.displayName,
        avatarUrl: client.avatarUrl,
        primaryEmail: client.primaryEmail,
        phone: client.phone,
        location: client.location,
        bio: client.bio,
        verified: true,
        memberSince: client.createdAt.toISOString(),
        preferredContactMethod: client.phone ? "phone" : client.primaryEmail ? "email" : null,
      },
      relationship: {
        hasLegitimateRelationship: hasRelationship,
        activeJob: activeJob
          ? {
              id: activeJob.id,
              status: activeJob.status,
              serviceName: activeJob.serviceName,
              scheduledStartsAt: activeJob.scheduledStartsAt
                ? new Date(activeJob.scheduledStartsAt).toISOString()
                : null,
            }
          : null,
        completedJobsCount: completedJobs.length,
        totalJobsCount: jobs.length,
        lastCompletedAt: lastCompletedAt ? new Date(lastCompletedAt).toISOString() : null,
        bookingsCount,
        quotationsCount,
      },
      jobLocation,
      permissions: {
        canViewContact: query.assignedJobsOnly ? canViewContact : true,
        canViewLocation,
        limitedView: query.assignedJobsOnly,
        limitedReason: query.assignedJobsOnly
          ? "You're viewing client information related to this job."
          : null,
      },
    };
  }
}
