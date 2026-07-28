import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import type { ReviewsRepository } from "./repository";

export class ReviewsService {
  private readonly identity: IdentityService;
  constructor(
    private readonly store: ReviewsRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }
  private async account(authUserId: string) {
    return (await this.identity.requireActiveAccount(authUserId)).profile;
  }
  async eligibility(authUserId: string, jobId: string) {
    return this.store.eligibility(jobId, (await this.account(authUserId)).id);
  }
  async submit(input: {
    authUserId: string;
    jobId: string;
    correlationId?: string;
    overallRating: number;
    serviceQualityRating: number;
    communicationRating: number;
    timelinessRating: number;
    professionalismRating: number;
    valueRating: number;
    feedback: string;
  }) {
    const account = await this.account(input.authUserId);
    const id = await this.store.submit({
      ...input,
      clientAccountId: account.id,
    });
    if (!id)
      throw reviewError(
        "REVIEW_NOT_ELIGIBLE",
        "This job is not eligible for another review.",
        422,
      );
    return this.store.eligibility(input.jobId, account.id);
  }
  listProfessional(organisationId: string) {
    return this.store.listProfessional(organisationId);
  }
  async respond(input: {
    reviewId: string;
    organisationId: string;
    actorAccountId: string;
    body: string;
    correlationId?: string;
  }) {
    if (
      !(await this.store.respond(
        input.reviewId,
        input.organisationId,
        input.actorAccountId,
        input.body,
        input.correlationId,
      ))
    )
      throw reviewError(
        "REVIEW_RESPONSE_UNAVAILABLE",
        "This review is unavailable or already has a response.",
        409,
      );
    return this.store.listProfessional(input.organisationId);
  }
  async report(input: {
    authUserId: string;
    reviewId: string;
    reason: string;
    details?: string;
    correlationId?: string;
  }) {
    const account = await this.account(input.authUserId);
    if (
      !(await this.store.report(
        input.reviewId,
        account.id,
        input.reason,
        input.details,
        input.correlationId,
      ))
    )
      throw reviewError(
        "REVIEW_REPORT_UNAVAILABLE",
        "This review cannot be reported again.",
        409,
      );
    return { reported: true };
  }
  async reportProfessional(input: {
    reviewId: string;
    organisationId: string;
    actorAccountId: string;
    reason: string;
    details?: string;
    correlationId?: string;
  }) {
    if (
      !(await this.store.reportProfessional(
        input.reviewId,
        input.organisationId,
        input.actorAccountId,
        input.reason,
        input.details,
        input.correlationId,
      ))
    )
      throw reviewError(
        "REVIEW_REPORT_UNAVAILABLE",
        "This review cannot be reported again.",
        409,
      );
    return this.store.listProfessional(input.organisationId);
  }
}

function reviewError(code: string, message: string, status: number) {
  return new AppError({ code, message, status });
}
