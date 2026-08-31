import type { ApiEnvironment } from "./environment";

export interface ApiRateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface DomainEventsQueueBinding {
  send(message: unknown, options?: { contentType?: string }): Promise<unknown>;
}

export interface ApiBindings {
  ADDITIONAL_WEB_ORIGINS?: string;
  APP_ENV: string;
  API_RATE_LIMITER: ApiRateLimiter;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  DATABASE_URL: string;
  DOMAIN_EVENTS_QUEUE?: DomainEventsQueueBinding;
  PUBLIC_REGISTRATION_ENABLED: "true" | "false";
  PUBLIC_SUBMISSION_RATE_LIMITER?: ApiRateLimiter;
  WEB_ORIGIN: string;
}

export interface ApiVariables {
  environment: ApiEnvironment;
  requestId: string;
  account?: {
    authUserId: string;
    email: string;
    name: string;
  };
  workspaceSelection?: import("../../modules/workspace/types").WorkspaceSelection;
}

export interface ApiAppEnvironment {
  Bindings: ApiBindings;
  Variables: ApiVariables;
}
