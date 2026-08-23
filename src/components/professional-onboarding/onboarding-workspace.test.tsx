import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingSummary } from "@/modules/professional-onboarding/types";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  session: { user: { id: "user-1" } },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: mocks.session, isPending: false }),
  },
}));

vi.mock("@/components/public/site-header", () => ({
  SiteHeader: () => null,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

import { OnboardingWorkspace } from "./onboarding-workspace";

const draft: OnboardingSummary = {
  organisationId: "organisation-1",
  professionalProfileId: "profile-1",
  name: "Digital Qatalyst",
  slug: "digital-qatalyst",
  status: "draft",
  businessType: null,
  primaryCategory: null,
  description: null,
  phone: null,
  email: null,
  operatingLocation: null,
  experienceStartedYear: null,
  serviceAreas: [],
  workingHours: {},
  logoAssetId: null,
  verificationType: null,
  verificationReference: null,
  verificationStatus: "not_started",
  termsAccepted: false,
  submittedAt: null,
  documents: [],
  history: [],
  readiness: {
    complete: false,
    completedCount: 1,
    totalCount: 14,
    missingFields: ["Primary category"],
  },
  updatedAt: "2026-07-22T12:00:00.000Z",
};

const pendingReview: OnboardingSummary = {
  ...draft,
  status: "pending_review",
  submittedAt: "2026-08-02T07:28:29.559Z",
  readiness: {
    complete: true,
    completedCount: 14,
    totalCount: 14,
    missingFields: [],
  },
};

describe("OnboardingWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("persists edited fields before opening application review", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: draft }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { ...draft, primaryCategory: "Electrical" },
        }),
      } as Response);

    render(<OnboardingWorkspace mode="edit" />);

    await screen.findByDisplayValue("Digital Qatalyst");
    const form = document.querySelector<HTMLFormElement>(
      "#professional-onboarding-form",
    );
    if (!form) throw new Error("Onboarding form was not rendered.");
    fireEvent.change(within(form).getByLabelText("Primary category"), {
      target: { value: "Electrical" },
    });
    fireEvent.click(
      within(form).getByRole("button", { name: /save & review/i }),
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/v1/professional/onboarding",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"primaryCategory":"Electrical"'),
        }),
      );
      expect(mocks.router.push).toHaveBeenCalledWith(
        "/professional/onboarding/review",
      );
    });
  });

  it("shows loading only on the button that initiated the save", async () => {
    let finishSave: ((response: Response) => void) | undefined;
    const pendingSave = new Promise<Response>((resolve) => {
      finishSave = resolve;
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: draft }),
      } as Response)
      .mockReturnValueOnce(pendingSave);

    render(<OnboardingWorkspace mode="edit" />);

    await screen.findByDisplayValue("Digital Qatalyst");
    const saveButton = screen.getByRole("button", { name: "Save draft" });
    const reviewButton = screen.getByRole("button", {
      name: /Save & review/,
    });
    fireEvent.click(reviewButton);

    await waitFor(() => expect(reviewButton).toHaveAttribute("aria-busy", "true"));
    expect(saveButton).not.toHaveAttribute("aria-busy");
    expect(saveButton).toBeDisabled();

    finishSave?.({
      ok: true,
      json: async () => ({ data: draft }),
    } as Response);
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalled());
  });

  it("shows actionable field guidance in a toast when validation fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: draft }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            code: "VALIDATION_ERROR",
            message: "The request is invalid.",
            issues: [{ code: "invalid_format", path: "phone" }],
          },
        }),
      } as Response);

    render(<OnboardingWorkspace mode="edit" />);

    await screen.findByDisplayValue("Digital Qatalyst");
    const form = document.querySelector<HTMLFormElement>(
      "#professional-onboarding-form",
    );
    if (!form) throw new Error("Onboarding form was not rendered.");
    const phoneInput = within(form).getByLabelText("Phone");
    fireEvent.change(phoneInput, {
      target: { value: "2099292w" },
    });
    fireEvent.click(within(form).getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Couldn’t save your draft",
        {
          description:
            "Enter a valid phone number using digits, spaces, +, parentheses, or hyphens.",
        },
      );
    });
    const phoneField = phoneInput.closest("label");
    if (!phoneField) throw new Error("Phone field wrapper was not rendered.");
    expect(phoneInput).toHaveAttribute("aria-invalid", "true");
    expect(
      within(phoneField).getByText(
        "Enter a valid phone number using digits, spaces, +, parentheses, or hyphens.",
      ),
    ).toBeInTheDocument();

    fireEvent.change(phoneInput, { target: { value: "+254 700 000 000" } });
    expect(phoneInput).toHaveAttribute("aria-invalid", "false");
    expect(
      within(phoneField).queryByText(
        "Enter a valid phone number using digits, spaces, +, parentheses, or hyphens.",
      ),
    ).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("does not expose storage-provider details when an upload fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: draft }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            assetId: "asset-1",
            authorization: {
              uploadUrl: "https://api.cloudinary.test/upload",
              apiKey: "key",
              timestamp: 1_700_000_000,
              signature: "signed-value",
              folder: "veterans-bay/logos",
              publicId: "asset-1",
              type: "upload",
            },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: "Invalid Signature signed-value. String to sign contains provider internals.",
          },
        }),
      } as Response);

    render(<OnboardingWorkspace mode="edit" />);

    const logoInput = await screen.findByLabelText("Professional logo file");
    fireEvent.change(logoInput, {
      target: {
        files: [new File(["logo"], "logo.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Upload unsuccessful", {
        description: "The file could not be uploaded. Please try again.",
      });
    });
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        description: expect.stringContaining("Invalid Signature"),
      }),
    );
  });

  it("orders onboarding, details, and readiness as three review columns", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: draft }),
    } as Response);

    render(<OnboardingWorkspace mode="review" />);

    const readiness = await screen.findByRole("complementary", {
      name: "Review readiness",
    });
    const layout = screen.getByLabelText("Application review columns");
    const progress = screen.getByLabelText("Onboarding progress");
    const details = screen.getByLabelText("Application details");
    expect(Array.from(layout.children)).toEqual([progress, details, readiness]);
    expect(layout).not.toHaveClass("border");
    expect(within(details).getByRole("heading", { name: "Review your application" })).toBeInTheDocument();
    expect(
      within(readiness).getByRole("link", { name: "Edit application" }),
    ).toHaveAttribute("href", "/professional/onboarding");
    expect(
      within(readiness).getByRole("button", { name: "Submit for review" }),
    ).toBeDisabled();
    expect(within(readiness).queryByText(/enable submission/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Review actions")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Edit application" })).toHaveLength(1);
  });

  it("clearly explains that a submitted application is awaiting administrator approval", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: pendingReview }),
    } as Response);

    render(<OnboardingWorkspace mode="review" />);

    expect(
      await screen.findByRole("heading", { name: "Application submitted" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Application submitted — awaiting administrator approval"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/must approve your organisation before you can access/i),
    ).toBeInTheDocument();

    const readiness = screen.getByRole("complementary", {
      name: "Review readiness",
    });
    expect(
      within(readiness).getByRole("heading", { name: "Awaiting approval" }),
    ).toBeInTheDocument();
    expect(within(readiness).getByText("Submitted for review")).toBeInTheDocument();
    expect(
      within(readiness).getByText("No action is required from you"),
    ).toBeInTheDocument();
    expect(
      within(readiness).queryByRole("link", { name: "Edit application" }),
    ).not.toBeInTheDocument();
    expect(
      within(readiness).queryByRole("button", { name: "Submit for review" }),
    ).not.toBeInTheDocument();
  });
});
