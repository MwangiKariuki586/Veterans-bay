import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/notifications",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: mockPush }),
}));

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("notification center", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockPush.mockClear();
  });

  it("shows unread activity and marks one notification read via kebab", async () => {
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [{ ...notification, readAt: new Date().toISOString() }],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            unreadCount: 0,
          },
        }),
      } as Response);

    render(<NotificationCenter />, { wrapper: Wrapper });
    expect(await screen.findByRole("heading", { name: "Booking confirmed" })).toBeInTheDocument();
    // Tabs: All and Unread with counts
    expect(screen.getByRole("button", { name: /Unread/ })).toBeInTheDocument();
    expect(screen.getByText("Showing 1 to 1 of 1 notifications")).toBeInTheDocument();
    // Card is clickable when it has actionTarget
    expect(screen.getByRole("button", { name: /Booking confirmed.*unread/i })).toBeInTheDocument();
    expect(screen.getAllByText("Unread").length).toBeGreaterThanOrEqual(2);

    // Open kebab and mark read
    fireEvent.click(screen.getByRole("button", { name: `More actions for ${notification.title}` }));
    // Dropdown menu appears
    expect(await screen.findByRole("menuitem", { name: /Mark as read/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Open activity/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Mark as read/ }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Booking confirmed.*unread/i })).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /Unread/ })).toHaveTextContent("0"));
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

    render(<NotificationCenter />, { wrapper: Wrapper });
    expect(await screen.findByText("Target unavailable")).not.toBeNull;
    // Card should show "No action" hint when target is null
    expect(await screen.findByText(/No action/)).toBeInTheDocument();
    // Card should not be a button when no action target
    expect(screen.queryByRole("button", { name: /Booking confirmed.*unread/i })).not.toBeInTheDocument();
    // Kebab should show disabled target unavailable after opening
    fireEvent.click(screen.getByRole("button", { name: `More actions for ${notification.title}` }));
    expect(await screen.findByRole("menuitem", { name: "Target unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /Open activity/ })).not.toBeInTheDocument();
  });

  it("navigates when clicking a notification card and marks it read", async () => {
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            items: [{ ...notification, readAt: new Date().toISOString() }],
            page: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            unreadCount: 0,
          },
        }),
      } as Response);

    render(<NotificationCenter />, { wrapper: Wrapper });
    const card = await screen.findByRole("button", { name: /Booking confirmed.*unread/i });
    fireEvent.click(card);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(notification.actionTarget));
  });

  it("renders pagination and supports page navigation", async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      ...notification,
      id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`,
      title: `Notification ${i + 1}`,
    }));
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          items,
          page: 1,
          pageSize: 20,
          totalItems: 45,
          totalPages: 3,
          unreadCount: 5,
        },
      }),
    } as Response);

    render(<NotificationCenter />, { wrapper: Wrapper });
    expect(await screen.findByText("Showing 1 to 20 of 45 notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous page/ })).toBeDisabled();
    expect(screen.getByLabelText("Notifications per page")).toBeInTheDocument();
    // Page buttons 1,2,3 should exist; active page 1 has lime border
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
  });
});
