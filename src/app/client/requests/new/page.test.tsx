import { beforeEach, describe, expect, it, vi } from "vitest";

import NewClientRequestPage from "./page";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("new client request route", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
  });

  it("opens a new request in the list drawer and preserves service presets", async () => {
    await NewClientRequestPage({
      searchParams: Promise.resolve({
        source: "DIRECT_SERVICE_PAGE",
        category: "Cleaning",
        professional: "sparkle-clean-services",
        service: "deep-home-cleaning",
      }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/client/requests?editor=new&requestSource=DIRECT_SERVICE_PAGE&requestCategory=Cleaning&requestProfessional=sparkle-clean-services&requestService=deep-home-cleaning",
    );
  });

  it("opens an existing draft in the editor drawer", async () => {
    await NewClientRequestPage({
      searchParams: Promise.resolve({ requestId: "request-123" }),
    });

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/client/requests?editor=request-123",
    );
  });
});
