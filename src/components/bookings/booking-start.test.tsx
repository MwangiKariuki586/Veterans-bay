import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingStart } from "./booking-start";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

describe("booking start", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates a direct booking only after slot selection and policy acknowledgement", async () => {
    const startsAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const endsAt = new Date(
      new Date(startsAt).getTime() + 60 * 60_000,
    ).toISOString();
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              membershipId: "00000000-0000-4000-8000-000000000041",
              memberName: "Amina Technician",
              startsAt,
              endsAt,
              timezone: "Africa/Nairobi",
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "00000000-0000-4000-8000-000000000042",
          },
        }),
      } as Response);

    render(
      <BookingStart
        professionalSlug="veteran-repairs"
        serviceSlug="home-repair"
        serviceName="Home repair"
        providerName="Veteran Repairs"
      />,
    );

    const radio = await screen.findByRole("radio");
    const submit = screen.getByRole("button", { name: "Create booking" });
    expect(submit).toBeDisabled();
    fireEvent.click(radio);
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        "/client/bookings/00000000-0000-4000-8000-000000000042",
      ),
    );
    expect(fetch).toHaveBeenLastCalledWith(
      "/api/v1/client/bookings",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"origin":"DIRECT_SERVICE"'),
      }),
    );
  });

  it("rejects repeat booking when the source is not completed", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: "00000000-0000-4000-8000-000000000043",
            status: "CONFIRMED",
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

    render(
      <BookingStart sourceBookingId="00000000-0000-4000-8000-000000000043" />,
    );

    expect(
      await screen.findByText("Only completed bookings can be booked again."),
    ).toBeInTheDocument();
  });
});
