import { describe, expect, it } from "vitest";

import {
  DEFAULT_POST_AUTH_PATH,
  loginHrefFor,
  pathWithSearch,
  safeReturnPath,
} from "./auth-redirect";

describe("authentication return paths", () => {
  it("preserves an internal destination including its query and fragment", () => {
    expect(safeReturnPath("/client/bookings/new?service=plumbing#schedule")).toBe(
      "/client/bookings/new?service=plumbing#schedule",
    );
    expect(loginHrefFor("/professional/enquiries?status=new")).toBe(
      "/login?redirect=%2Fprofessional%2Fenquiries%3Fstatus%3Dnew",
    );
  });

  it("rejects external and authentication-loop destinations", () => {
    expect(safeReturnPath("https://example.com")).toBe(DEFAULT_POST_AUTH_PATH);
    expect(safeReturnPath("//example.com/path")).toBe(DEFAULT_POST_AUTH_PATH);
    expect(safeReturnPath("/login?redirect=/client")).toBe(
      DEFAULT_POST_AUTH_PATH,
    );
    expect(loginHrefFor("https://example.com")).toBe("/login");
  });

  it("combines the current pathname and search parameters", () => {
    expect(pathWithSearch("/marketplace", "q=plumber&page=2")).toBe(
      "/marketplace?q=plumber&page=2",
    );
    expect(pathWithSearch("/client/saved", "")).toBe("/client/saved");
  });
});
