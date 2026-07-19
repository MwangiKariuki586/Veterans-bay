import { describe, expect, it } from "vitest";

import { DependencyUnavailableError } from "../../platform/errors/app-error";
import type { SystemRepository } from "./repository";
import { SystemService } from "./service";

describe("SystemService", () => {
  it("maps repository readiness without exposing repository data", async () => {
    const repository: SystemRepository = {
      checkDependencies: async () => ({ available: true }),
    };
    const service = new SystemService(repository);

    await expect(service.getReadiness()).resolves.toEqual({
      service: "veterans-bay-api",
      status: "ready",
    });
  });

  it("turns dependency failure into a typed application error", async () => {
    const repository: SystemRepository = {
      checkDependencies: async () => ({ available: false }),
    };
    const service = new SystemService(repository);

    await expect(service.getReadiness()).rejects.toBeInstanceOf(
      DependencyUnavailableError,
    );
  });
});
