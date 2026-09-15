import { describe, expect, it, vi } from "vitest";

import type { QuotationsStore } from "./repository";
import {
  QUOTATION_EXPIRY_BATCH_SIZE,
  QuotationExpiryService,
} from "./expiry";

describe("QuotationExpiryService", () => {
  it("runs a bounded, repository-authoritative expiry batch", async () => {
    const expireDue = vi.fn().mockResolvedValue({
      expired: 2,
      quotationIds: ["quotation-1", "quotation-2"],
    });
    const store = { expireDue } as unknown as QuotationsStore;
    const now = new Date("2026-08-30T12:00:00.000Z");

    await expect(
      new QuotationExpiryService(store).runScheduledExpiry(now),
    ).resolves.toEqual({
      expired: 2,
      quotationIds: ["quotation-1", "quotation-2"],
    });
    expect(expireDue).toHaveBeenCalledWith({
      now,
      limit: QUOTATION_EXPIRY_BATCH_SIZE,
    });
  });
});
