import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  categories: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

vi.mock("./catalogue-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogue-api")>();
  return { ...actual, catalogueApi: (path: string, init?: RequestInit) => path === "/api/v1/public/categories" ? mocks.categories() : actual.catalogueApi(path, init) };
});

import { CreateServiceForm, ServiceCatalogue, ServiceEditor } from "./service-catalogue";
import { clearAllClientResourceCaches } from "@/lib/client-resource-cache";
import { createProfessionalServiceBodySchema } from "@/modules/professional-services/schemas";

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
    mocks.categories.mockResolvedValue([{ id: "plumbing", name: "Plumbing", status: "active" }, { id: "cleaning", name: "Cleaning", status: "active" }]);
    clearAllClientResourceCaches();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  });

  it("loads existing categories, retries failures, and submits the selected category", async () => {
    mocks.categories.mockRejectedValueOnce(new Error("Unavailable"));
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: draftService }) } as Response);
    render(<CreateServiceForm />);
    expect(screen.getByRole("combobox", { name: "Category" })).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByRole("option", { name: "Cleaning" });
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Cleaning" } });
    fireEvent.change(screen.getByLabelText(/^Service name/), { target: { value: "House cleaning" } });
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/professional/services", expect.objectContaining({ body: expect.stringContaining('"category":"Cleaning"') })));
  });

  it("preserves a saved category outside the active list when editing", async () => {
    vi.mocked(fetch).mockImplementation(async (path) => ({ ok: true, json: async () => ({ data: String(path).endsWith("/images") ? [] : { ...draftService, category: "Legacy repairs" } }) }) as Response);
    render(<ServiceEditor serviceId="service-1" />);
    await screen.findByRole("option", { name: "Cleaning" });
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue("Legacy repairs");
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Plumbing" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/v1/professional/services/service-1", expect.objectContaining({ body: expect.stringContaining('"category":"Plumbing"') })));
  });

  it("keeps headings and controls mounted during a slow response and preserves entered search", async () => {
    let resolveList: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveList = resolve; }));
    render(<ServiceCatalogue />);
    expect(screen.getByRole("heading", { name: "Services", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add service/ })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading services" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "All (0)" })).not.toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Search services" });
    fireEvent.change(search, { target: { value: "electrical" } });
    resolveList?.({ ok: true, json: async () => ({ data: [draftService] }) } as Response);
    expect(await screen.findByText("No services match these filters")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search services" })).toBe(search);
    expect(search).toHaveValue("electrical");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("button", { name: "Continue setup" })).toBeInTheDocument();
    expect(screen.getByText("Price not set")).toBeInTheDocument();
  });

  it("opens a published card in the overview drawer and exposes View details there", async () => {
    const published = { ...draftService, id: "service-2", name: "AC servicing", slug: "ac-servicing", category: "Cooling", description: "AC maintenance", status: "published", version: 4, priceMinor: 400000, pricingModel: "starting_from", fulfilmentModel: "on_site", directBookingEnabled: true };
    vi.mocked(fetch).mockImplementation(async (path, init) => ({ ok: true, json: async () => ({ data: init?.method === "POST" ? { ...published, status: "unpublished", version: 5 } : String(path).endsWith("/images") ? [] : [draftService, published] }) }) as Response);
    render(<ServiceCatalogue />);
    fireEvent.click(await screen.findByRole("button", { name: "Published (1)" }));
    expect(screen.queryByRole("button", { name: "Continue setup" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), { target: { value: "Cooling" } });
    fireEvent.click(screen.getByRole("button", { name: "View service" }));
    const drawer = screen.getByRole("dialog", { name: "AC servicing" });
    expect(within(drawer).getByRole("link", { name: "View details" })).toHaveAttribute("href", "/professional/services/service-2");
  });

  it("recovers from list failures without replacing the page controls", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: "Services are temporarily unavailable." } }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as Response);
    render(<ServiceCatalogue />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No services yet")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search services" })).toBeInTheDocument();
  });

  it("uses the overview drawer from cards at compact widths", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.mocked(fetch).mockImplementation(async (path) => ({ ok: !String(path).endsWith("/images"), json: async () => String(path).endsWith("/images") ? { error: { message: "Image failure" } } : { data: [{ ...draftService, status: "published" }] } }) as Response);
    render(<ServiceCatalogue />);
    fireEvent.click(await screen.findByRole("button", { name: "View service" }));
    expect(screen.getByRole("dialog", { name: "Plumbing inspection" })).toBeInTheDocument();
  });

  it("shows the intentional no-services state", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
    render(<ServiceCatalogue />);
    expect(await screen.findByText("No services yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create first service" })).toBeInTheDocument();
  });

  it("opens the overview drawer from card content and links to full details", async () => {
    vi.mocked(fetch).mockImplementation(async (path) => ({ ok: true, json: async () => ({ data: String(path).endsWith("/images") ? [] : String(path).endsWith("/service-1") ? draftService : [draftService] }) }) as Response);
    render(<ServiceCatalogue />);
    fireEvent.click(await screen.findByText("Price not set"));
    const details = screen.getByRole("dialog", { name: draftService.name });
    expect(within(details).getByRole("link", { name: "View details" })).toHaveAttribute("href", "/professional/services/service-1");
  });

  it("creates a draft in the drawer and continues editing the saved service", async () => {
    vi.mocked(fetch).mockImplementation(async (path, init) => ({ ok: true, json: async () => ({ data: init?.method === "POST" || String(path).endsWith("/service-1") ? draftService : [] }) }) as Response);
    render(<ServiceCatalogue />);
    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    const drawer = screen.getByRole("dialog", { name: "Add service" });
    fireEvent.change(within(drawer).getByLabelText(/Service name/), { target: { value: draftService.name } });
    fireEvent.click(within(drawer).getByRole("button", { name: /Save draft/ }));
    const editor = await screen.findByRole("dialog", { name: "Edit service" });
    expect(await within(editor).findByLabelText(/^Service name/)).toHaveValue(draftService.name);
    expect(mocks.push).not.toHaveBeenCalled();
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

  it("explains the screenshot validation errors and accepts corrected creation data", async () => {
    vi.mocked(fetch).mockImplementation(async (_path, init) => {
      const data = createProfessionalServiceBodySchema.parse(JSON.parse(String(init?.body)));
      return { ok: true, json: async () => ({ data: { ...draftService, ...data } }) } as Response;
    });
    render(<CreateServiceForm embedded />);
    await screen.findByRole("option", { name: "Plumbing" });
    const values = [
      [/^Service name/, "test"], [/^Category/, "Plumbing"], [/^Description/, "test"],
      [/^Fulfilment model/, "on_site"], [/^Pricing model/, "starting_from"],
      [/^Price/, "839"], [/^Estimated duration/, "2929"], [/^Service areas/, "test"],
      [/^Client requirements/, "test"], [/^Warranty duration/, "20"], [/^Warranty terms/, "test"],
    ] as const;
    for (const [label, value] of values) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));
    expect(await screen.findByText("Enter at least 20 characters for the description.")).toBeInTheDocument();
    expect(screen.getByText("Enter at least 5 characters for the warranty terms.")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Description/)).toHaveAttribute("aria-invalid", "true");
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Price/)).toHaveValue(839);
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: "Inspection and repair of household plumbing." } });
    fireEvent.change(screen.getByLabelText(/^Warranty terms/), { target: { value: "Workmanship covered for twenty days." } });
    fireEvent.click(screen.getByRole("button", { name: /Save draft/ }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Service draft created"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ priceMinor: 83900, estimatedDurationMinutes: 2929, warrantyDurationDays: 20, directBookingEnabled: true });
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
