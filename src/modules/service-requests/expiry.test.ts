import { describe, expect, it, vi } from "vitest";

import {
  SERVICE_REQUEST_EXPIRY_BATCH_SIZE,
  nextServiceRequestExpiry,
  statusUsesInactivityExpiry,
} from "./expiry-policy";
import { ServiceRequestExpiryService } from "./expiry";
import type { ServiceRequestsStore } from "./repository";

describe("service request expiry", () => {
  it("uses a 30-day UTC inactivity window only for active pre-quotation states", () => {
    const now = new Date("2026-07-27T22:30:00.000Z");

    expect(nextServiceRequestExpiry(now).toISOString()).toBe(
      "2026-08-26T22:30:00.000Z",
    );
    expect(statusUsesInactivityExpiry("SUBMITTED")).toBe(true);
    expect(statusUsesInactivityExpiry("ASSESSMENT_REQUIRED")).toBe(true);
    expect(statusUsesInactivityExpiry("DRAFT")).toBe(false);
    expect(statusUsesInactivityExpiry("QUOTED")).toBe(false);
    expect(statusUsesInactivityExpiry("CANCELLED")).toBe(false);
  });

  it("delegates scheduled expiry with a bounded batch", async () => {
    const now = new Date("2026-08-27T00:00:00.000Z");
    const expireDue = vi.fn().mockResolvedValue({
      expired: 1,
      requestIds: ["00000000-0000-4000-8000-000000000010"],
    });
    const service = new ServiceRequestExpiryService({
      expireDue,
    } as unknown as ServiceRequestsStore);

    await expect(service.runScheduledExpiry(now)).resolves.toEqual({
      expired: 1,
      requestIds: ["00000000-0000-4000-8000-000000000010"],
    });
    expect(expireDue).toHaveBeenCalledWith({
      now,
      limit: SERVICE_REQUEST_EXPIRY_BATCH_SIZE,
    });
  });
});
