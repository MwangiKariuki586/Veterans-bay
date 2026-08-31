import { beforeEach, describe, expect, it, vi } from "vitest";

import ClientRequestDetailPage from "./page";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("legacy client request detail route", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
  });

  it("opens the request list drawer instead of rendering a detail page", async () => {
    await ClientRequestDetailPage({
      params: Promise.resolve({
        requestId: "00000000-0000-4000-8000-000000000010",
      }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/client/requests?requestId=00000000-0000-4000-8000-000000000010",
    );
  });
});
