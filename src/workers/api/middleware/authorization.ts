import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";

import { IdentityRepository, type AccountProfileRecord } from "../../../modules/identity/repository";
import { IdentityService } from "../../../modules/identity/service";
import { WorkspaceRepository } from "../../../modules/workspace/repository";
import { WorkspaceService } from "../../../modules/workspace/service";
import type { WorkspaceSelection } from "../../../modules/workspace/types";
import { buildOrganisationWorkspaceId, parseWorkspaceId } from "../../../modules/workspace/types";
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
    databaseClient: ReturnType<typeof createDatabaseClient>;
    activeAccountProfile: AccountProfileRecord;
  }
}

export function readWorkspaceId(cookieHeader: string | undefined, headerValue: string | undefined) {
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

export const requireProfessionalDashboardMiddleware = createMiddleware<ApiAppEnvironment>(async (context, next) => {
  const auth = createAuth(context.get("environment"));
  const session = await auth.api.getSession({ headers: context.req.raw.headers });
  if (!session) throw new UnauthorizedError();
  const workspaceId = readWorkspaceId(context.req.header("cookie"), context.req.header(WORKSPACE_HEADER));
  const parsed = workspaceId ? parseWorkspaceId(workspaceId) : null;
  if (!parsed || parsed.kind !== "organisation") throw new WorkspaceUnavailableError();

  const client = createDatabaseClient(context.get("environment").DATABASE_URL);
  try {
    const resolved = await client.db.execute(sql`
      select ap.id as "accountProfileId", ap.status as "accountStatus",
        om.id as "membershipId", om.assigned_jobs_only as "assignedJobsOnly", om.financial_data_access as "financialDataAccess",
        o.id as "organisationId", o.name as "organisationName", o.status as "organisationStatus",
        r.key as "roleKey",
        coalesce(array_agg(distinct p.key) filter (where p.key is not null), '{}') as permissions,
        exists (select 1 from account_restrictions ar where ar.account_profile_id = ap.id and ar.starts_at <= now() and (ar.ends_at is null or ar.ends_at > now())) as restricted
      from account_profiles ap
      join organisation_memberships om on om.account_profile_id = ap.id and om.status = 'active'
      join organisations o on o.id = om.organisation_id
      join roles r on r.id = om.role_id and r.scope = 'organisation'
      left join role_permissions rp on rp.role_id = r.id
      left join permissions p on p.id = rp.permission_id
      where ap.auth_user_id = ${session.user.id} and o.id = ${parsed.referenceId}
      group by ap.id, om.id, o.id, r.id
      limit 1
    `);
    const row = resolved.rows[0] as Record<string, unknown> | undefined;
    if (!row || row.accountStatus !== "active" || row.restricted === true || ["suspended", "deactivated"].includes(String(row.organisationStatus))) throw new WorkspaceUnavailableError();
    const financialDataAccess = row.financialDataAccess === true;
    const permissions = (Array.isArray(row.permissions) ? row.permissions.map(String) : []).filter((permission) => financialDataAccess || !["payments.view", "payments.manage", "reports.financial.view"].includes(permission));
    context.set("databaseClient", client);
    context.set("account", { authUserId: session.user.id, email: session.user.email, name: session.user.name });
    context.set("workspaceSelection", { accountProfileId: String(row.accountProfileId), authUserId: session.user.id, workspace: {
      id: buildOrganisationWorkspaceId(String(row.organisationId)), kind: "organisation", label: String(row.organisationName), href: row.organisationStatus === "active" ? "/professional" : "/professional/onboarding",
      organisationId: String(row.organisationId), membershipId: String(row.membershipId), roleKey: String(row.roleKey), organisationStatus: String(row.organisationStatus) as "draft" | "pending_review" | "active" | "requires_changes",
      permissions, assignedJobsOnly: row.assignedJobsOnly === true, financialDataAccess,
    } });
    await next();
  } finally {
    await client.close();
  }
});

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
      const activeAccount = await new IdentityService(
        new IdentityRepository(client.db),
      ).requireActiveAccount(session.user.id);
      context.set("databaseClient", client);
      context.set("activeAccountProfile", activeAccount.profile);
      context.set("account", {
        authUserId: session.user.id,
        email: session.user.email,
        name: session.user.name,
      });
      await next();
    } finally {
      await client.close();
    }
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

    const client = context.get("databaseClient") ?? createDatabaseClient(context.get("environment").DATABASE_URL);
    const ownsClient = !context.get("databaseClient");

    try {
      const service = new WorkspaceService(
        new WorkspaceRepository(client.db),
        new IdentityRepository(client.db),
      );
      const activeProfile = context.get("activeAccountProfile");
      const selection = activeProfile ? await service.resolveWorkspaceForActiveProfile(
        activeProfile,
        account.authUserId,
        workspaceId,
      ) : await service.resolveWorkspace(account.authUserId, workspaceId);
      context.set("workspaceSelection", selection);
    } finally {
      if (ownsClient) await client.close();
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
