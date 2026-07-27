import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdminProfessionalReviewQueue,
  OnboardingSummary,
} from "@/modules/professional-onboarding/types";

import { ProfessionalReviewDetail } from "./professional-review-detail";
import { ProfessionalReviewQueue } from "./professional-review-queue";

const push = vi.fn();
let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentSearch,
}));

const queue: AdminProfessionalReviewQueue = {
  items: [
    {
      organisationId: "11111111-1111-4111-8111-111111111111",
      name: "Trusted Plumbing",
      status: "pending_review",
      primaryCategory: "Plumbing",
      operatingLocation: "Nairobi",
      verificationStatus: "pending",
      submittedAt: "2026-07-22T08:00:00.000Z",
      updatedAt: "2026-07-22T09:00:00.000Z",
      evidenceCount: 1,
    },
  ],
  page: 1,
  pageSize: 10,
  totalItems: 1,
  totalPages: 1,
};

const detail: OnboardingSummary = {
  organisationId: queue.items[0].organisationId,
  professionalProfileId: "professional-profile-1",
  name: "Trusted Plumbing",
  slug: "trusted-plumbing",
  status: "pending_review",
  businessType: "business",
  primaryCategory: "Plumbing",
  description:
    "Qualified plumbing professionals serving planned maintenance and urgent repair needs.",
  phone: "+254700000000",
  email: "hello@trusted.example",
  operatingLocation: "Nairobi",
  serviceAreas: ["Westlands"],
  workingHours: {},
  logoAssetId: "logo-1",
  verificationType: "business_registration",
  verificationReference: "CPR-12345",
  verificationStatus: "pending",
  termsAccepted: true,
  submittedAt: "2026-07-22T08:00:00.000Z",
  documents: [
    {
      id: "document-1",
      assetId: "asset-1",
      documentType: "business registration",
      fileName: "private-registration.pdf",
    },
  ],
  history: [],
  readiness: {
    complete: true,
    completedCount: 12,
    totalCount: 12,
    missingFields: [],
  },
  updatedAt: "2026-07-22T09:00:00.000Z",
};

describe("administrator professional review pages", () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams();
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: queue }),
      }),
    );
  });

  it("renders the authoritative review queue and applies URL-backed status filters", async () => {
    render(<ProfessionalReviewQueue />);

    expect(await screen.findByText("Trusted Plumbing")).toBeInTheDocument();
    expect(screen.getByText("1 evidence file")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/admin/professionals?status=pending_review&page=1&pageSize=10",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Changes requested" }));
    expect(push).toHaveBeenCalledWith(
      "/admin/professionals?status=requires_changes",
    );
  });

  it("loads a complete application and uses the protected evidence endpoint", async () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: detail }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { url: "https://res.cloudinary.test/signed-evidence" },
        }),
      } as Response);

    render(
      <ProfessionalReviewDetail organisationId={detail.organisationId} />,
    );

    expect(await screen.findByText("Application information")).toBeInTheDocument();
    expect(screen.getByText("CPR-12345")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open evidence/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/admin/professionals/${detail.organisationId}/evidence/asset-1`,
        { credentials: "include" },
      ),
    );
    expect(open).toHaveBeenCalledWith(
      "https://res.cloudinary.test/signed-evidence",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("requires confirmation and a reason before suspending an active organisation", async () => {
    const active = { ...detail, status: "active" as const };
    const suspended = { ...detail, status: "suspended" as const };
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: active }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            organisationId: detail.organisationId,
            status: "suspended",
            verificationStatus: "verified",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: suspended }),
      } as Response);

    render(
      <ProfessionalReviewDetail organisationId={detail.organisationId} />,
    );

    expect(
      await screen.findByRole("option", { name: "Suspend organisation" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Decision reason"), {
      target: { value: "Marketplace policy review requires suspension." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Suspend organisation" }),
    );
    const suspendButtons = await screen.findAllByRole("button", {
      name: "Suspend organisation",
    });
    fireEvent.click(suspendButtons.at(-1)!);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/admin/professionals/${detail.organisationId}/decision`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            decision: "suspend",
            reason: "Marketplace policy review requires suspension.",
          }),
        }),
      ),
    );
    expect(await screen.findByText("suspended")).toBeInTheDocument();
  });
});
