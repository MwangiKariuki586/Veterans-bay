import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { applyPublicProjectionCache } from "./public-cache";

describe("public projection cache", () => {
  it("allows short-lived public reuse with stale revalidation", async () => {
    const app = new Hono();
    app.get("/marketplace", (context) => {
      applyPublicProjectionCache(context);
      return context.json({ data: [] });
    });

    const response = await app.request("/marketplace?page=2&pageSize=9");

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=30, stale-while-revalidate=60",
    );
    expect(response.headers.get("vary")).toBe("Origin, Accept-Encoding");
  });
});
