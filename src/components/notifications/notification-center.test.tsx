import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationCenter } from "./notification-center";

const notification = {
  id: "00000000-0000-4000-8000-000000000060",
  sourceEventType: "booking.confirmed",
  title: "Booking confirmed",
  body: "Your repair booking has new activity.",
  actionTarget: "/client/bookings/00000000-0000-4000-8000-000000000061",
  readAt: null,
  createdAt: new Date().toISOString(),
};

describe("notification center", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows unread activity and marks one notification read", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [notification],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            unreadCount: 1,
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { unreadCount: 0 } }),
      } as Response);

    render(<NotificationCenter />);
    expect(
      await screen.findByRole("heading", { name: "Booking confirmed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unread (1)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View activity" })).toHaveAttribute(
      "href",
      notification.actionTarget,
    );

    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Mark read" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Unread (0)")).toBeInTheDocument();
  });

  it("renders the stale-target and empty states explicitly", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items: [{ ...notification, actionTarget: null, readAt: new Date().toISOString() }],
          page: 1,
          pageSize: 20,
          totalItems: 1,
          totalPages: 1,
          unreadCount: 0,
        },
      }),
    } as Response);

    render(<NotificationCenter />);
    expect(await screen.findByText("Target unavailable")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "View activity" }),
    ).not.toBeInTheDocument();
  });
});
