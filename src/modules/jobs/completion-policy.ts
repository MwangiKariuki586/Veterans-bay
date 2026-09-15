/**
 * Automatic completion is intentionally disabled until a client-visible policy
 * and approval are recorded. Cron may call this policy safely; it will perform
 * no completion work while disabled.
 */
export const jobCompletionPolicy = {
  automaticCompletionEnabled: false,
  reviewPeriodHours: 72,
  policyVersion: null,
} as const;

export class JobCompletionScheduledService {
  async run(): Promise<{
    enabled: boolean;
    completed: number;
    policyVersion: string | null;
  }> {
    if (
      !jobCompletionPolicy.automaticCompletionEnabled ||
      !jobCompletionPolicy.policyVersion
    ) {
      return { enabled: false, completed: 0, policyVersion: null };
    }

    // Enabling this branch requires an approved, disclosed policy plus the
    // transactionally idempotent completion implementation.
    return {
      enabled: true,
      completed: 0,
      policyVersion: jobCompletionPolicy.policyVersion,
    };
  }
}
