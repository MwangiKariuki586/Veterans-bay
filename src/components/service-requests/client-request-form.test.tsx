import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientServiceRequest } from "@/modules/service-requests/types";
import { ClientRequestForm } from "./client-request-form";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), success: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.success },
}));

const requestId = "dafcf734-32f7-458e-85a1-818a52f716b6";

describe("client request draft submission", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.success.mockReset();
  });

  it("refreshes a stale draft version, preserves the form, and submits once", async () => {
    const patchVersions: number[] = [];
    const patchTargets: Array<string | null> = [];
    let detailReads = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? "GET";

      if (path === "/api/v1/client/requests/options") {
        return response({ data: requestOptions() });
      }
      if (path === `/api/v1/client/requests/${requestId}` && method === "GET") {
        detailReads += 1;
        return response({
          data: requestFixture({ version: detailReads === 1 ? 1 : 2 }),
        });
      }
      if (path === `/api/v1/client/requests/${requestId}` && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as {
          version: number;
          preferredProfessionalSlug: string | null;
        };
        patchVersions.push(body.version);
        patchTargets.push(body.preferredProfessionalSlug);
        return patchVersions.length === 1
          ? response(
              {
                error: {
                  code: "REQUEST_STALE",
                  message: "This request changed elsewhere. Refresh and try again.",
                },
              },
              409,
            )
          : response({ data: requestFixture({ version: 3 }) });
      }
      if (
        path === `/api/v1/client/requests/${requestId}/submit` &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body)) as { version: number };
        expect(body.version).toBe(3);
        return response({
          data: requestFixture({ status: "SUBMITTED", version: 4 }),
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClientRequestForm requestId={requestId} />);

    const description = await screen.findByLabelText("Describe the work *");
    fireEvent.change(description, {
      target: { value: "Please deep-clean both bathrooms this Friday." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(
        `/client/requests?requestId=${requestId}`,
      ),
    );
    expect(patchVersions).toEqual([1, 2]);
    expect(patchTargets).toEqual([
      "sparkle-clean-services",
      "sparkle-clean-services",
    ]);
    expect(mocks.success).toHaveBeenCalledWith(
      "Request sent successfully",
      {
        description:
          "Sparkle Clean Services can now review your requirements and respond with questions or a quotation.",
      },
    );
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("identifies an incomplete description before saving the draft", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/client/requests/options") {
        return response({ data: requestOptions() });
      }
      if (path === `/api/v1/client/requests/${requestId}`) {
        return response({ data: requestFixture({ description: "test" }) });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClientRequestForm requestId={requestId} />);

    const description = await screen.findByLabelText("Describe the work *");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText("Describe the work in at least 20 characters."),
    ).toBeInTheDocument();
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAttribute(
      "aria-describedby",
      "request-description-error request-description-hint",
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("requires an eligible professional before submitting", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/v1/client/requests/options") {
        return response({ data: requestOptions() });
      }
      if (path === `/api/v1/client/requests/${requestId}`) {
        return response({
          data: requestFixture({
            preferredProfessionalSlug: null,
            preferredProfessionalName: null,
          }),
        });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ClientRequestForm requestId={requestId} />);

    const professional = await screen.findByLabelText("Professional *");
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(
      await screen.findByText(
        "Choose the professional who should receive this request.",
      ),
    ).toBeInTheDocument();
    expect(professional).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("option", { name: "Sparkle Clean Services" }))
      .toHaveValue("sparkle-clean-services");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

function requestFixture(
  values: Partial<ClientServiceRequest>,
): ClientServiceRequest {
  return {
    id: requestId,
    idempotencyKey: "request-fixture-key",
    source: "MARKETPLACE_DISCOVERY",
    status: "DRAFT",
    version: 1,
    category: "Cleaning",
    preferredProfessionalSlug: "sparkle-clean-services",
    preferredServiceSlug: null,
    preferredProfessionalName: "Sparkle Clean Services",
    preferredServiceName: null,
    description: "Deep-clean both bathrooms and sanitise the fixtures.",
    location: "Nairobi",
    preferredTime: "Weekday mornings",
    budgetMinMinor: null,
    budgetMaxMinor: null,
    urgency: "SOON",
    contactPreference: "IN_APP",
    submittedAt: null,
    expiresAt: null,
    createdAt: "2030-08-27T10:00:00.000Z",
    updatedAt: "2030-08-27T10:00:00.000Z",
    history: [],
    attachments: [],
    ...values,
  };
}

function requestOptions() {
  return {
    categories: ["Cleaning"],
    professionals: [
      {
        slug: "sparkle-clean-services",
        name: "Sparkle Clean Services",
        categories: ["Cleaning"],
      },
    ],
  };
}

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}
