import { AppError } from "../errors/app-error";
import { hasPermission, type PermissionKey } from "./keys";

export class UnauthorizedError extends AppError {
  constructor() {
    super({
      code: "UNAUTHORIZED",
      message: "Authentication is required.",
      status: 401,
    });
    this.name = "UnauthorizedError";
  }
}

export class PermissionDeniedError extends AppError {
  constructor() {
    super({
      code: "PERMISSION_DENIED",
      message: "You do not have permission to perform this action.",
      status: 403,
    });
    this.name = "PermissionDeniedError";
  }
}

export class WorkspaceUnavailableError extends AppError {
  constructor() {
    super({
      code: "WORKSPACE_UNAVAILABLE",
      message: "The requested workspace is not available.",
      status: 403,
    });
    this.name = "WorkspaceUnavailableError";
  }
}

export function assertPermission(
  granted: readonly string[],
  required: PermissionKey | PermissionKey[],
): void {
  if (!hasPermission(granted, required)) {
    throw new PermissionDeniedError();
  }
}
