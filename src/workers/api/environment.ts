import { z } from "zod";

export const apiEnvironmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "preview", "production"]),
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
  WEB_ORIGIN: z.url(),
});

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;
