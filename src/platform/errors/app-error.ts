export interface ValidationIssue {
  code: string;
  path: string;
}

interface AppErrorOptions {
  cause?: unknown;
  code: string;
  issues?: ValidationIssue[];
  message: string;
  status: number;
}

export class AppError extends Error {
  readonly code: string;
  readonly issues?: ValidationIssue[];
  readonly status: number;

  constructor({ cause, code, issues, message, status }: AppErrorOptions) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.issues = issues;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(issues: ValidationIssue[], cause?: unknown) {
    super({
      cause,
      code: "VALIDATION_ERROR",
      issues,
      message: "The request is invalid.",
      status: 422,
    });
    this.name = "ValidationError";
  }
}

export class DependencyUnavailableError extends AppError {
  constructor() {
    super({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "A required service is unavailable.",
      status: 503,
    });
    this.name = "DependencyUnavailableError";
  }
}

export class RateLimitExceededError extends AppError {
  constructor() {
    super({
      code: "RATE_LIMITED",
      message: "Too many requests. Try again later.",
      status: 429,
    });
    this.name = "RateLimitExceededError";
  }
}

export class StaleConflictError extends AppError {
  constructor(
    message = "This record changed since you loaded it. Refresh and try again.",
  ) {
    super({
      code: "STALE_CONFLICT",
      message,
      status: 409,
    });
    this.name = "StaleConflictError";
  }
}
