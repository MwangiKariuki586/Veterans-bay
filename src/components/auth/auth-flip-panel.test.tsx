import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/register",
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

vi.mock("@/components/public/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));

import { AuthFlipPanel } from "./auth-flip-panel";

function completeCommonFields() {
  fireEvent.change(document.querySelector("#signup-name")!, {
    target: { value: "Alex Veteran" },
  });
  fireEvent.change(document.querySelector("#signup-email")!, {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(document.querySelector("#signup-password")!, {
    target: { value: "password123" },
  });
  for (const checkbox of screen.getAllByRole("checkbox")) {
    fireEvent.click(checkbox);
  }
}

describe("account journey signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/register";
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("offers client and professional owner creation but never administrator creation", () => {
    render(<AuthFlipPanel />);

    expect(
      screen.getByRole("radio", { name: /hire services/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /offer services/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /admin/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/administrator access is assigned separately/i),
    ).toBeInTheDocument();
  });

  it("names signup fields and removes the inactive sign-in face from interaction", () => {
    render(<AuthFlipPanel />);

    expect(document.querySelector("#signup-name")).toHaveAccessibleName(
      "Enter your full name",
    );
    expect(document.querySelector("#signup-email")).toHaveAccessibleName(
      "Enter your email",
    );
    expect(document.querySelector("#signup-password")).toHaveAccessibleName(
      "Enter your password",
    );

    const inactiveFace = document.querySelector('[aria-hidden="true"]');
    expect(inactiveFace).toHaveAttribute("inert");
  });

  it("creates a client account and enters the client journey", async () => {
    render(<AuthFlipPanel />);
    completeCommonFields();

    fireEvent.click(screen.getByRole("button", { name: /^sign up/i }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: "alex@example.com",
        name: "Alex Veteran",
        password: "password123",
      });
      expect(mocks.push).toHaveBeenCalledWith("/client");
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates the organisation owner journey for a professional signup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { organisationId: "organisation-1" } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "organisation:organisation-1" } }),
      } as Response);

    render(<AuthFlipPanel />);
    fireEvent.click(screen.getByRole("radio", { name: /offer services/i }));
    completeCommonFields();
    fireEvent.change(
      screen.getByPlaceholderText("Business or professional name"),
      { target: { value: "ProLine Plumbing" } },
    );

    fireEvent.click(screen.getByRole("button", { name: /^sign up/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/v1/professional/onboarding",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "ProLine Plumbing" }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/v1/workspaces/select",
        expect.objectContaining({
          body: JSON.stringify({
            workspaceId: "organisation:organisation-1",
          }),
        }),
      );
      expect(mocks.push).toHaveBeenCalledWith("/professional/onboarding");
    });
  });
});
