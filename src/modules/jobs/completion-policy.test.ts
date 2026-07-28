import { describe, expect, it } from "vitest";

import {
  JobCompletionScheduledService,
  jobCompletionPolicy,
} from "./completion-policy";

describe("job automatic completion policy", () => {
  it("remains repeat-safe and disabled until an approved visible policy exists", async () => {
    expect(jobCompletionPolicy.automaticCompletionEnabled).toBe(false);
    const service = new JobCompletionScheduledService();
    await expect(service.run()).resolves.toEqual({
      enabled: false,
      completed: 0,
      policyVersion: null,
    });
    await expect(service.run()).resolves.toEqual({
      enabled: false,
      completed: 0,
      policyVersion: null,
    });
  });
});
