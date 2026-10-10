import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GetMatchedHelpCard } from "./get-matched-help-card";

const matchItem = {
  slug: "tap-repair",
  name: "Tap Repair",
  category: "Plumbing",
  description: "Fix leaking taps.",
  fulfilmentModel: "on_site",
  pricingModel: "fixed",
  priceMinor: 250_000,
  currency: "KES",
  serviceAreas: ["Nairobi"],
  imageUrl: null,
  provider: {
    slug: "fix-it",
    businessName: "Fix It",
    operatingLocation: "Nairobi",
    verified: true,
    availableToday: false,
    experienceYears: 4,
    nextAvailableSlot: null,
    rating: 4.8,
    reviewCount: 12,
    verifiedJobs: 30,
  },
};

function mockFetch() {
  return vi.fn(async (input: unknown) => {
    const url = String(input);
    if (url.includes("/api/v1/public/categories")) {
      return { ok: true, json: async () => ({ data: [{ name: "Plumbing" }] }) };
    }
    if (url.includes("/api/v1/public/marketplace/events")) {
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/api/v1/public/marketplace?")) {
      return {
        ok: true,
        json: async () => ({
          data: { items: [matchItem], page: 1, pageSize: 6, totalItems: 1, totalPages: 1 },
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe("get matched drawer", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens from the help card and requires a category", () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<GetMatchedHelpCard />);

    fireEvent.click(screen.getByRole("button", { name: /get matched/i }));
    expect(screen.getByRole("dialog", { name: "Tell us what you need" })).toBeVisible();
    expect(screen.getByText("Step 1 of 4 · What you need")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const alerts = screen.getAllByRole("alert").map((node) => node.textContent).join(" ");
    expect(alerts).toContain("Choose a service category.");
  });

  it("walks need, preferences, budget and urgency to results only", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<GetMatchedHelpCard />);

    fireEvent.click(screen.getByRole("button", { name: /get matched/i }));

    fireEvent.change(screen.getByLabelText("Service category *"), {
      target: { value: "Plumbing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 2 of 4 · Preferences")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Step 3 of 4 · Budget & urgency")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Minimum budget (KSh)"), {
      target: { value: "5000" },
    });
    fireEvent.change(screen.getByLabelText("Maximum budget (KSh)"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /show matches/i }));
    const alerts = screen.getAllByRole("alert").map((node) => node.textContent).join(" ");
    expect(alerts).toContain("Maximum must be a valid amount");

    fireEvent.change(screen.getByLabelText("Maximum budget (KSh)"), {
      target: { value: "10000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /show matches/i }));

    await waitFor(() => {
      expect(screen.getByText("1 match for Plumbing")).toBeVisible();
    });
    expect(screen.getByRole("link", { name: "Tap Repair" })).toHaveAttribute(
      "href",
      "/services/tap-repair",
    );
    expect(screen.getByText("Within your budget")).toBeVisible();
    // Results-only: no request creation, just a path back to the marketplace.
    expect(
      screen.getByRole("link", { name: /view all in marketplace/i }),
    ).toHaveAttribute("href", expect.stringContaining("category=Plumbing"));
    expect(screen.queryByRole("button", { name: /submit request/i })).toBeNull();
  });
});
