import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketplaceSearchResult } from "@/modules/marketplace/types";

import { MarketplacePage } from "./marketplace-page";

const push = vi.fn();
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentSearch,
}));

const result: MarketplaceSearchResult = {
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
  items: [
    {
      slug: "plumbing-inspection",
      name: "Plumbing inspection",
      category: "Plumbing",
      description: "Inspect pipework and diagnose hidden leaks.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 120_000,
      currency: "KES",
      serviceAreas: ["Nairobi"],
      imageUrl: null,
      provider: {
        slug: "trusted-plumbing",
        businessName: "Trusted Plumbing",
        operatingLocation: "Nairobi",
        verified: true,
        availableToday: true,
        experienceYears: 8,
        nextAvailableSlot: {
          startsAt: "2026-08-23T10:30:00.000Z",
          timezone: "Africa/Nairobi",
        },
        rating: 4.8,
        reviewCount: 12,
        verifiedJobs: 9,
      },
    },
  ],
};

describe("marketplace page", () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: result }),
      }),
    );
  });

  it("renders authoritative service results and trust context", async () => {
    render(<MarketplacePage />);

    expect(
      screen.getByRole("heading", { name: "Find Services" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Published services only")).toBeInTheDocument();
    expect(await screen.findByText("Trusted Plumbing")).toBeInTheDocument();
    expect(screen.getByLabelText("Service status: Available Today")).toBeInTheDocument();
    expect(screen.getByText("4.8 (12)")).toBeInTheDocument();
    for (const filter of within(screen.getAllByLabelText("Quick filters")[0]).getAllByRole(
      "button",
    )) {
      expect(filter).toHaveClass("shrink-0", "whitespace-nowrap");
    }
    expect(
      screen.getByRole("article").parentElement,
    ).toHaveClass("sm:grid-cols-2", "xl:grid-cols-3");
    expect(screen.getByLabelText("Category")).toHaveClass("min-w-0", "max-w-full");
    expect(document.querySelectorAll("[data-location-chevron]")[1]).toHaveClass(
      "-mr-1.5",
    );
    expect(screen.getByText("8+ years")).toBeInTheDocument();
    expect(screen.getByText(/Next slot:/)).toBeInTheDocument();
    expect(screen.getAllByText("Verified").length).toBeGreaterThan(1);
    expect(
      screen.getByRole("link", { name: "Plumbing inspection" }),
    ).toHaveAttribute("href", "/services/plumbing-inspection");
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/public/marketplace?pageSize=10",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("offers searchable location choices and applies the selected location", async () => {
    render(<MarketplacePage />);

    const locationSearch = screen.getAllByRole("combobox", {
      name: "Search locations",
    })[0];
    fireEvent.focus(locationSearch);
    fireEvent.change(locationSearch, { target: { value: "West" } });
    fireEvent.click(screen.getByRole("option", { name: "Westlands, Nairobi" }));

    expect(push).toHaveBeenCalledWith("/marketplace?location=Westlands");
  });

  it("applies top-rated and instant-booking quick filters", async () => {
    render(<MarketplacePage />);

    fireEvent.click(screen.getAllByRole("button", { name: "Top Rated" })[0]);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Instant Booking" })[0],
    );

    expect(push).toHaveBeenCalledWith("/marketplace?topRated=true");
    expect(push).toHaveBeenCalledWith("/marketplace?instantBooking=true");
  });

  it("shows meaningful labels for boolean and availability filters", async () => {
    currentSearch = new URLSearchParams(
      "availability=today&verified=true&topRated=true&instantBooking=true",
    );
    render(<MarketplacePage />);

    const active = screen.getByLabelText("Active filters");
    expect(within(active).getByText("Available Today")).toBeInTheDocument();
    expect(within(active).getByText("Verified")).toBeInTheDocument();
    expect(within(active).getByText("Top Rated")).toBeInTheDocument();
    expect(within(active).getByText("Instant Booking")).toBeInTheDocument();
    expect(within(active).queryByText("true")).not.toBeInTheDocument();
  });

  it("stretches list-view images to the full card height", async () => {
    render(<MarketplacePage />);
    await screen.findByText("Trusted Plumbing");

    fireEvent.click(screen.getAllByRole("button", { name: "List view" })[0]);

    expect(
      screen.getByRole("link", { name: "Open Plumbing inspection" }),
    ).toHaveClass(
      "sm:h-full",
      "sm:min-h-full",
      "sm:self-stretch",
      "sm:aspect-auto",
    );
  });

  it("hides the view switcher on mobile screens", async () => {
    render(<MarketplacePage />);
    await screen.findByText("Trusted Plumbing");

    expect(
      screen.getAllByRole("button", { name: "Grid view" })[0].parentElement,
    ).toHaveClass("hidden", "sm:flex");
  });

  it("anchors the favorite control to the card and shows honest new-provider details", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input) === "/api/v1/client/saved-professionals") {
        return { status: 401, ok: false, json: async () => ({}) } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({
          data: {
            ...result,
            items: [
              {
                ...result.items[0],
                provider: {
                  ...result.items[0].provider,
                  availableToday: false,
                  rating: null,
                  reviewCount: 0,
                  verifiedJobs: 0,
                  experienceYears: null,
                  nextAvailableSlot: null,
                },
              },
            ],
          },
        }),
      } as Response;
    });

    render(<MarketplacePage />);

    const favorite = await screen.findByRole("button", {
      name: "Save Trusted Plumbing",
    });
    expect(favorite).toHaveClass("absolute", "top-2.5", "right-2.5");
    expect(screen.getByText("New professional")).toBeInTheDocument();
    expect(screen.getByText("Experience not listed")).toBeInTheDocument();
    expect(screen.getByText("Check availability")).toBeInTheDocument();
    expect(screen.queryByLabelText("Service status: Available Today")).not.toBeInTheDocument();
  });

  it("requires authentication before saving a professional", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (
        url === "/api/v1/client/saved-professionals/trusted-plumbing" &&
        init?.method === "POST"
      ) {
        return { status: 401, ok: false, json: async () => ({}) } as Response;
      }
      if (url === "/api/v1/client/saved-professionals") {
        return { status: 401, ok: false, json: async () => ({}) } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ data: result }),
      } as Response;
    });

    render(<MarketplacePage />);
    await screen.findByText("Trusted Plumbing");
    fireEvent.click(
      screen.getByRole("button", { name: "Save Trusted Plumbing" }),
    );

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/login?redirect=%2Fmarketplace",
      ),
    );
  });

  it("renders and removes an existing saved state", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/client/saved-professionals") {
        return {
          status: 200,
          ok: true,
          json: async () => ({ data: [{ slug: "trusted-plumbing" }] }),
        } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ data: result }),
      } as Response;
    });

    render(<MarketplacePage />);
    const remove = await screen.findByRole("button", {
      name: "Remove Trusted Plumbing from saved",
    });
    fireEvent.click(remove);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/client/saved-professionals/trusted-plumbing",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Save Trusted Plumbing" }),
    ).toBeInTheDocument();
  });

  it("applies desktop filters through URL state", async () => {
    render(<MarketplacePage />);
    await screen.findByText("Trusted Plumbing");

    fireEvent.change(screen.getByRole("textbox", { name: /Search/i }), {
      target: { value: "hidden leaks" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Plumbing" },
    });
    const locationSearch = screen.getAllByRole("combobox", {
      name: "Search locations",
    })[1];
    fireEvent.focus(locationSearch);
    fireEvent.click(screen.getByRole("option", { name: "Nairobi, Kenya" }));
    fireEvent.click(screen.getByRole("button", { name: "Show results" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/marketplace?q=hidden+leaks&category=Plumbing&location=Nairobi",
      ),
    );
  });

  it("shows the filtered no-result state and clears URL filters", async () => {
    currentSearch = new URLSearchParams("category=Painting");
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).startsWith("/api/v1/public/marketplace?")) {
        return {
          ok: true,
          json: async () => ({
            data: { ...result, items: [], totalItems: 0 },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({ data: [] }),
      } as Response;
    });

    render(<MarketplacePage />);

    expect(
      await screen.findByText("No services match these filters"),
    ).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: "Clear filters" });
    fireEvent.click(clearButtons.at(-1)!);
    expect(push).toHaveBeenCalledWith("/marketplace");
  });

  it("does not delay results when analytics delivery fails", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/v1/public/marketplace/events") {
        throw new Error("analytics offline");
      }
      if (url === "/api/v1/client/saved-professionals") {
        return { status: 401, ok: false, json: async () => ({}) } as Response;
      }
      return {
        status: 200,
        ok: true,
        json: async () => ({ data: result }),
      } as Response;
    });

    render(<MarketplacePage />);

    expect(await screen.findByText("Trusted Plumbing")).toBeInTheDocument();
    expect(screen.queryByText(/analytics offline/i)).not.toBeInTheDocument();
  });
});
