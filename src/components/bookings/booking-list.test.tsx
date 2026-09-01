import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BookingSummary } from "@/modules/bookings/types";
import { BookingList } from "./booking-list";

let currentSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/client/bookings",
  useSearchParams: () => currentSearch,
}));

const booking: BookingSummary = {
  id: "11111111-1111-4111-8111-111111111111",
  origin: "DIRECT_SERVICE",
  status: "CONFIRMED",
  serviceName: "Emergency plumbing repair",
  serviceSlug: "emergency-plumbing-repair",
  providerName: "Veterans Bay Plumbing",
  providerSlug: "veterans-bay-plumbing",
  clientName: "Alex Client",
  startsAt: "2030-09-03T08:00:00.000Z",
  endsAt: "2030-09-03T10:00:00.000Z",
  requestedStartAt: null,
  timezone: "Africa/Nairobi",
  totalMinor: 500_000,
  currency: "KES",
  assignmentName: "Field Technician",
  updatedAt: "2030-09-03T08:30:00.000Z",
  professionalServiceId: "22222222-2222-4222-8222-222222222222",
  jobId: "33333333-3333-4333-8333-333333333333",
  jobStatus: "IN_PROGRESS",
};

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("client booking lifecycle list", () => {
  beforeEach(() => {
    currentSearch = new URLSearchParams("stage=active");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            items: [booking],
            page: 1,
            pageSize: 10,
            totalItems: 1,
            totalPages: 1,
            summary: {
              total: 1,
              pending: 0,
              scheduled: 1,
              needsAction: 0,
              closed: 0,
              upcoming: 0,
              active: 1,
              past: 0,
            },
            origins: ["DIRECT_SERVICE"],
          },
        }),
      } as Response)),
    );
  });

  it("uses client lifecycle stages and displays the operational job status", async () => {
    render(<BookingList audience="client" />, { wrapper: Wrapper });

    expect((await screen.findAllByText("Emergency plumbing repair")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /In service/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByText("Service in progress").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("stage=active"),
        expect.any(Object),
      ),
    );
  });
});
