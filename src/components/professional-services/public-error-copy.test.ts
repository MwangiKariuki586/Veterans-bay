import { describe, expect, it } from "vitest";

import { toSafePublicErrorMessage } from "./public-error-copy";

const FALLBACK = "This listing is not currently available.";

describe("toSafePublicErrorMessage", () => {
  it("keeps the current API_UNAVAILABLE payload user-safe", () => {
    const message = toSafePublicErrorMessage(
      {
        code: "API_UNAVAILABLE",
        message:
          "Service data is temporarily unavailable. Please try again in a moment.",
      },
      FALLBACK,
    );
    expect(message).not.toMatch(/worker|CPU|preview API/i);
  });

  it("scrubs legacy worker CPU messages to the fallback", () => {
    expect(
      toSafePublicErrorMessage(
        {
          code: "API_UNAVAILABLE",
          message:
            "Preview API temporarily unavailable: Worker exceeded CPU time limit.",
        },
        FALLBACK,
      ),
    ).toBe(FALLBACK);
  });

  it("scrubs infrastructure messages even without the API_UNAVAILABLE code", () => {
    expect(
      toSafePublicErrorMessage(
        { message: "Worker exceeded CPU time limit." },
        FALLBACK,
      ),
    ).toBe(FALLBACK);
    expect(
      toSafePublicErrorMessage({ message: "Failed to fetch" }, FALLBACK),
    ).toBe(FALLBACK);
    expect(
      toSafePublicErrorMessage({ status: 503, message: "Oops" }, FALLBACK),
    ).toBe(FALLBACK);
  });

  it("preserves curated safe messages such as 404 copy", () => {
    expect(
      toSafePublicErrorMessage(
        {
          code: "PUBLIC_LISTING_UNAVAILABLE",
          message: "This service is not currently available.",
          status: 404,
        },
        FALLBACK,
      ),
    ).toBe("This service is not currently available.");
  });

  it("falls back when the error is empty", () => {
    expect(toSafePublicErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(toSafePublicErrorMessage({}, FALLBACK)).toBe(FALLBACK);
    expect(toSafePublicErrorMessage({ message: "  " }, FALLBACK)).toBe(
      FALLBACK,
    );
  });
});
