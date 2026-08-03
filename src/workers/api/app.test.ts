import { afterEach, describe, expect, it, vi } from "vitest";

import type { SystemRepository } from "../../modules/system/repository";
import { app, createApiApp } from "./app";
import type { ApiBindings, ApiRateLimiter } from "./types";

function rateLimiter(success = true): ApiRateLimiter {
  return {
    limit: vi.fn().mockResolvedValue({ success }),
  };
}

function bindings(overrides: Partial<ApiBindings> = {}): ApiBindings {
  return {
    API_RATE_LIMITER: rateLimiter(),
    APP_ENV: "test",
    BETTER_AUTH_SECRET: "test-better-auth-secret-with-32-chars!",
    BETTER_AUTH_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://neondb_owner:password@example.neon.tech/neondb?sslmode=require",
    PUBLIC_REGISTRATION_ENABLED: "true",
    WEB_ORIGIN: "http://localhost:3000",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Veterans Bay API foundation", () => {
  it("returns safe liveness and readiness responses", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();
    const api = createApiApp({
      systemRepository: {
        checkDependencies: async () => ({ available: true }),
      },
    });

    const [healthResponse, readinessResponse] = await Promise.all([
      api.request("/api/health", {}, environment),
      api.request("/api/ready", {}, environment),
    ]);
    const healthBody = await healthResponse.json<{
      data: { status: string; service: string };
      requestId: string;
    }>();
    const readinessBody = await readinessResponse.json<{
      data: { status: string; service: string };
      requestId: string;
    }>();

    expect(healthResponse.status).toBe(200);
    expect(healthBody.data).toEqual({
      service: "veterans-bay-api",
      status: "ok",
    });
    expect(healthBody.requestId).toBe(
      healthResponse.headers.get("x-request-id"),
    );
    expect(readinessResponse.status).toBe(200);
    expect(readinessBody.data.status).toBe("ready");
  });

  it("preserves a valid caller request ID", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/health",
      { headers: { "x-request-id": "request-123" } },
      bindings(),
    );

    expect(response.headers.get("x-request-id")).toBe("request-123");
  });

  it("replaces an invalid caller request ID", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/health",
      { headers: { "x-request-id": "invalid request id" } },
      bindings(),
    );

    expect(response.headers.get("x-request-id")).not.toBe(
      "invalid request id",
    );
  });

  it("fails safely when required bindings are missing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/health",
      {},
      {} as ApiBindings,
    );
    const body = await response.json<{
      error: { code: string; message: string };
      requestId: string;
    }>();

    expect(response.status).toBe(503);
    expect(body.error).toEqual({
      code: "CONFIGURATION_ERROR",
      message: "Service configuration is unavailable.",
    });
    expect(body).not.toHaveProperty("issues");
  });

  it("rejects an untrusted origin without reflecting it", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/health",
      { headers: { origin: "https://untrusted.example" } },
      bindings(),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the configured origin and handles preflight", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();

    const response = await app.request(
      "/api/health",
      { headers: { origin: environment.WEB_ORIGIN } },
      environment,
    );
    const preflight = await app.request(
      "/api/v1/system/probe",
      {
        headers: { origin: environment.WEB_ORIGIN },
        method: "OPTIONS",
      },
      environment,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      environment.WEB_ORIGIN,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain(
      "POST",
    );
  });

  it("disables public registration when the environment switch is off", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings({ PUBLIC_REGISTRATION_ENABLED: "false" });

    const response = await app.request(
      "/api/auth/sign-up/email",
      {
        body: JSON.stringify({
          email: "real-user@example.com",
          name: "Real User",
          password: "password123",
          privacyAccepted: true,
          termsAccepted: true,
        }),
        headers: {
          "content-type": "application/json",
          origin: environment.WEB_ORIGIN,
        },
        method: "POST",
      },
      environment,
    );
    const body = await response.json<{ error: { code: string; message: string } }>();

    expect(response.status).toBe(403);
    expect(body.error).toEqual({
      code: "PUBLIC_REGISTRATION_DISABLED",
      message: "Public registration is currently disabled.",
    });
  });

  it("returns bounded validation issues for invalid query and JSON input", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();

    const queryResponse = await app.request(
      "/api/ready?format=verbose",
      {},
      environment,
    );
    const jsonResponse = await app.request(
      "/api/v1/system/probe",
      {
        body: "not-json",
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      environment,
    );
    const queryBody = await queryResponse.json<{
      error: { code: string; issues: Array<{ path: string }> };
    }>();
    const jsonBody = await jsonResponse.json<{
      error: { code: string; issues: Array<{ code: string }> };
    }>();

    expect(queryResponse.status).toBe(422);
    expect(queryBody.error.code).toBe("VALIDATION_ERROR");
    expect(queryBody.error.issues).toEqual([
      { code: "invalid_value", path: "format" },
    ]);
    expect(jsonResponse.status).toBe(422);
    expect(jsonBody.error.issues).toEqual([
      { code: "invalid_json", path: "request" },
    ]);
  });

  it("rejects unbounded public marketplace queries before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/v1/public/marketplace?pageSize=11",
      {},
      bindings(),
    );
    const body = await response.json<{
      error: { code: string; issues: Array<{ path: string }> };
    }>();

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.issues).toEqual([
      { code: "too_big", path: "pageSize" },
    ]);
  });

  it("protects client and professional conversation routes before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const requestId = "00000000-0000-4000-8000-000000000010";

    const [clientResponse, professionalResponse] = await Promise.all([
      app.request(
        `/api/v1/client/requests/${requestId}/conversation`,
        {},
        bindings(),
      ),
      app.request(
        `/api/v1/professional/enquiries/${requestId}/conversation`,
        {},
        bindings(),
      ),
    ]);

    expect(clientResponse.status).toBe(401);
    expect(professionalResponse.status).toBe(401);
    await expect(clientResponse.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    await expect(professionalResponse.json()).resolves.toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("protects client and professional quotation routes before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const quotationId = "00000000-0000-4000-8000-000000000020";
    const responses = await Promise.all([
      app.request("/api/v1/client/quotations", {}, bindings()),
      app.request(
        `/api/v1/client/quotations/${quotationId}`,
        {},
        bindings(),
      ),
      app.request("/api/v1/professional/quotations", {}, bindings()),
      app.request(
        `/api/v1/professional/quotations/${quotationId}`,
        {},
        bindings(),
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401,
    ]);
  });

  it("protects booking, calendar, and availability routes before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const bookingId = "00000000-0000-4000-8000-000000000030";
    const blockId = "00000000-0000-4000-8000-000000000031";
    const responses = await Promise.all([
      app.request("/api/v1/client/bookings", {}, bindings()),
      app.request(
        "/api/v1/client/services/veteran-repairs/home-repair/booking-slots?from=2026-07-28T00%3A00%3A00.000Z&to=2026-07-29T00%3A00%3A00.000Z",
        {},
        bindings(),
      ),
      app.request(
        `/api/v1/client/bookings/${bookingId}`,
        {},
        bindings(),
      ),
      app.request("/api/v1/professional/bookings", {}, bindings()),
      app.request(
        `/api/v1/professional/bookings/${bookingId}`,
        {},
        bindings(),
      ),
      app.request("/api/v1/professional/calendar", {}, bindings()),
      app.request("/api/v1/professional/availability", {}, bindings()),
      app.request(
        `/api/v1/professional/availability/blocks/${blockId}`,
        { method: "DELETE" },
        bindings(),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401, 401, 401,
    ]);
  });

  it("protects notification list, count, and read actions before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const notificationId = "00000000-0000-4000-8000-000000000070";
    const responses = await Promise.all([
      app.request("/api/v1/notifications", {}, bindings()),
      app.request("/api/v1/notifications/unread-count", {}, bindings()),
      app.request(
        `/api/v1/notifications/${notificationId}/read`,
        { method: "POST" },
        bindings(),
      ),
      app.request(
        "/api/v1/notifications/read-all",
        { method: "POST" },
        bindings(),
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401,
    ]);
  });

  it("protects client and professional warranty routes before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warrantyId = "00000000-0000-4000-8000-000000000080";
    const claimId = "00000000-0000-4000-8000-000000000081";
    const responses = await Promise.all([
      app.request("/api/v1/client/warranties", {}, bindings()),
      app.request(
        `/api/v1/client/warranties/${warrantyId}`,
        {},
        bindings(),
      ),
      app.request("/api/v1/professional/warranties", {}, bindings()),
      app.request(
        `/api/v1/professional/warranties/${warrantyId}`,
        {},
        bindings(),
      ),
      app.request(
        `/api/v1/professional/warranty-claims/${claimId}/action`,
        { method: "POST" },
        bindings(),
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401,
    ]);
  });

  it("rejects unsafe marketplace analytics payloads before database access", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await app.request(
      "/api/v1/public/marketplace/events",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "marketplace.search_performed",
          activeFilters: ["rawSearchText"],
          page: 1,
          resultCount: -1,
          sort: "relevance",
          query: "private address details",
        }),
      },
      bindings(),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  });

  it("keeps routes thin while returning a mapped probe contract", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/v1/system/probe",
      {
        body: JSON.stringify({ value: "worker-ready" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      bindings(),
    );
    const body = await response.json<{ data: { value: string } }>();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ value: "worker-ready" });
  });

  it("rejects oversized request bodies before route handling", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request(
      "/api/v1/system/probe",
      {
        body: JSON.stringify({ value: "x".repeat(70_000) }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      bindings(),
    );
    const body = await response.json<{ error: { code: string } }>();

    expect(response.status).toBe(413);
    expect(body.error.code).toBe("REQUEST_TOO_LARGE");
  });

  it("uses the configured rate-limit binding and maps rejection safely", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const limiter = rateLimiter(false);

    const response = await app.request(
      "/api/health",
      {},
      bindings({ API_RATE_LIMITER: limiter }),
    );
    const body = await response.json<{ error: { code: string } }>();

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(limiter.limit).toHaveBeenCalledWith({
      key: "api:unknown:/api/health",
    });
  });

  it("applies the public submission limiter key for auth posts", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const apiLimiter = rateLimiter(true);
    const publicLimiter = rateLimiter(true);

    const response = await app.request(
      "/api/v1/public/contact",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.10",
        },
        body: JSON.stringify({ message: "hello" }),
      },
      bindings({
        API_RATE_LIMITER: apiLimiter,
        PUBLIC_SUBMISSION_RATE_LIMITER: publicLimiter,
      }),
    );

    expect(publicLimiter.limit).toHaveBeenCalledWith({
      key: "public:203.0.113.10:/api/v1/public/contact",
    });
    expect(apiLimiter.limit).not.toHaveBeenCalled();
    // Route may 404; rate-limit key behaviour is the foundation under test.
    expect([404, 405, 501]).toContain(response.status);
  });

  it("maps dependency failure and unexpected errors without leaking internals", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const unavailableRepository: SystemRepository = {
      checkDependencies: vi.fn().mockResolvedValue({ available: false }),
    };
    const throwingRepository: SystemRepository = {
      checkDependencies: vi
        .fn()
        .mockRejectedValue(new Error("private provider detail")),
    };

    const unavailableResponse = await createApiApp({
      systemRepository: unavailableRepository,
    }).request("/api/ready", {}, bindings());
    const unexpectedResponse = await createApiApp({
      systemRepository: throwingRepository,
    }).request("/api/ready", {}, bindings());
    const unavailableBody = await unavailableResponse.json<{
      error: { code: string };
    }>();
    const unexpectedBody = await unexpectedResponse.json<{
      error: { code: string; message: string };
    }>();

    expect(unavailableResponse.status).toBe(503);
    expect(unavailableBody.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(unexpectedResponse.status).toBe(500);
    expect(unexpectedBody.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
    });
    expect(JSON.stringify(unexpectedBody)).not.toContain("provider");
  });

  it("returns a stable not-found contract", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const response = await app.request("/missing", {}, bindings());
    const body = await response.json<{ error: { code: string } }>();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("mounts team contracts behind live session and workspace authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();
    const requests = [
      app.request("/api/v1/professional/team", {}, environment),
      app.request(
        "/api/v1/professional/team/invitations",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "member@example.com", role: "technician" }) },
        environment,
      ),
      app.request(
        "/api/v1/professional/team/invitations/accept",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: "a".repeat(64) }) },
        environment,
      ),
    ];
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });

  it("protects the professional service lifecycle behind session authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();
    const json = { headers: { "content-type": "application/json" } };
    const responses = await Promise.all([
      app.request("/api/v1/professional/services", {}, environment),
      app.request("/api/v1/professional/services/service-1", {}, environment),
      app.request("/api/v1/professional/services/service-1", {
        ...json,
        method: "PATCH",
        body: JSON.stringify({ version: 1, name: "Updated service" }),
      }, environment),
      app.request("/api/v1/professional/services/service-1/publish", {
        ...json,
        method: "POST",
        body: JSON.stringify({ version: 1 }),
      }, environment),
      app.request("/api/v1/professional/services/service-1/unpublish", {
        ...json,
        method: "POST",
        body: JSON.stringify({ version: 1 }),
      }, environment),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401]);
  });

  it("protects saved professionals behind session authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();
    const responses = await Promise.all([
      app.request("/api/v1/client/saved-professionals", {}, environment),
      app.request(
        "/api/v1/client/saved-professionals/trusted-plumbing",
        { method: "POST" },
        environment,
      ),
      app.request(
        "/api/v1/client/saved-professionals/trusted-plumbing",
        { method: "DELETE" },
        environment,
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });

  it("protects marketplace moderation behind session authorization", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const environment = bindings();
    const json = { headers: { "content-type": "application/json" } };
    const id = "11111111-1111-4111-8111-111111111111";
    const responses = await Promise.all([
      app.request("/api/v1/admin/categories", {}, environment),
      app.request(
        "/api/v1/admin/categories",
        { ...json, method: "POST", body: JSON.stringify({ name: "Roofing" }) },
        environment,
      ),
      app.request(
        `/api/v1/admin/categories/${id}/status`,
        {
          ...json,
          method: "POST",
          body: JSON.stringify({
            action: "deactivate",
            reason: "Policy review.",
          }),
        },
        environment,
      ),
      app.request("/api/v1/admin/marketplace/listings", {}, environment),
      app.request(
        `/api/v1/admin/marketplace/listings/${id}/moderation`,
        {
          ...json,
          method: "POST",
          body: JSON.stringify({ action: "hide", reason: "Policy review." }),
        },
        environment,
      ),
    ]);
    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401,
    ]);
  });
});
