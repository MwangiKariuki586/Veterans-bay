import { describe, expect, it } from "vitest";

// @ts-expect-error The production seed guard is intentionally plain ESM for direct Node execution.
import { assertLocalSeedEnvironment } from "./local-seed-guard.mjs";

const safe = { APP_ENV: "development", WEB_ORIGIN: "http://localhost:3000", BETTER_AUTH_URL: "http://127.0.0.1:3000", DATABASE_URL: "postgresql://local.invalid/test" };

describe("local dashboard seed guard", () => {
  it("accepts only explicitly confirmed localhost development targets", () => { expect(() => assertLocalSeedEnvironment(safe, true)).not.toThrow(); });
  it("rejects preview and production origins", () => { expect(() => assertLocalSeedEnvironment({ ...safe, WEB_ORIGIN: "https://preview.example.com" }, true)).toThrow(/localhost/); expect(() => assertLocalSeedEnvironment({ ...safe, APP_ENV: "preview" }, true)).toThrow(/development/); });
  it("requires an explicit local confirmation", () => { expect(() => assertLocalSeedEnvironment(safe, false)).toThrow(/confirm-local/); });
});
