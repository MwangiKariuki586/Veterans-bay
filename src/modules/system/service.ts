import { DependencyUnavailableError } from "../../platform/errors/app-error";

import type { SystemRepository } from "./repository";
import type { HealthStatus, ReadinessStatus } from "./types";

export class SystemService {
  constructor(private readonly repository: SystemRepository) {}

  getHealth(): HealthStatus {
    return {
      service: "veterans-bay-api",
      status: "ok",
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const dependencyStatus = await this.repository.checkDependencies();

    if (!dependencyStatus.available) {
      throw new DependencyUnavailableError();
    }

    return {
      service: "veterans-bay-api",
      status: "ready",
    };
  }

  probe(value: string): { value: string } {
    return { value };
  }
}
