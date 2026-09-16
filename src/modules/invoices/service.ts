import { AppError } from "../../platform/errors/app-error";
import type { IdentityStore } from "../identity/repository";
import { IdentityService } from "../identity/service";
import {
  InvoicesRepository,
  type ProfessionalInvoiceScope,
} from "./repository";
import type {
  InvoiceBucket,
  InvoiceDetail,
  InvoicePage,
  InvoiceSort,
  InvoiceStatus,
  PaymentMethod,
} from "./types";

export class InvoicesService {
  private readonly identity: IdentityService;

  constructor(
    private readonly store: InvoicesRepository,
    identityStore: IdentityStore,
  ) {
    this.identity = new IdentityService(identityStore);
  }

  listProfessional(input: {
    scope: ProfessionalInvoiceScope;
    status?: InvoiceStatus;
    bucket?: InvoiceBucket;
    search?: string;
    sort?: InvoiceSort;
    page: number;
    pageSize: number;
  }): Promise<InvoicePage> {
    return this.store.listProfessional(input);
  }

  async listClient(input: {
    authUserId: string;
    status?: InvoiceStatus;
    bucket?: InvoiceBucket;
    search?: string;
    sort?: InvoiceSort;
    page: number;
    pageSize: number;
  }): Promise<InvoicePage> {
    const account = await this.activeAccount(input.authUserId);
    return this.store.listClient({
      clientAccountId: account.id,
      status: input.status,
      bucket: input.bucket,
      search: input.search,
      sort: input.sort,
      page: input.page,
      pageSize: input.pageSize,
    });
  }

  async getProfessional(
    invoiceId: string,
    organisationId: string,
  ): Promise<InvoiceDetail> {
    return requireInvoice(
      await this.store.getProfessional(invoiceId, organisationId),
    );
  }

  async getClient(
    authUserId: string,
    invoiceId: string,
  ): Promise<InvoiceDetail> {
    const account = await this.activeAccount(authUserId);
    return requireInvoice(await this.store.getClient(invoiceId, account.id));
  }

  async createFromJob(input: {
    jobId: string;
    organisationId: string;
    actorAccountId: string;
    correlationId?: string;
  }) {
    const invoiceId = await this.store.createFromJob(input);
    if (!invoiceId) {
      throw invalidFinancialRecord(
        "Only completed organisation jobs can be invoiced.",
      );
    }
    return this.getProfessional(invoiceId, input.organisationId);
  }

  async issue(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    lockVersion: number;
    dueAt: string;
    correlationId?: string;
  }) {
    const dueAt = new Date(input.dueAt);
    if (dueAt <= new Date()) {
      throw invalidFinancialRecord("The invoice due date must be in the future.");
    }
    if (
      !(await this.store.issue({
        ...input,
        expectedLockVersion: input.lockVersion,
        dueAt,
      }))
    ) {
      throw staleFinancialRecord();
    }
    return this.getProfessional(input.invoiceId, input.organisationId);
  }

  async cancel(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    lockVersion: number;
    reason: string;
    correlationId?: string;
  }) {
    if (
      !(await this.store.cancel({
        ...input,
        expectedLockVersion: input.lockVersion,
      }))
    ) {
      throw invalidFinancialRecord(
        "The invoice cannot be cancelled after payment or from its current state.",
      );
    }
    return this.getProfessional(input.invoiceId, input.organisationId);
  }

  async recordPayment(input: {
    invoiceId: string;
    organisationId: string;
    actorAccountId: string;
    idempotencyKey: string;
    amountMinor: number;
    currency: string;
    method: PaymentMethod;
    transactionReference?: string;
    notes?: string;
    evidenceAssetId?: string;
    paidAt: string;
    allocations: { invoiceItemId: string; amountMinor: number }[];
    correlationId?: string;
  }) {
    const result = await this.store.recordPayment({
      ...input,
      paidAt: validRecordedDate(input.paidAt),
    });
    if (!result) {
      throw invalidFinancialRecord(
        "The payment currency, evidence, amount, or allocation is not valid for this invoice.",
      );
    }
    return this.getProfessional(result.invoiceId, input.organisationId);
  }

  async adjustPayment(input: {
    paymentId: string;
    organisationId: string;
    actorAccountId: string;
    idempotencyKey: string;
    adjustmentType: "REVERSAL" | "REFUND";
    amountMinor: number;
    reason: string;
    transactionReference?: string;
    evidenceAssetId?: string;
    recordedAt: string;
    correlationId?: string;
  }) {
    const result = await this.store.adjustPayment({
      ...input,
      recordedAt: validRecordedDate(input.recordedAt),
    });
    if (!result) {
      throw invalidFinancialRecord(
        "The reversal or refund exceeds the remaining recorded allocation, or its evidence is invalid.",
      );
    }
    return this.getProfessional(result.invoiceId, input.organisationId);
  }

  listPayments(input: {
    organisationId: string;
    page: number;
    pageSize: number;
  }) {
    return this.store.listPayments(input);
  }

  private async activeAccount(authUserId: string) {
    const { profile } = await this.identity.requireActiveAccount(authUserId);
    return profile;
  }
}

function requireInvoice(invoice: InvoiceDetail | null) {
  if (!invoice) {
    throw new AppError({
      code: "INVOICE_NOT_FOUND",
      message: "The invoice was not found.",
      status: 404,
    });
  }
  return invoice;
}

function validRecordedDate(value: string) {
  const date = new Date(value);
  if (date > new Date(Date.now() + 5 * 60 * 1000)) {
    throw invalidFinancialRecord("The recorded date cannot be in the future.");
  }
  return date;
}

function invalidFinancialRecord(message: string) {
  return new AppError({
    code: "INVALID_FINANCIAL_RECORD",
    message,
    status: 422,
  });
}

function staleFinancialRecord() {
  return new AppError({
    code: "STALE_FINANCIAL_RECORD",
    message: "The invoice changed. Refresh it before trying again.",
    status: 409,
  });
}
