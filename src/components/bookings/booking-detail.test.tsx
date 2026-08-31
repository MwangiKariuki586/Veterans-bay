import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingDetail } from "./booking-detail";

const bookingId = "e8c9af65-0d72-44e0-9412-16bdcf5beb1e";
const membershipId = "d3270000-0000-4000-8000-000000000003";
const requestedStartAt = "2030-08-28T05:00:00.000Z";
const alternativeStartAt = "2030-08-28T05:30:00.000Z";

const booking = {
  id: bookingId,
  origin: "DIRECT_SERVICE",
  status: "PENDING_CONFIRMATION",
  serviceName: "Bathroom Sanitisation",
  providerName: "Sparkle Clean Services",
  clientName: "Mwas",
  startsAt: null,
  endsAt: null,
  requestedStartAt,
  timezone: "Africa/Nairobi",
  totalMinor: 180000,
  currency: "KES",
  assignmentName: null,
  updatedAt: "2030-08-27T11:20:00.000Z",
  requestId: null,
  quotationId: null,
  professionalServiceId: "d3400000-0000-4000-8000-000000000016",
  sourceBookingId: null,
  organisationId: "d3100000-0000-4000-8000-000000000003",
  clientAccountId: "1368b264-1494-4fd1-83c0-d31999c24896",
  createdByAccountId: "1368b264-1494-4fd1-83c0-d31999c24896",
  assignedMembershipId: null,
  requestedMembershipId: membershipId,
  proposedStartAt: null,
  requestedEndAt: "2030-08-28T06:30:00.000Z",
  cancellationPolicy: "Cancel at least 24 hours before the scheduled start.",
  cancellationAcknowledgedAt: "2030-08-27T11:15:00.000Z",
  cancellationReason: null,
  scope: "Sanitise the bathroom.",
  exclusions: "Repairs are excluded.",
  warrantyTerms: "Seven-day workmanship warranty.",
  paymentTerms: "Payment is recorded after confirmation.",
  depositMinor: 0,
  expectedDurationMinutes: 90,
  lockVersion: 4,
  createdAt: "2030-08-27T11:15:00.000Z",
  history: [],
  paymentRequirements: [],
};

const slots = [
  {
    membershipId,
    memberName: "Sparkle Clean Services Scheduler",
    startsAt: requestedStartAt,
    endsAt: "2030-08-28T06:30:00.000Z",
    timezone: "Africa/Nairobi",
  },
  {
    membershipId,
    memberName: "Sparkle Clean Services Scheduler",
    startsAt: alternativeStartAt,
    endsAt: "2030-08-28T07:00:00.000Z",
    timezone: "Africa/Nairobi",
  },
];

describe("client booking schedule feedback", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ data: booking }))
      .mockResolvedValueOnce(response({ data: slots }));
  });

  it("acknowledges an existing request and enables only an intentional update", async () => {
    render(<BookingDetail audience="client" bookingId={bookingId} />);

    expect(await screen.findByText("Time request sent")).toBeInTheDocument();
    const radios = await screen.findAllByRole("radio");
    expect(
      screen.getByRole("button", { name: "Time requested" }),
    ).toBeDisabled();

    fireEvent.click(radios[1]);

    expect(
      screen.getByRole("button", { name: "Update time request" }),
    ).toBeEnabled();
  });

  it("renders a rejected update beside the schedule action", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(
        { error: { message: "That time is no longer available." } },
        false,
      ),
    );
    render(<BookingDetail audience="client" bookingId={bookingId} />);

    await screen.findByText("Time request sent");
    const radios = await screen.findAllByRole("radio");
    fireEvent.click(radios[1]);
    fireEvent.click(
      screen.getByRole("button", { name: "Update time request" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Time request not sent")).toBeInTheDocument(),
    );
    expect(
      screen.getAllByText("That time is no longer available.").length,
    ).toBeGreaterThan(0);
  });
});

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}
