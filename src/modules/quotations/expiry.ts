import type { QuotationsStore } from "./repository";

export const QUOTATION_EXPIRY_BATCH_SIZE = 50;

export class QuotationExpiryService {
  constructor(private readonly store: QuotationsStore) {}

  runScheduledExpiry(now = new Date()) {
    return this.store.expireDue({
      now,
      limit: QUOTATION_EXPIRY_BATCH_SIZE,
    });
  }
}
