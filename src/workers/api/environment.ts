import { z } from "zod";

import {
  parseAdditionalWebOrigins,
  parseWebOrigin,
} from "../../platform/auth/trusted-origins";

const webOriginSchema = z.string().transform((value, context) => {
  try {
    return parseWebOrigin(value);
  } catch {
    context.addIssue({
      code: "custom",
      message: "Expected an absolute HTTP(S) web origin without a path, query, or fragment.",
    });
    return z.NEVER;
  }
});

const additionalWebOriginsSchema = z
  .string()
  .optional()
  .transform((value, context) => {
    if (!value) return [];

    try {
      return parseAdditionalWebOrigins(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Expected a comma-separated list of absolute web origins.",
      });
      return z.NEVER;
    }
  });

export const apiEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "preview", "production"]),
  ADDITIONAL_WEB_ORIGINS: additionalWebOriginsSchema,
  API_RATE_LIMITER: z.custom<{ limit(options: { key: string }): Promise<{ success: boolean }> }>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      "limit" in value &&
      typeof value.limit === "function",
  ),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      {
        message: "DATABASE_URL must be a Postgres connection string.",
      },
    ),
  DOMAIN_EVENTS_QUEUE: z
    .custom<{ send(message: unknown): Promise<unknown> }>(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "send" in value &&
        typeof value.send === "function",
    )
    .optional(),
  PUBLIC_SUBMISSION_RATE_LIMITER: z
    .custom<{ limit(options: { key: string }): Promise<{ success: boolean }> }>(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "limit" in value &&
        typeof value.limit === "function",
    )
    .optional(),
  PUBLIC_REGISTRATION_ENABLED: z.enum(["true", "false"]),
  WEB_ORIGIN: webOriginSchema,
}).superRefine((environment, context) => {
  if (
    (environment.APP_ENV === "preview" || environment.APP_ENV === "production") &&
    environment.ADDITIONAL_WEB_ORIGINS.length > 0
  ) {
    context.addIssue({
      code: "custom",
      message: "Additional web origins are restricted to development and test environments.",
      path: ["ADDITIONAL_WEB_ORIGINS"],
    });
  }
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
