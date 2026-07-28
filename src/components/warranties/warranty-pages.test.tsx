import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WarrantyDetail } from "@/modules/warranties/types";
import { WarrantyDetail as WarrantyDetailView } from "./warranty-detail";
import { WarrantyList } from "./warranty-list";

const detail: WarrantyDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  jobId: "22222222-2222-4222-8222-222222222222",
  organisationId: "33333333-3333-4333-8333-333333333333",
  clientAccountId: "44444444-4444-4444-8444-444444444444",
  serviceName: "Electrical safety inspection",
  providerName: "Veterans Bay Electrical",
  clientName: "Amina Client",
  status: "ACTIVE",
  startsAt: "2026-07-28T08:00:00.000Z",
  endsAt: "2026-08-27T08:00:00.000Z",
  openClaimCount: 1,
  termsSnapshot: "Workmanship is covered for 30 days.",
  exclusionsSnapshot: "Damage after the service is excluded.",
  claims: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      sequence: 1,
      status: "UNDER_REVIEW",
      subject: "Outlet is loose again",
      description: "The repaired outlet became loose after normal use.",
      preferredResolution: "Please inspect the outlet.",
      decisionReason: null,
      returnVisitStartsAt: null,
      returnVisitEndsAt: null,
      resolutionNotes: null,
      lockVersion: 2,
      submittedAt: "2026-07-29T08:00:00.000Z",
      reviewedAt: "2026-07-29T09:00:00.000Z",
      resolvedAt: null,
      rejectedAt: null,
      escalatedAt: null,
      evidence: [],
      history: [
        {
          id: "66666666-6666-4666-8666-666666666666",
          action: "SUBMITTED",
          fromStatus: null,
          toStatus: "SUBMITTED",
          reason: null,
          createdAt: "2026-07-29T08:00:00.000Z",
        },
      ],
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("warranty workspaces", () => {
  it("renders active coverage and open-claim state", async () => {
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
    render(<WarrantyList audience="client" />);
    expect(
      await screen.findByText("Electrical safety inspection"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 open claim")).toBeInTheDocument();
    expect(screen.getAllByText("ACTIVE")).toHaveLength(2);
  });

  it("keeps client and professional claim actions role-sensitive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ data: detail })),
    );
    const { rerender } = render(
      <WarrantyDetailView audience="client" warrantyId={detail.id} />,
    );
    expect(
      await screen.findByRole("heading", {
        name: "Electrical safety inspection",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Escalate claim" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Accept claim" }),
    ).not.toBeInTheDocument();

    rerender(
      <WarrantyDetailView audience="professional" warrantyId={detail.id} />,
    );
    expect(
      await screen.findByRole("button", { name: "Accept claim" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reject with reason" }),
    ).toBeInTheDocument();
  });

  it("shows claim submission only for active coverage without an open claim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          data: { ...detail, openClaimCount: 0, claims: [] },
        }),
      ),
    );
    render(<WarrantyDetailView audience="client" warrantyId={detail.id} />);
    expect(
      await screen.findByRole("button", { name: "Submit claim" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/does not promise financial compensation/i)).toBeInTheDocument();
  });
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
