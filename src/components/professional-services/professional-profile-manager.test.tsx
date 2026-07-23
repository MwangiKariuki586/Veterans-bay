import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { ProfessionalProfileManager } from "./professional-profile-manager";

const profile = {
  organisationId: "11111111-1111-4111-8111-111111111111",
  professionalProfileId: "22222222-2222-4222-8222-222222222222",
  slug: "veterans-plumbing",
  businessName: "Veterans Plumbing",
  organisationStatus: "active",
  description:
    "Licensed plumbing professionals delivering careful residential repairs and maintenance.",
  primaryCategory: "Plumbing",
  operatingLocation: "Nairobi",
  serviceAreas: ["Westlands", "Kilimani"],
  availabilitySummary: "Available 6 days a week",
  verificationStatus: "verified",
  logoAssetId: null,
  logoUrl: null,
  portfolio: [],
  updatedAt: "2026-07-23T08:00:00.000Z",
};

describe("professional profile manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("loads the canonical profile management state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: profile }),
    } as Response);

    render(<ProfessionalProfileManager />);

    expect(await screen.findByRole("heading", { name: "Business profile" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Veterans Plumbing")).toBeInTheDocument();
    expect(screen.getByText("No portfolio work yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View public profile/ })).toHaveAttribute(
      "href",
      "/professionals/veterans-plumbing",
    );
  });

  it("saves public-safe profile fields through the profile contract", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: profile }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...profile, businessName: "Veterans Bay Plumbing" },
        }),
      } as Response);

    render(<ProfessionalProfileManager />);
    fireEvent.change(await screen.findByLabelText("Business name"), {
      target: { value: "Veterans Bay Plumbing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save public profile" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/v1/professional/profile",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Veterans Bay Plumbing"),
        }),
      ),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Public profile saved");
  });

  it("shows the suspended state without public or mutation actions", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { ...profile, organisationStatus: "suspended" },
      }),
    } as Response);

    render(<ProfessionalProfileManager />);

    expect(await screen.findByText("Public profile suspended")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View public profile/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save public profile" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Add portfolio item/ })).not.toBeInTheDocument();
  });
});
