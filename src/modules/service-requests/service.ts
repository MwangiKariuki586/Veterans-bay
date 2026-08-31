import { AppError } from "../../platform/errors/app-error";
import type { PageResult } from "../../platform/http/pagination";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import type {
  ServiceRequestDetailRecord,
  ServiceRequestRecord,
  ServiceRequestsStore,
} from "./repository";
import type {
  ClientServiceRequest,
  ClientRequestBucket,
  ClientRequestSummary,
  ClientRequestSort,
  ProfessionalServiceRequest,
  ServiceRequestOptions,
  ServiceRequestStatus,
  ServiceRequestValues,
} from "./types";

export class ServiceRequestsService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: ServiceRequestsStore,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  async listClient(input: {
    authUserId: string;
    status?: ServiceRequestStatus;
    bucket?: ClientRequestBucket;
    category?: string;
    preferredTime?: string;
    urgency?: ServiceRequestValues["urgency"];
    search?: string;
    sort: ClientRequestSort;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ClientServiceRequest> & { summary: ClientRequestSummary }> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const result = await this.store.listClient({
      clientAccountId: profile.id,
      status: input.status,
      bucket: input.bucket,
      category: input.category,
      preferredTime: input.preferredTime,
      urgency: input.urgency,
      search: input.search,
      sort: input.sort,
      page: input.page,
      pageSize: input.pageSize,
    });
    return { ...result, items: result.items.map(mapRequest) };
  }

  async getClient(
    authUserId: string,
    requestId: string,
  ): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    return mapRequest(
      requireRequest(await this.store.getClient(profile.id, requestId)),
    );
  }

  async getOptions(authUserId: string): Promise<ServiceRequestOptions> {
    await this.identity.requireActiveAccount(authUserId);
    const [categories, professionals] = await Promise.all([
      this.store.listActiveCategories(),
      this.store.listRequestProfessionals(),
    ]);
    return { categories, professionals };
  }

  async createDraft(input: {
    authUserId: string;
    idempotencyKey: string;
    values: ServiceRequestValues;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    if (input.values.source === "PROFESSIONAL_IMPORTED") {
      throw new AppError({
        code: "INVALID_REQUEST_SOURCE",
        message: "Professional-imported requests must be created by a professional.",
        status: 422,
      });
    }
    validateBudget(input.values);
    return mapRequest(
      await this.store.createDraft({
        clientAccountId: profile.id,
        idempotencyKey: input.idempotencyKey,
        values: input.values,
      }),
    );
  }

  async updateDraft(input: {
    authUserId: string;
    requestId: string;
    expectedVersion: number;
    values: Partial<ServiceRequestValues>;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireRequest(
      await this.store.getClient(profile.id, input.requestId),
    );
    if (current.status !== "DRAFT") throw requestLocked();
    if (current.version !== input.expectedVersion) throw staleRequest();
    const merged = { ...current, ...input.values };
    if (merged.source === "PROFESSIONAL_IMPORTED") {
      throw new AppError({
        code: "INVALID_REQUEST_SOURCE",
        message: "Professional-imported requests must be created by a professional.",
        status: 422,
      });
    }
    validateBudget(merged);
    const updated = await this.store.updateDraft({
      clientAccountId: profile.id,
      requestId: input.requestId,
      expectedVersion: input.expectedVersion,
      values: input.values,
    });
    if (!updated) throw staleRequest();
    return mapRequest(updated);
  }

  async submit(input: {
    authUserId: string;
    requestId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireRequest(
      await this.store.getClient(profile.id, input.requestId),
    );
    if (current.status === "SUBMITTED") return mapRequest(current);
    if (current.status !== "DRAFT") throw requestLocked();
    if (current.version !== input.expectedVersion) throw staleRequest();
    await this.validateSubmission(current);
    const submitted = await this.store.submit({
      clientAccountId: profile.id,
      requestId: input.requestId,
      actorAccountId: profile.id,
      expectedVersion: input.expectedVersion,
      correlationId: input.correlationId,
    });
    if (!submitted) throw staleRequest();
    return mapRequest(submitted);
  }

  async attachAsset(input: {
    authUserId: string;
    requestId: string;
    assetId: string;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const result = await this.store.attachAsset({
      clientAccountId: profile.id,
      requestId: input.requestId,
      assetId: input.assetId,
    });
    if (!result) {
      throw new AppError({
        code: "REQUEST_ATTACHMENT_NOT_ELIGIBLE",
        message: "The attachment is not eligible for this request.",
        status: 422,
      });
    }
    return mapRequest(result);
  }

  async cancel(input: {
    authUserId: string;
    requestId: string;
    expectedVersion: number;
    correlationId?: string;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireRequest(
      await this.store.getClient(profile.id, input.requestId),
    );
    if (
      ![
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "MORE_INFORMATION_REQUIRED",
        "ASSESSMENT_REQUIRED",
      ].includes(current.status)
    ) {
      throw requestLocked();
    }
    if (current.version !== input.expectedVersion) throw staleRequest();
    const result = await this.store.cancel({
      clientAccountId: profile.id,
      requestId: input.requestId,
      actorAccountId: profile.id,
      expectedVersion: input.expectedVersion,
      correlationId: input.correlationId,
    });
    if (!result) throw staleRequest();
    return mapRequest(result);
  }

  async addInformation(input: {
    authUserId: string;
    requestId: string;
    expectedVersion: number;
    note: string;
    correlationId?: string;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const current = requireRequest(
      await this.store.getClient(profile.id, input.requestId),
    );
    if (current.status !== "MORE_INFORMATION_REQUIRED") throw requestLocked();
    if (current.version !== input.expectedVersion) throw staleRequest();
    const result = await this.store.addInformation({
      clientAccountId: profile.id,
      requestId: input.requestId,
      actorAccountId: profile.id,
      expectedVersion: input.expectedVersion,
      note: input.note,
      correlationId: input.correlationId,
    });
    if (!result) throw staleRequest();
    return mapRequest(result);
  }

  async listProfessional(input: {
    organisationId: string;
    status?: ServiceRequestStatus;
    page: number;
    pageSize: number;
  }): Promise<PageResult<ClientServiceRequest>> {
    const result = await this.store.listProfessional(input);
    return { ...result, items: result.items.map(mapRequest) };
  }

  async getProfessional(
    organisationId: string,
    requestId: string,
  ): Promise<ProfessionalServiceRequest> {
    const request = await this.store.getProfessional(organisationId, requestId);
    if (!request) throw requestNotFound();
    return mapProfessionalRequest(request);
  }

  async professionalTransition(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    expectedVersion: number;
    action: "review" | "request-information" | "request-assessment" | "decline";
    note?: string;
    correlationId?: string;
  }): Promise<ProfessionalServiceRequest> {
    const current = await this.store.getProfessional(
      input.organisationId,
      input.requestId,
    );
    if (!current) throw requestNotFound();
    if (current.version !== input.expectedVersion) throw staleRequest();
    const transition = professionalTransitions[input.action];
    if (
      !(transition.from as readonly ServiceRequestStatus[]).includes(
        current.status,
      )
    ) {
      throw requestLocked();
    }
    if (transition.noteRequired && !input.note) {
      throw new AppError({
        code: "REQUEST_NOTE_REQUIRED",
        message: "Add a client-visible reason before continuing.",
        status: 422,
        issues: [{ code: "required", path: "note" }],
      });
    }
    const updated = await this.store.professionalTransition({
      organisationId: input.organisationId,
      requestId: input.requestId,
      actorAccountId: input.actorAccountId,
      expectedVersion: input.expectedVersion,
      fromStatuses: [...transition.from],
      toStatus: transition.to,
      action: transition.action,
      note: input.note,
      eventType: transition.eventType,
      correlationId: input.correlationId,
    });
    if (!updated) throw staleRequest();
    return mapProfessionalRequest(updated);
  }

  async addPrivateNote(input: {
    organisationId: string;
    requestId: string;
    actorAccountId: string;
    note: string;
  }): Promise<ProfessionalServiceRequest> {
    const result = await this.store.addPrivateNote(input);
    if (!result) throw requestNotFound();
    return mapProfessionalRequest(result);
  }

  async removeAsset(input: {
    authUserId: string;
    requestId: string;
    attachmentId: string;
  }): Promise<ClientServiceRequest> {
    const { profile } = await this.identity.requireActiveAccount(input.authUserId);
    const result = await this.store.removeAsset({
      clientAccountId: profile.id,
      requestId: input.requestId,
      attachmentId: input.attachmentId,
    });
    if (!result) throw requestLocked();
    return mapRequest(result);
  }

  private async validateSubmission(request: ServiceRequestRecord) {
    const missing: string[] = [];
    if (!request.category) missing.push("category");
    if (!request.description || request.description.length < 20) {
      missing.push("description");
    }
    if (!request.location) missing.push("location");
    if (!request.preferredTime) missing.push("preferredTime");
    if (!request.urgency) missing.push("urgency");
    if (!request.contactPreference) missing.push("contactPreference");
    if (!request.organisationId) {
      missing.push("preferredProfessional");
    }
    if (
      request.source === "DIRECT_SERVICE_PAGE" &&
      !request.preferredServiceId
    ) {
      missing.push("preferredService");
    }
    if (
      request.category &&
      !(await this.store.categoryIsActive(request.category))
    ) {
      missing.push("category");
    }
    if (missing.length > 0) {
      throw new AppError({
        code: "REQUEST_NOT_READY",
        message: "Complete the required request details before submitting.",
        status: 422,
        issues: [...new Set(missing)].map((path) => ({
          code: "required",
          path,
        })),
      });
    }
  }
}

function mapRequest(
  record: ServiceRequestRecord | ServiceRequestDetailRecord,
): ClientServiceRequest {
  return {
    ...record,
    submittedAt: record.submittedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    history:
      "history" in record
        ? record.history.map((item) => ({
            id: item.id,
            action: item.action,
            fromStatus: item.fromStatus,
            toStatus: item.toStatus,
            note: item.note,
            createdAt: item.createdAt.toISOString(),
          }))
        : [],
    attachments:
      "attachments" in record
        ? record.attachments.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString(),
          }))
        : [],
  };
}

function mapProfessionalRequest(
  record: import("./repository").ProfessionalRequestDetailRecord,
): ProfessionalServiceRequest {
  const client = mapRequest(record);
  return {
    ...client,
    client: {
      displayName: record.clientDisplayName,
      primaryEmail: record.clientPrimaryEmail,
      phone: record.clientPhone,
    },
    conversionEligible: ["UNDER_REVIEW", "ASSESSMENT_REQUIRED"].includes(
      record.status,
    ),
    history: record.history.map((item) => ({
      id: item.id,
      action: item.action,
      fromStatus: item.fromStatus,
      toStatus: item.toStatus,
      note: item.note,
      privateProfessionalNote: item.privateProfessionalNote,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

function requireRequest(
  request: ServiceRequestDetailRecord | null,
): ServiceRequestDetailRecord {
  if (!request) {
    throw new AppError({
      code: "REQUEST_NOT_FOUND",
      message: "The requested service request was not found.",
      status: 404,
    });
  }
  return request;
}

function requestNotFound() {
  return new AppError({
    code: "REQUEST_NOT_FOUND",
    message: "The requested service request was not found.",
    status: 404,
  });
}

function validateBudget(values: {
  budgetMinMinor?: number | null;
  budgetMaxMinor?: number | null;
}) {
  if (
    values.budgetMinMinor != null &&
    values.budgetMaxMinor != null &&
    values.budgetMinMinor > values.budgetMaxMinor
  ) {
    throw new AppError({
      code: "INVALID_BUDGET_RANGE",
      message: "The maximum budget must be greater than the minimum budget.",
      status: 422,
    });
  }
}

function staleRequest() {
  return new AppError({
    code: "REQUEST_STALE",
    message: "This request changed elsewhere. Refresh and try again.",
    status: 409,
  });
}

function requestLocked() {
  return new AppError({
    code: "REQUEST_LOCKED",
    message: "Only draft requests can be changed.",
    status: 409,
  });
}

const professionalTransitions = {
  review: {
    from: ["SUBMITTED"] as const,
    to: "UNDER_REVIEW" as const,
    action: "REVIEW_STARTED",
    eventType: "service_request.updated",
    noteRequired: false,
  },
  "request-information": {
    from: ["SUBMITTED", "UNDER_REVIEW", "ASSESSMENT_REQUIRED"] as const,
    to: "MORE_INFORMATION_REQUIRED" as const,
    action: "INFORMATION_REQUESTED",
    eventType: "service_request.information_requested",
    noteRequired: true,
  },
  "request-assessment": {
    from: ["SUBMITTED", "UNDER_REVIEW"] as const,
    to: "ASSESSMENT_REQUIRED" as const,
    action: "ASSESSMENT_REQUESTED",
    eventType: "service_request.updated",
    noteRequired: true,
  },
  decline: {
    from: [
      "SUBMITTED",
      "UNDER_REVIEW",
      "MORE_INFORMATION_REQUIRED",
      "ASSESSMENT_REQUIRED",
    ] as const,
    to: "DECLINED" as const,
    action: "DECLINED",
    eventType: "service_request.declined",
    noteRequired: true,
  },
};
