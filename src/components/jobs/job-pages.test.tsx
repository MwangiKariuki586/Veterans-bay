import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JobDetail } from "@/modules/jobs/types";
import { JobDetail as JobDetailView } from "./job-detail";
import { JobList } from "./job-list";

const ids = {
  job: "11111111-1111-4111-8111-111111111111",
  booking: "22222222-2222-4222-8222-222222222222",
  organisation: "33333333-3333-4333-8333-333333333333",
  client: "44444444-4444-4444-8444-444444444444",
  assignment: "55555555-5555-4555-8555-555555555555",
  membership: "66666666-6666-4666-8666-666666666666",
  checklist: "77777777-7777-4777-8777-777777777777",
};

const detail: JobDetail = {
  id: ids.job,
  bookingId: ids.booking,
  organisationId: ids.organisation,
  clientAccountId: ids.client,
  serviceName: "Electrical safety inspection",
  status: "TEAM_ASSIGNED",
  providerName: "Veterans Bay Electrical",
  clientName: "Amina Client",
  scheduledStartsAt: "2026-08-01T08:00:00.000Z",
  scheduledEndsAt: "2026-08-01T09:30:00.000Z",
  timezone: "Africa/Nairobi",
  totalMinor: 25_000,
  currency: "KES",
  assignmentNames: ["Field Technician"],
  updatedAt: "2026-07-28T08:00:00.000Z",
  lockVersion: 1,
  scopeSnapshot: "Inspect and certify the agreed circuits.",
  exclusionsSnapshot: "Repairs are excluded.",
  warrantyTermsSnapshot: "Thirty day workmanship cover.",
  paymentTermsSnapshot: "Payment after confirmation.",
  baseTotalMinor: 25_000,
  approvedVariationTotalMinor: 0,
  checkedInAt: null,
  startedAt: null,
  awaitingConfirmationAt: null,
  completedAt: null,
  assignments: [
    {
      id: ids.assignment,
      membershipId: ids.membership,
      displayName: "Field Technician",
      active: true,
      assignedAt: "2026-07-28T08:00:00.000Z",
      unassignedAt: null,
      reason: null,
    },
  ],
  checklist: [
    {
      id: ids.checklist,
      label: "Confirm requirements",
      required: true,
      position: 0,
      completed: false,
      resultNote: null,
      completedAt: null,
    },
  ],
  updates: [],
  evidence: [],
  variations: [],
  history: [
    {
      id: "88888888-8888-4888-8888-888888888888",
      action: "CREATED",
      fromStatus: null,
      toStatus: "TEAM_ASSIGNED",
      reason: null,
      createdAt: "2026-07-28T08:00:00.000Z",
    },
  ],
  completionResponses: [],
  conversationId: "99999999-9999-4999-8999-999999999999",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("job workspace", () => {
  it("renders a professional job list with assignment, status, and schedule", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: {
            items: [detail],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
          },
        }),
      ),
    );
    render(<JobList audience="professional" />);
    expect(
      screen.getByRole("heading", { name: "Active jobs" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Electrical safety inspection"),
    ).toBeInTheDocument();
    expect(screen.getByText("Field Technician")).toBeInTheDocument();
    expect(screen.getAllByText("TEAM ASSIGNED")).toHaveLength(2);
  });

  it("shows field workflow, checklist, evidence, variation, assignment, and conversation surfaces", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/v1/professional/team")) {
        return jsonResponse({
          data: {
            members: [
              {
                id: ids.membership,
                name: "Field Technician",
                status: "active",
              },
            ],
          },
        });
      }
      if (url.endsWith("/conversation")) {
        return jsonResponse({
          data: {
            conversationId: detail.conversationId,
            contextType: "JOB",
            contextId: ids.job,
            unreadCount: 0,
            items: [],
            refreshedAt: "2026-07-28T08:00:00.000Z",
          },
        });
      }
      if (url.endsWith("/start")) {
        return jsonResponse({
          data: { ...detail, status: "IN_PROGRESS", lockVersion: 2 },
        });
      }
      return jsonResponse({ data: detail });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<JobDetailView audience="professional" jobId={ids.job} />);

    expect(
      await screen.findByRole("heading", {
        name: "Electrical safety inspection",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Scope and checklist")).toBeInTheDocument();
    expect(screen.getByText("Work evidence")).toBeInTheDocument();
    expect(screen.getByText("Additional work")).toBeInTheDocument();
    expect(screen.getByText("Assigned team")).toBeInTheDocument();
    expect(screen.getByText("Fulfilment timeline")).toBeInTheDocument();
    expect(
      await screen.findByText("Use job evidence for work files."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start work/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/professional/jobs/${ids.job}/start`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("uploads completed-checklist evidence as client-visible completion evidence", async () => {
    const readyJob: JobDetail = {
      ...detail,
      status: "IN_PROGRESS",
      lockVersion: 3,
      checklist: detail.checklist.map((item) => ({
        ...item,
        completed: true,
        completedAt: "2026-07-28T08:30:00.000Z",
      })),
    };
    const uploadUrl = "https://upload.example.test/job-evidence";
    const fetchMock = vi.fn(
      async (...args: [input: RequestInfo | URL, init?: RequestInit]) => {
        const [input] = args;
        const url = String(input);
        if (url.endsWith("/api/v1/professional/team")) {
          return jsonResponse({ data: { members: [] } });
        }
        if (url.endsWith("/conversation")) {
          return jsonResponse({
            data: {
              conversationId: detail.conversationId,
              contextType: "JOB",
              contextId: ids.job,
              unreadCount: 0,
              items: [],
              refreshedAt: "2026-07-28T08:30:00.000Z",
            },
          });
        }
        if (url.endsWith("/api/v1/storage/upload-intent")) {
          return jsonResponse({
            data: {
              assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              authorization: {
                uploadUrl,
                apiKey: "preview-key",
                timestamp: 1_775_000_000,
                signature: "preview-signature",
                folder: "preview/jobs",
                publicId: "preview-completion",
                type: "authenticated",
              },
            },
          });
        }
        if (url === uploadUrl) {
          return {
            ok: true,
            json: async () => ({ public_id: "preview-completion" }),
          } as Response;
        }
        if (url.endsWith("/complete")) {
          return jsonResponse({ data: {} });
        }
        if (url.endsWith(`/api/v1/professional/jobs/${ids.job}/evidence`)) {
          return jsonResponse({ data: readyJob });
        }
        return jsonResponse({ data: readyJob });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<JobDetailView audience="professional" jobId={ids.job} />);

    expect(
      await screen.findByRole("heading", {
        name: "Electrical safety inspection",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Evidence stage" }),
    ).toHaveValue("COMPLETION");

    fireEvent.change(screen.getByLabelText("Add photo or PDF evidence"), {
      target: {
        files: [
          new File(["preview completion"], "completion.png", {
            type: "image/png",
          }),
        ],
      },
    });

    await waitFor(() => {
      const evidenceRequest = fetchMock.mock.calls.find(([input]) =>
        String(input).endsWith(`/api/v1/professional/jobs/${ids.job}/evidence`),
      );
      expect(evidenceRequest).toBeDefined();
      expect(
        JSON.parse(String((evidenceRequest?.[1] as RequestInit).body)),
      ).toMatchObject({
        evidenceType: "COMPLETION",
        visibility: "CLIENT",
        caption: "completion.png",
      });
    });
  });

  it("presents clear client completion choices without professional controls", async () => {
    const awaiting = {
      ...detail,
      status: "AWAITING_CLIENT_CONFIRMATION" as const,
      lockVersion: 4,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/conversation")
          ? jsonResponse({
              data: {
                conversationId: detail.conversationId,
                contextType: "JOB",
                contextId: ids.job,
                unreadCount: 0,
                items: [],
                refreshedAt: "2026-07-28T08:00:00.000Z",
              },
            })
          : jsonResponse({ data: awaiting }),
      ),
    );
    render(<JobDetailView audience="client" jobId={ids.job} />);
    expect(
      await screen.findByText("Your response is needed"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm completion" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Report unresolved" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /start work/i }),
    ).not.toBeInTheDocument();
  });

  it("embeds client service progress without duplicate booking content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith("/conversation")
          ? jsonResponse({
              data: {
                conversationId: detail.conversationId,
                contextType: "JOB",
                contextId: ids.job,
                unreadCount: 0,
                items: [],
                refreshedAt: "2026-07-28T08:00:00.000Z",
              },
            })
          : jsonResponse({ data: detail }),
      ),
    );

    render(<JobDetailView audience="client" jobId={ids.job} embedded />);

    expect(
      await screen.findByRole("heading", { name: "Service progress" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assigned professional")).toBeInTheDocument();
    expect(screen.getByText("Latest activity")).toBeInTheDocument();
    expect(screen.getByText("Service checklist")).toBeInTheDocument();
    expect(screen.getByText("Your service team is ready")).toBeInTheDocument();
    expect(screen.queryByText("Work evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Additional work")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Electrical safety inspection" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Commercial record")).not.toBeInTheDocument();
    expect(screen.queryByText("Scope and checklist")).not.toBeInTheDocument();
  });

  it("reduces completed embedded fulfilment to the modern verified review", async () => {
    const completed: JobDetail = {
      ...detail,
      status: "COMPLETED",
      completedAt: "2026-08-01T09:20:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (!String(input).endsWith("/review")) {
          return jsonResponse({ data: completed });
        }
        if (init?.method === "POST") {
          return jsonResponse({
            data: {
              eligible: false,
              deadline: "2026-08-31T09:20:00.000Z",
              reason: "A review has already been submitted.",
              review: {
                id: "review-current",
                jobId: ids.job,
                serviceName: detail.serviceName,
                providerName: detail.providerName,
                clientName: detail.clientName,
                overallRating: 4.6,
                serviceQualityRating: 3,
                communicationRating: 5,
                timelinessRating: 5,
                professionalismRating: 5,
                valueRating: 5,
                feedback: "",
                status: "PUBLISHED",
                submittedAt: "2026-08-01T09:25:00.000Z",
                response: null,
              },
              otherReviews: [
                {
                  id: "review-other",
                  clientName: "Peter Mwangi",
                  overallRating: 4.2,
                  feedback:
                    "The team communicated clearly and arrived on time.",
                  submittedAt: "2026-07-20T10:00:00.000Z",
                  response: null,
                },
              ],
            },
          });
        }
        return jsonResponse({
          data: {
            eligible: true,
            deadline: "2026-08-31T09:20:00.000Z",
            reason: null,
            review: null,
            otherReviews: [],
          },
        });
      }),
    );

    render(<JobDetailView audience="client" jobId={ids.job} embedded />);

    expect(
      await screen.findByRole("heading", { name: "How did everything go?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "5.0 out of 5 stars, calculated from category ratings",
      ),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Service quality: 3 out of 5",
      }),
    );
    expect(
      screen.getByText((_, element) => element?.textContent === "4.6/5"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/client/jobs/${ids.job}/review`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"serviceQualityRating":3'),
        }),
      ),
    );
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/client/jobs/${ids.job}/review`,
      expect.objectContaining({
        body: expect.stringContaining('"feedback":""'),
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "What other clients say" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Peter Mwangi")).toBeInTheDocument();
    expect(
      screen.getByText("The team communicated clearly and arrived on time."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Service progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Service checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("Work evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Assigned team")).not.toBeInTheDocument();
    expect(screen.queryByText("Fulfilment timeline")).not.toBeInTheDocument();
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}
