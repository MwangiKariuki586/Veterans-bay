import type { ServiceRequestStatus } from "./types";

export const SERVICE_REQUEST_INACTIVITY_DAYS = 30;
export const SERVICE_REQUEST_EXPIRY_BATCH_SIZE = 50;

export const expirableServiceRequestStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "ASSESSMENT_REQUIRED",
] as const satisfies readonly ServiceRequestStatus[];

export function nextServiceRequestExpiry(now: Date): Date {
  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + SERVICE_REQUEST_INACTIVITY_DAYS);
  return expiry;
}

export function statusUsesInactivityExpiry(
  status: ServiceRequestStatus,
): boolean {
  return (expirableServiceRequestStatuses as readonly ServiceRequestStatus[]).includes(
    status,
  );
}
