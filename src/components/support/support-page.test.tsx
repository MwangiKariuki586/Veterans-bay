import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useSessionMock = vi.fn(
  (): {
    data: null | { user: { id: string; name?: string; email?: string } };
    isPending: boolean;
  } => ({ data: null, isPending: false }),
);

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => useSessionMock(),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SupportPage } from "./support-page";

const eligibleJob = {
  id: "job-1",
  bookingId: "booking-1",
  serviceName: "Plumbing Repair",
  status: "COMPLETED",
  providerName: "Local Flow Plumbing",
  clientName: "Client",
  scheduledStartsAt: null,
  scheduledEndsAt: null,
  timezone: "Africa/Nairobi",
  totalMinor: 500000,
  currency: "KES",
  assignmentNames: [],
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const data = await handler(url, init);
    return { ok: true, json: async () => ({ data }) };
  });
}

const jobsResponse = () => ({ items: [eligibleJob] });

describe("SupportPage enquiry form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    useSessionMock.mockReturnValue({ data: null, isPending: false });
  });

  it("submits a guest enquiry and shows the returned reference", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (
        url.endsWith("/api/v1/public/contact") &&
        (init as RequestInit | undefined)?.method === "POST"
      ) {
        return { reference: "ENQ-ABC123", status: "NEW" };
      }
      return jobsResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Amina Yusuf" },
    });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "amina@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: "My invoice total does not match the quotation." },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await screen.findByText("ENQ-ABC123");
    const contactCalls = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith("/api/v1/public/contact") &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(contactCalls).toHaveLength(1);
    expect(
      JSON.parse(String((contactCalls[0][1] as RequestInit).body)),
    ).toEqual({
      inquiryType: "PAYMENTS",
      name: "Amina Yusuf",
      email: "amina@example.com",
      message: "My invoice total does not match the quotation.",
    });
  });

  it("validates enquiry fields inline and preserves input", async () => {
    vi.stubGlobal("fetch", mockFetch(jobsResponse));
    render(<SupportPage />);

    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(
      await screen.findByText("Enter your full name."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(
      screen.getByText("Describe what you need in at least 10 characters."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "A" },
    });
    expect(screen.getByLabelText(/full name/i)).toHaveValue("A");
  });

  it("prefills identity for signed-in senders", () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: "client-1", name: "Grace", email: "grace@example.com" } },
      isPending: false,
    });
    vi.stubGlobal("fetch", mockFetch(jobsResponse));
    render(<SupportPage />);

    expect(screen.getByLabelText(/full name/i)).toHaveValue("Grace");
    expect(screen.getByLabelText(/email address/i)).toHaveValue(
      "grace@example.com",
    );
  });

  it("contains no dead or placeholder links", () => {
    vi.stubGlobal("fetch", mockFetch(jobsResponse));
    render(<SupportPage />);

    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href).not.toBe("#");
      expect(href.startsWith("/help")).toBe(false);
      expect(href.startsWith("/contact")).toBe(false);
    }
  });
});

describe("SupportPage job ladder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    useSessionMock.mockReturnValue({
      data: { user: { id: "client-1" } },
      isPending: false,
    });
  });

  it("shows booking and warranty routes when signed in", async () => {
    vi.stubGlobal("fetch", mockFetch(jobsResponse));
    render(<SupportPage />);

    expect(
      screen.getByRole("link", { name: "Open your bookings" }),
    ).toHaveAttribute("href", "/client/bookings");
    expect(
      screen.getByRole("link", { name: "Open your warranties" }),
    ).toHaveAttribute("href", "/client/warranties");
    expect(await screen.findByLabelText("Choose a job")).toBeInTheDocument();
  });

  it("hides the ladder from guests behind a sign-in step", () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    vi.stubGlobal("fetch", mockFetch(jobsResponse));
    render(<SupportPage />);

    expect(
      screen.getByRole("link", { name: /sign in to get help/i }),
    ).toHaveAttribute("href", "/login?redirect=/support");
    expect(
      screen.queryByRole("link", { name: "Open your bookings" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Choose a job")).not.toBeInTheDocument();
  });

  it("validates the dispute form before submission", async () => {
    const fetchMock = mockFetch(jobsResponse);
    vi.stubGlobal("fetch", fetchMock);
    render(<SupportPage />);

    await screen.findByLabelText("Choose a job");
    fireEvent.click(screen.getByRole("button", { name: /submit dispute/i }));
    expect(
      await screen.findByText("Choose the job this dispute is about."),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Choose a job"), {
      target: { value: "job-1" },
    });
    fireEvent.change(screen.getByLabelText("What went wrong?"), {
      target: { value: "Too short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit dispute/i }));
    expect(
      await screen.findByText("Describe the issue in at least 10 characters."),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.filter(([input, init]) =>
        String(input).endsWith("/api/v1/disputes") &&
        (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(0);
  });

  it("submits eligible-job disputes to the platform endpoint", async () => {
    const fetchMock = mockFetch((url, init) => {
      if (
        url.endsWith("/api/v1/disputes") &&
        (init as RequestInit | undefined)?.method === "POST"
      ) {
        return { id: "dispute-1" };
      }
      return jobsResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SupportPage />);

    fireEvent.change(await screen.findByLabelText("Choose a job"), {
      target: { value: "job-1" },
    });
    fireEvent.change(screen.getByLabelText("What went wrong?"), {
      target: { value: "The professional never returned to fix the leak." },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit dispute/i }));

    await screen.findByText(/submitted for platform review/i);
    const disputeCalls = fetchMock.mock.calls.filter(([input, init]) =>
      String(input).endsWith("/api/v1/disputes") &&
      (init as RequestInit | undefined)?.method === "POST",
    );
    expect(disputeCalls).toHaveLength(1);
    expect(
      JSON.parse(String((disputeCalls[0][1] as RequestInit).body)),
    ).toEqual({
      jobId: "job-1",
      reason: "The professional never returned to fix the leak.",
    });
  });

  it("explains when no job is eligible for a dispute", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(() => ({
        items: [{ ...eligibleJob, id: "job-2", status: "IN_PROGRESS" }],
      })),
    );
    render(<SupportPage />);

    await waitFor(() =>
      expect(screen.queryByLabelText("Choose a job")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/no eligible jobs right now/i)).toBeInTheDocument();
  });
});
