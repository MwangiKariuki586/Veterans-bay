import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LegacyClientJobRedirect } from "./legacy-client-job-redirect";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("./job-api", () => ({
  getJob: vi.fn(),
}));

import { getJob } from "./job-api";

describe("legacy client job redirect", () => {
  beforeEach(() => {
    replace.mockReset();
    vi.mocked(getJob).mockReset();
  });

  it("looks up the authorized job and replaces the legacy URL with its booking", async () => {
    vi.mocked(getJob).mockResolvedValue({ bookingId: "booking-123" } as never);

    render(<LegacyClientJobRedirect jobId="job-123" />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        "/client/bookings/booking-123#service-progress",
      ),
    );
    expect(getJob).toHaveBeenCalledWith("client", "job-123");
  });

  it("shows the established unavailable state without exposing a booking id", async () => {
    vi.mocked(getJob).mockRejectedValue(new Error("Not found"));

    render(<LegacyClientJobRedirect jobId="missing-job" />);

    expect(
      await screen.findByRole("heading", { name: "Service progress unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/booking-/i)).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
