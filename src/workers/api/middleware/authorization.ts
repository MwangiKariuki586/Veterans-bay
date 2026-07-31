import { createMiddleware } from "hono/factory";

import { IdentityRepository } from "../../../modules/identity/repository";
import { IdentityService } from "../../../modules/identity/service";
import { WorkspaceRepository } from "../../../modules/workspace/repository";
import { WorkspaceService } from "../../../modules/workspace/service";
import type { WorkspaceSelection } from "../../../modules/workspace/types";
import { createAuth } from "../../../platform/auth/create-auth";
import { createDatabaseClient } from "../../../platform/database/client";
import {
  PermissionDeniedError,
  UnauthorizedError,
  WorkspaceUnavailableError,
} from "../../../platform/permissions/errors";
import { hasPermission, type PermissionKey } from "../../../platform/permissions/keys";
import type { ApiAppEnvironment } from "../types";

export const WORKSPACE_HEADER = "x-workspace-id";
export const WORKSPACE_COOKIE = "vb_workspace";

export interface AuthenticatedAccount {
  authUserId: string;
  email: string;
  name: string;
}

declare module "hono" {
  interface ContextVariableMap {
    account: AuthenticatedAccount;
    workspaceSelection: WorkspaceSelection;
  }
}

function readWorkspaceId(cookieHeader: string | undefined, headerValue: string | undefined) {
  if (headerValue && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  if (!cookieHeader) {
    return null;
  }

  const parts = cookieHeader.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${WORKSPACE_COOKIE}=`)) {
      return decodeURIComponent(part.slice(WORKSPACE_COOKIE.length + 1));
    }
  }

  return null;
}

export const requireSessionMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const auth = createAuth(context.get("environment"));
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      throw new UnauthorizedError();
    }

    const client = createDatabaseClient(
      context.get("environment").DATABASE_URL,
    );
    try {
      await new IdentityService(
        new IdentityRepository(client.db),
      ).requireActiveAccount(session.user.id);
    } finally {
      await client.close();
    }

    context.set("account", {
      authUserId: session.user.id,
      email: session.user.email,
      name: session.user.name,
    });

    await next();
  },
);

export const requireWorkspaceMiddleware = createMiddleware<ApiAppEnvironment>(
  async (context, next) => {
    const account = context.get("account");
    if (!account) {
      throw new UnauthorizedError();
    }

    const workspaceId = readWorkspaceId(
      context.req.header("cookie"),
      context.req.header(WORKSPACE_HEADER),
    );

    if (!workspaceId) {
      throw new WorkspaceUnavailableError();
    }

    const client = createDatabaseClient(context.get("environment").DATABASE_URL);

    try {
      const service = new WorkspaceService(
        new WorkspaceRepository(client.db),
        new IdentityRepository(client.db),
      );
      const selection = await service.resolveWorkspace(
        account.authUserId,
        workspaceId,
      );
      context.set("workspaceSelection", selection);
    } finally {
      await client.close();
    }

    await next();
  },
);

export function requirePermissionMiddleware(
  required: PermissionKey | PermissionKey[],
) {
  return createMiddleware<ApiAppEnvironment>(async (context, next) => {
    const selection = context.get("workspaceSelection");
    if (!selection) {
      throw new WorkspaceUnavailableError();
    }

    if (!hasPermission(selection.workspace.permissions, required)) {
      throw new PermissionDeniedError();
    }

    await next();
  });
}
