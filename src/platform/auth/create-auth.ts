import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";

import { IdentityRepository } from "../../modules/identity/repository";
import {
  AccountDeactivatedError,
  AccountRestrictedError,
  IdentityService,
} from "../../modules/identity/service";
import { createDatabaseClient } from "../database/client";
import { authSchema, user as authUser } from "./schema";

export interface AuthEnvironment {
  APP_ENV: "development" | "test" | "preview" | "production";
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  WEB_ORIGIN: string;
}

function toAuthApiError(error: unknown): never {
  if (
    error instanceof AccountRestrictedError ||
    error instanceof AccountDeactivatedError
  ) {
    throw new APIError("FORBIDDEN", {
      code: error.code,
      message: error.message,
    });
  }

  throw error;
}

export function createAuth(env: AuthEnvironment) {
  const sql = neon(env.DATABASE_URL);
  const db = drizzle(sql, { schema: authSchema });

  return betterAuth({
    appName: "Veterans Bay",
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 10,
    },
    advanced: {
      useSecureCookies:
        env.APP_ENV === "production" || env.APP_ENV === "preview",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.APP_ENV === "production" || env.APP_ENV === "preview",
        path: "/",
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            const client = createDatabaseClient(env.DATABASE_URL);
            try {
              const repository = new IdentityRepository(client.db);
              const existing = await repository.findProfileByAuthUserId(
                createdUser.id,
              );
              if (existing) {
                return;
              }

              const service = new IdentityService(repository);
              await service.reconcileRegisteredUser(
                {
                  email: createdUser.email,
                  id: createdUser.id,
                  name: createdUser.name,
                },
                {
                  acceptPrivacy: true,
                  acceptTerms: true,
                },
              );
            } finally {
              await client.close();
            }
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const client = createDatabaseClient(env.DATABASE_URL);
            try {
              const repository = new IdentityRepository(client.db);
              const service = new IdentityService(repository);
              const existing = await repository.findProfileByAuthUserId(
                session.userId,
              );

              if (!existing) {
                const [createdUser] = await db
                  .select()
                  .from(authUser)
                  .where(eq(authUser.id, session.userId))
                  .limit(1);

                if (!createdUser) {
                  throw new APIError("INTERNAL_SERVER_ERROR", {
                    message: "Authenticated user record was not found.",
                  });
                }

                await service.reconcileRegisteredUser(
                  {
                    email: createdUser.email,
                    id: createdUser.id,
                    name: createdUser.name,
                  },
                  {
                    acceptPrivacy: true,
                    acceptTerms: true,
                  },
                );
              }

              await service.requireActiveAccount(session.userId);
              return { data: session };
            } catch (error) {
              toAuthApiError(error);
            } finally {
              await client.close();
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
