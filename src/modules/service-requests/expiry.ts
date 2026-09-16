import { SERVICE_REQUEST_EXPIRY_BATCH_SIZE } from "./expiry-policy";
import type { ServiceRequestsStore } from "./repository";

export class ServiceRequestExpiryService {
  constructor(private readonly store: ServiceRequestsStore) {}

  runScheduledExpiry(now = new Date()): Promise<{
    expired: number;
    requestIds: string[];
  }> {
    return this.store.expireDue({
      now,
      limit: SERVICE_REQUEST_EXPIRY_BATCH_SIZE,
    });
  }
}
