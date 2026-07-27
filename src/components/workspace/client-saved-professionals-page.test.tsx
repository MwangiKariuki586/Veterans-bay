import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedProfessional } from "@/modules/saved-professionals/types";

import { ClientSavedProfessionalsPage } from "./client-saved-professionals-page";

const saved: SavedProfessional = {
  slug: "trusted-plumbing",
  businessName: "Trusted Plumbing",
  primaryCategory: "Plumbing",
  description: "Residential and commercial plumbing.",
  operatingLocation: "Nairobi",
  verified: true,
  logoUrl: null,
  serviceCount: 3,
  savedAt: "2026-07-23T09:00:00.000Z",
};

describe("client saved professionals page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [saved] }),
      }),
    );
  });

  it("renders the bounded saved professional projection", async () => {
    render(<ClientSavedProfessionalsPage />);

    expect(await screen.findByText("Trusted Plumbing")).toBeInTheDocument();
    expect(screen.getByText("3 published services")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View profile/i }),
    ).toHaveAttribute("href", "/professionals/trusted-plumbing");
  });

  it("removes a professional from the local list after persistence succeeds", async () => {
    render(<ClientSavedProfessionalsPage />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remove Trusted Plumbing from saved",
      }),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/client/saved-professionals/trusted-plumbing",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    expect(
      await screen.findByText("No saved professionals yet"),
    ).toBeInTheDocument();
  });
});
