import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarketplaceCategoryManager } from "./marketplace-category-manager";
import { MarketplaceListingModeration } from "./marketplace-listing-moderation";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("marketplace moderation pages", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("renders managed category status from the administrator contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "category-1",
              name: "Plumbing",
              slug: "plumbing",
              status: "active",
              createdAt: "2026-07-23T12:00:00.000Z",
              updatedAt: "2026-07-23T12:00:00.000Z",
            },
          ],
        }),
      }),
    );

    render(<MarketplaceCategoryManager />);

    expect(await screen.findByText("Plumbing")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/admin/categories", {
      credentials: "include",
    });
  });

  it("renders visible and hidden listing evidence from the moderation queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            items: [
              {
                id: "service-1",
                organisationId: "organisation-1",
                organisationName: "Trusted Plumbing",
                slug: "pipe-inspection",
                name: "Pipe inspection",
                category: "Plumbing",
                publicationStatus: "published",
                moderationStatus: "hidden",
                moderationReason: "Listing evidence requires correction.",
                moderatedAt: "2026-07-23T12:00:00.000Z",
                updatedAt: "2026-07-23T12:00:00.000Z",
              },
            ],
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
          },
        }),
      }),
    );

    render(<MarketplaceListingModeration />);

    expect(await screen.findByText("Pipe inspection")).toBeInTheDocument();
    expect(screen.getByText("hidden")).toBeInTheDocument();
    expect(
      screen.getByText("Listing evidence requires correction."),
    ).toBeInTheDocument();
  });
});
