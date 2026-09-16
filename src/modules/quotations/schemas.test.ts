import { describe, expect, it } from "vitest";

import { quotationListQuerySchema } from "./schemas";

describe("quotation list query", () => {
  it("accepts the bounded client workspace filters and sort", () => {
    expect(
      quotationListQuerySchema.parse({
        bucket: "awaiting-decision",
        category: "Plumbing",
        search: "Local Flow",
        validity: "expiring",
        sort: "valid_until_asc",
        page: "2",
        pageSize: "20",
      }),
    ).toEqual({
      bucket: "awaiting-decision",
      category: "Plumbing",
      search: "Local Flow",
      validity: "expiring",
      sort: "valid_until_asc",
      page: 2,
      pageSize: 20,
    });
  });

  it("keeps bounded defaults and rejects unsupported views", () => {
    expect(quotationListQuerySchema.parse({})).toMatchObject({
      sort: "updated_desc",
      page: 1,
      pageSize: 10,
    });
    expect(() =>
      quotationListQuerySchema.parse({ bucket: "drafts" }),
    ).toThrow();
    expect(() =>
      quotationListQuerySchema.parse({ pageSize: "100" }),
    ).toThrow();
  });
});
