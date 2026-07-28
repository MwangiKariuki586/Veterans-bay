import { AppError } from "../../platform/errors/app-error";
import type { PageResult } from "../../platform/http/pagination";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import { calculateQuotationTotals } from "./calculations";
import type { QuotationsStore } from "./repository";
import type {
  QuotationComparison,
  QuotationDetail,
  QuotationDraftValues,
  QuotationStatus,
  QuotationSummary,
} from "./types";

export class QuotationsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: QuotationsStore,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  listProfessional(input: {
    organisationId: string;
    status?: QuotationStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary>> {
    return this.store.listProfessional(input);
  }

  async listClient(input: {
    authUserId: string;
    status?: QuotationStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<QuotationSummary>> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    return this.store.listClient({
      clientAccountId: profile.id,
      status: input.status,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async getProfessional(
    organisationId: string,
    quotationId: string,
  ): Promise<QuotationDetail> {
    return requireQuotation(
      await this.store.getProfessional(organisationId, quotationId),
    );
  }

  async getClient(input: {
    authUserId: string;
    quotationId: string;
    correlationId?: string;
  }): Promise<QuotationDetail> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireQuotation(
      await this.store.getClient(profile.id, input.quotationId),
    );
    if (current.status !== "SUBMITTED") return current;
    return requireQuotation(
      await this.store.markViewed({
        clientAccountId: profile.id,
        quotationId: input.quotationId,
        correlationId: input.correlationId,
      }),
    );
  }

  async createDraft(input: {
    organisationId: string;
    actorAccountId: string;
    requestId: string;
    values: QuotationDraftValues;
  }): Promise<QuotationDetail> {
    validateDraftDates(input.values);
    const quotation = await this.store.createDraft({
      organisationId: input.organisationId,
      actorAccountId: input.actorAccountId,
      requestId: input.requestId,
      mutation: {
        values: input.values,
        totals: calculateTotals(input.values),
      },
    });
    if (!quotation) {
      throw new AppError({
        code: "QUOTATION_REQUEST_NOT_ELIGIBLE",
        message:
          "This request cannot receive a quotation or already has one.",
        status: 409,
      });
    }
    return quotation;
  }

  async updateDraft(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    values: QuotationDraftValues;
  }): Promise<QuotationDetail> {
    validateDraftDates(input.values);
    const current = requireQuotation(
      await this.store.getProfessional(
        input.organisationId,
        input.quotationId,
      ),
    );
    if (current.status !== "DRAFT") throw quotationLocked();
    if (current.lockVersion !== input.expectedLockVersion) throw staleQuotation();
    const quotation = await this.store.updateDraft({
      ...input,
      mutation: {
        values: input.values,
        totals: calculateTotals(input.values),
      },
    });
    if (!quotation) throw staleQuotation();
    return quotation;
  }

  async submit(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail> {
    const current = requireQuotation(
      await this.store.getProfessional(
        input.organisationId,
        input.quotationId,
      ),
    );
    if (current.status !== "DRAFT") throw quotationLocked();
    if (current.lockVersion !== input.expectedLockVersion) throw staleQuotation();
    const version = currentVersion(current);
    if (!version.validUntil || new Date(version.validUntil) <= new Date()) {
      throw new AppError({
        code: "QUOTATION_VALIDITY_REQUIRED",
        message: "Set a future quotation validity date before submitting.",
        status: 422,
        issues: [{ code: "invalid", path: "validUntil" }],
      });
    }
    const quotation = await this.store.submit(input);
    if (!quotation) throw staleQuotation();
    return quotation;
  }

  async createRevision(input: {
    organisationId: string;
    actorAccountId: string;
    quotationId: string;
    expectedLockVersion: number;
    values: QuotationDraftValues;
  }): Promise<QuotationDetail> {
    validateDraftDates(input.values);
    const current = requireQuotation(
      await this.store.getProfessional(
        input.organisationId,
        input.quotationId,
      ),
    );
    if (
      !["SUBMITTED", "VIEWED", "REVISION_REQUESTED", "EXPIRED"].includes(
        current.status,
      )
    ) {
      throw quotationLocked();
    }
    if (current.lockVersion !== input.expectedLockVersion) throw staleQuotation();
    const quotation = await this.store.createRevision({
      ...input,
      mutation: {
        values: input.values,
        totals: calculateTotals(input.values),
      },
    });
    if (!quotation) throw staleQuotation();
    return quotation;
  }

  async clientRespond(input: {
    authUserId: string;
    quotationId: string;
    expectedLockVersion: number;
    action: "DECLINED" | "REVISION_REQUESTED";
    note?: string;
    correlationId?: string;
  }): Promise<QuotationDetail> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireQuotation(
      await this.store.getClient(profile.id, input.quotationId),
    );
    requireCurrentClientAction(current, input.expectedLockVersion);
    if (input.action === "REVISION_REQUESTED" && !input.note) {
      throw new AppError({
        code: "QUOTATION_REVISION_NOTE_REQUIRED",
        message: "Explain what should change in the revised quotation.",
        status: 422,
        issues: [{ code: "required", path: "note" }],
      });
    }
    const quotation = await this.store.clientRespond({
      clientAccountId: profile.id,
      quotationId: input.quotationId,
      expectedLockVersion: input.expectedLockVersion,
      action: input.action,
      note: input.note,
      correlationId: input.correlationId,
    });
    if (!quotation) throw staleQuotation();
    return quotation;
  }

  async accept(input: {
    authUserId: string;
    quotationId: string;
    expectedLockVersion: number;
    correlationId?: string;
  }): Promise<QuotationDetail> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireQuotation(
      await this.store.getClient(profile.id, input.quotationId),
    );
    if (current.status === "ACCEPTED") return current;
    requireCurrentClientAction(current, input.expectedLockVersion);
    const version = currentVersion(current);
    if (!version.validUntil || new Date(version.validUntil) <= new Date()) {
      throw new AppError({
        code: "QUOTATION_EXPIRED",
        message: "This quotation has expired and cannot be accepted.",
        status: 409,
      });
    }
    const quotation = await this.store.accept({
      clientAccountId: profile.id,
      quotationId: input.quotationId,
      expectedLockVersion: input.expectedLockVersion,
      correlationId: input.correlationId,
    });
    if (!quotation) throw staleQuotation();
    return quotation;
  }

  async compareProfessional(input: {
    organisationId: string;
    quotationId: string;
    fromVersion: number;
    toVersion: number;
  }): Promise<QuotationComparison> {
    return compareVersions(
      await this.getProfessional(input.organisationId, input.quotationId),
      input.fromVersion,
      input.toVersion,
    );
  }

  async compareClient(input: {
    authUserId: string;
    quotationId: string;
    fromVersion: number;
    toVersion: number;
  }): Promise<QuotationComparison> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    return compareVersions(
      requireQuotation(
        await this.store.getClient(profile.id, input.quotationId),
      ),
      input.fromVersion,
      input.toVersion,
    );
  }
}

function validateDraftDates(values: QuotationDraftValues) {
  if (new Date(values.validUntil) <= new Date()) {
    throw new AppError({
      code: "QUOTATION_VALIDITY_INVALID",
      message: "Quotation validity must be in the future.",
      status: 422,
      issues: [{ code: "invalid", path: "validUntil" }],
    });
  }
}

function calculateTotals(values: QuotationDraftValues) {
  try {
    return calculateQuotationTotals(values);
  } catch {
    throw new AppError({
      code: "QUOTATION_TOTALS_INVALID",
      message: "The quotation amounts are inconsistent or out of range.",
      status: 422,
    });
  }
}

function requireQuotation(
  quotation: QuotationDetail | null,
): QuotationDetail {
  if (!quotation) {
    throw new AppError({
      code: "QUOTATION_NOT_FOUND",
      message: "The requested quotation was not found.",
      status: 404,
    });
  }
  return quotation;
}

function currentVersion(quotation: QuotationDetail) {
  const version = quotation.versions.find(
    (item) => item.versionNumber === quotation.currentVersionNumber,
  );
  if (!version) {
    throw new Error("Quotation current-version invariant violated.");
  }
  return version;
}

function requireCurrentClientAction(
  quotation: QuotationDetail,
  expectedLockVersion: number,
) {
  if (!["SUBMITTED", "VIEWED"].includes(quotation.status)) {
    throw quotationLocked();
  }
  if (quotation.lockVersion !== expectedLockVersion) throw staleQuotation();
}

function compareVersions(
  quotation: QuotationDetail,
  fromVersion: number,
  toVersion: number,
): QuotationComparison {
  const from = quotation.versions.find(
    (item) => item.versionNumber === fromVersion,
  );
  const to = quotation.versions.find((item) => item.versionNumber === toVersion);
  if (!from || !to || fromVersion === toVersion) {
    throw new AppError({
      code: "QUOTATION_COMPARISON_INVALID",
      message: "Choose two available quotation versions to compare.",
      status: 422,
    });
  }
  return {
    from,
    to,
    totalDifferenceMinor: to.totalMinor - from.totalMinor,
    depositDifferenceMinor: to.depositMinor - from.depositMinor,
    durationDifferenceMinutes:
      to.expectedDurationMinutes - from.expectedDurationMinutes,
  };
}

function staleQuotation() {
  return new AppError({
    code: "QUOTATION_STALE",
    message: "This quotation changed. Refresh it before continuing.",
    status: 409,
  });
}

function quotationLocked() {
  return new AppError({
    code: "QUOTATION_LOCKED",
    message: "This quotation is not eligible for that action.",
    status: 409,
  });
}
