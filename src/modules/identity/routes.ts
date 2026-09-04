import { Hono } from "hono";

import { createDatabaseClient } from "../../platform/database/client";
import type { ApiSuccessBody } from "../../platform/http/contracts";
import { parseJsonBody } from "../../platform/http/validation";
import type { ApiAppEnvironment } from "../../workers/api/types";
import { createAuth } from "../../platform/auth/create-auth";
import { identityPermissions } from "./permissions";
import { IdentityRepository } from "./repository";
import {
  attachAvatarBodySchema,
  deactivateAccountBodySchema,
  updateProfileBodySchema,
} from "./schemas";
import { IdentityService } from "./service";
import type { PublicAccountProfile, PublicSession } from "./types";

function toPublicProfile(profile: {
  id: string;
  displayName: string;
  primaryEmail: string;
  phone: string | null;
  location: string | null;
  bio: string | null;
  avatarAssetId: string | null;
  avatarUrl: string | null;
  timezone: string;
  status: string;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicAccountProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    primaryEmail: profile.primaryEmail,
    phone: profile.phone,
    location: profile.location,
    bio: profile.bio,
    avatarAssetId: profile.avatarAssetId,
    avatarUrl: profile.avatarUrl,
    timezone: profile.timezone,
    status: profile.status,
    termsAcceptedAt: profile.termsAcceptedAt?.toISOString() ?? null,
    privacyAcceptedAt: profile.privacyAcceptedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function createIdentityRoutes() {
  const routes = new Hono<ApiAppEnvironment>();

  routes.get("/v1/account/profile", async (context) => {
    void identityPermissions.profileRead;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      const profile = await service.getProfile(session.user.id);

      return context.json<ApiSuccessBody<PublicAccountProfile>>({
        data: toPublicProfile(profile),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.patch("/v1/account/profile", async (context) => {
    void identityPermissions.profileUpdate;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const input = await parseJsonBody(updateProfileBodySchema, context.req.raw);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      const profile = await service.updateProfile(
        session.user.id,
        input,
        context.get("requestId"),
      );

      return context.json<ApiSuccessBody<PublicAccountProfile>>({
        data: toPublicProfile(profile),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/account/avatar", async (context) => {
    void identityPermissions.profileUpdate;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const input = await parseJsonBody(attachAvatarBodySchema, context.req.raw);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      const profile = await service.attachAvatar(
        session.user.id,
        input.assetId,
        context.get("requestId"),
      );

      return context.json<ApiSuccessBody<PublicAccountProfile>>({
        data: toPublicProfile(profile),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.delete("/v1/account/avatar", async (context) => {
    void identityPermissions.profileUpdate;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      const profile = await service.removeAvatar(
        session.user.id,
        context.get("requestId"),
      );

      return context.json<ApiSuccessBody<PublicAccountProfile>>({
        data: toPublicProfile(profile),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.post("/v1/account/deactivate", async (context) => {
    void identityPermissions.accountDeactivate;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    await parseJsonBody(deactivateAccountBodySchema, context.req.raw);
    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      const profile = await service.deactivateAccount(
        session.user.id,
        context.get("requestId"),
      );

      await auth.api.signOut({ headers: context.req.raw.headers });

      return context.json<ApiSuccessBody<PublicAccountProfile>>({
        data: toPublicProfile(profile),
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.get("/v1/account/sessions", async (context) => {
    void identityPermissions.sessionManage;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      await service.requireActiveAccount(session.user.id);

      const sessions = await auth.api.listSessions({
        headers: context.req.raw.headers,
      });

      const data: PublicSession[] = sessions.map((item) => ({
        id: item.id,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
        expiresAt: new Date(item.expiresAt).toISOString(),
        ipAddress: item.ipAddress ?? null,
        userAgent: item.userAgent ?? null,
        isCurrent: item.token === session.session.token,
      }));

      return context.json<ApiSuccessBody<PublicSession[]>>({
        data,
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  routes.delete("/v1/account/sessions/:sessionId", async (context) => {
    void identityPermissions.sessionManage;
    const environment = context.get("environment");
    const auth = createAuth(environment);
    const session = await auth.api.getSession({ headers: context.req.raw.headers });

    if (!session) {
      return context.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication is required.",
          },
          requestId: context.get("requestId"),
        },
        401,
      );
    }

    const client = createDatabaseClient(environment.DATABASE_URL);

    try {
      const service = new IdentityService(new IdentityRepository(client.db));
      await service.requireActiveAccount(session.user.id);

      const sessions = await auth.api.listSessions({
        headers: context.req.raw.headers,
      });
      const target = sessions.find(
        (item) => item.id === context.req.param("sessionId"),
      );

      if (!target) {
        return context.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "The requested session was not found.",
            },
            requestId: context.get("requestId"),
          },
          404,
        );
      }

      await auth.api.revokeSession({
        headers: context.req.raw.headers,
        body: {
          token: target.token,
        },
      });

      return context.json<ApiSuccessBody<{ revoked: true }>>({
        data: { revoked: true },
        requestId: context.get("requestId"),
      });
    } finally {
      await client.close();
    }
  });

  return routes;
}
