import { describe, expect, it } from "vitest";

import { sanitizeAuditMetadata } from "../audit/record-audit";
import {
  buildPageResult,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginationOffset,
  parsePaginationSearchParams,
} from "../http/pagination";

describe("pagination conventions", () => {
  it("parses bounded page and pageSize values", () => {
    expect(parsePaginationSearchParams({})).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    expect(
      parsePaginationSearchParams({ page: "2", pageSize: "10" }),
    ).toEqual({ page: 2, pageSize: 10 });

    expect(() =>
      parsePaginationSearchParams({ pageSize: String(MAX_PAGE_SIZE + 1) }),
    ).toThrow();
  });

  it("builds page results and offsets", () => {
    const query = { page: 2, pageSize: 10 };
    expect(paginationOffset(query)).toBe(10);
    expect(buildPageResult(["a"], 25, query)).toEqual({
      items: ["a"],
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
    });
  });
});

describe("audit metadata sanitization", () => {
  it("strips secret-like keys and truncates long values", () => {
    const sanitized = sanitizeAuditMetadata({
      action: "member.removed",
      password: "secret",
      apiKey: "key",
      note: "x".repeat(600),
    });

    expect(sanitized).toEqual({
      action: "member.removed",
      note: `${"x".repeat(500)}…`,
    });
  });
});
