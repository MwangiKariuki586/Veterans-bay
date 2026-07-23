import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import { CreateServiceForm, ServiceCatalogue, ServiceEditor } from "./service-catalogue";

const draftService = {
  id: "service-1",
  organisationId: "organisation-1",
  slug: "plumbing-inspection-12345678",
  name: "Plumbing inspection",
  category: "",
  description: null,
  fulfilmentModel: null,
  pricingModel: null,
  priceMinor: null,
  currency: "KES",
  estimatedDurationMinutes: null,
  serviceAreas: [],
  requirements: [],
  warrantyDurationDays: null,
  warrantyTerms: null,
  directBookingEnabled: false,
  status: "draft",
  version: 1,
  publishedAt: null,
  createdAt: "2026-07-22T18:00:00.000Z",
  updatedAt: "2026-07-22T18:00:00.000Z",
};

describe("professional service catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows the intentional no-services state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
    render(<ServiceCatalogue />);
    expect(await screen.findByText("No services yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create first service" })).toHaveAttribute("href", "/professional/services/new");
  });

  it("creates a private draft and returns to the catalogue", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "service-1", status: "draft" } }),
    } as Response);
    render(<CreateServiceForm />);
    fireEvent.change(screen.getByLabelText(/Service name/), { target: { value: "Plumbing inspection" } });
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/v1/professional/services",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Service draft created");
    expect(mocks.push).toHaveBeenCalledWith("/professional/services");
  });

  it("shows publication errors beneath their respective fields", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: draftService }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: "Complete the required service details before publishing.",
            issues: [
              { code: "required", path: "category" },
              { code: "required", path: "description" },
              { code: "required", path: "fulfilmentModel" },
            ],
          },
        }),
      } as Response);

    render(<ServiceEditor serviceId="service-1" />);
    fireEvent.click(await screen.findByRole("button", { name: /Publish service/ }));

    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/v1/professional/services/service-1/publish",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(screen.getByLabelText(/^Category/).parentElement).toHaveTextContent("Required before publishing.");
    expect(screen.getByLabelText(/^Description/).parentElement).toHaveTextContent("Required before publishing.");
    expect(screen.getByLabelText(/^Fulfilment model/).parentElement).toHaveTextContent("Required before publishing.");
  });

  it("shows a spinner only on the active publication action", async () => {
    let resolvePublish: ((value: Response) => void) | undefined;
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: draftService }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolvePublish = resolve; }));

    render(<ServiceEditor serviceId="service-1" />);
    const publishButton = await screen.findByRole("button", { name: /Publish service/ });
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(publishButton);

    await waitFor(() => expect(publishButton).toHaveAttribute("aria-busy", "true"));
    expect(saveButton).not.toHaveAttribute("aria-busy");
    resolvePublish?.({ ok: true, json: async () => ({ data: { ...draftService, status: "published", version: 2 } }) } as Response);
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Service published"));
  });

  it("saves unsaved form changes before publishing", async () => {
    const saved = {
      ...draftService,
      category: "Plumbing",
      description: "A complete inspection of household plumbing fixtures.",
      fulfilmentModel: "on_site",
      pricingModel: "fixed",
      priceMinor: 5_000,
      version: 2,
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: draftService }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: saved }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { ...saved, status: "published", version: 3 } }) } as Response);

    render(<ServiceEditor serviceId="service-1" />);
    fireEvent.change(await screen.findByLabelText(/^Category/), { target: { value: "Plumbing" } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: saved.description } });
    fireEvent.change(screen.getByLabelText(/^Fulfilment model/), { target: { value: "on_site" } });
    fireEvent.change(screen.getByLabelText(/^Pricing model/), { target: { value: "fixed" } });
    fireEvent.change(screen.getByLabelText(/^Price/), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /Publish service/ }));

    await waitFor(() => expect(fetch).toHaveBeenNthCalledWith(
      3,
      "/api/v1/professional/services/service-1",
      expect.objectContaining({ method: "PATCH" }),
    ));
    expect(fetch).toHaveBeenNthCalledWith(
      4,
      "/api/v1/professional/services/service-1/publish",
      expect.objectContaining({ body: JSON.stringify({ version: 2 }) }),
    );
  });
});
