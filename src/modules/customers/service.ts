import { AppError } from "../../platform/errors/app-error";
import type { CustomersRepository } from "./repository";
import type { CustomerOrigin, CustomerStatus } from "./types";

export class CustomersService {
  constructor(private readonly store: CustomersRepository) {}
  list(input: {
    organisationId: string;
    search?: string;
    status?: CustomerStatus;
    page: number;
    pageSize: number;
  }) {
    return this.store.list(input);
  }
  async get(customerId: string, organisationId: string) {
    return required(await this.store.get(customerId, organisationId));
  }
  async create(input: {
    organisationId: string;
    actorAccountId: string;
    displayName: string;
    email?: string;
    phone?: string;
    acquisitionSource: CustomerOrigin;
    correlationId?: string;
  }) {
    return this.get((await this.store.create(input)).id, input.organisationId);
  }
  async addNote(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    body: string;
  }) {
    if (!(await this.store.addNote(input))) throw missing();
    return this.get(input.customerId, input.organisationId);
  }
  async addTag(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    name: string;
    correlationId?: string;
  }) {
    if (!(await this.store.addTag(input))) throw missing();
    return this.get(input.customerId, input.organisationId);
  }
  async invite(input: {
    customerId: string;
    organisationId: string;
    actorAccountId: string;
    correlationId?: string;
  }) {
    if (!(await this.store.invite(input)))
      throw invalid(
        "A registered customer or contact without email cannot be invited.",
      );
    return this.get(input.customerId, input.organisationId);
  }
  async reconcile(input: { customerId: string; organisationId: string }) {
    if (!(await this.store.reconcile(input)))
      throw invalid("No registered account matches this customer's email.");
    return this.get(input.customerId, input.organisationId);
  }
}
function required<T>(value: T | null): T {
  if (!value) throw missing();
  return value;
}
function missing() {
  return new AppError({
    code: "CUSTOMER_NOT_FOUND",
    message: "The customer was not found.",
    status: 404,
  });
}
function invalid(message: string) {
  return new AppError({
    code: "CUSTOMER_ACTION_INVALID",
    message,
    status: 422,
  });
}
