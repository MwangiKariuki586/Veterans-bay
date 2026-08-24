import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pathname: "/register",
  search: "",
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  signUp: vi.fn(),
  signIn: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  session: null as { user: { id: string } } | null,
  sessionPending: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({
    push: mocks.push,
    refresh: mocks.refresh,
    replace: mocks.replace,
  }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: mocks.session,
      isPending: mocks.sessionPending,
    }),
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/components/public/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/public/site-header", () => ({
  SiteHeader: () => <div data-testid="site-header" />,
}));

import { AuthFlipPanel } from "./auth-flip-panel";

function completeCommonFields() {
  fireEvent.change(document.querySelector("#signup-name")!, {
    target: { value: "Alex Veteran" },
  });
  fireEvent.change(document.querySelector("#signup-email")!, {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(document.querySelector("#signup-phone")!, {
    target: { value: "0712 345 678" },
  });
  fireEvent.change(document.querySelector("#signup-password")!, {
    target: { value: "password123" },
  });
  fireEvent.change(document.querySelector("#signup-confirm-password")!, {
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
    mocks.search = "";
    mocks.session = null;
    mocks.sessionPending = false;
    mocks.signUp.mockResolvedValue({ data: { user: { id: "user-1" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) }),
    );
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
      "Create a password",
    );

    const inactiveFace = document.querySelector('[aria-hidden="true"][inert]');
    expect(inactiveFace).toHaveAttribute("inert");
  });

  it("creates a client account and enters the client journey", async () => {
    render(<AuthFlipPanel />);
    completeCommonFields();

    fireEvent.click(screen.getByRole("button", { name: /^create account/i }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledWith({
        email: "alex@example.com",
        name: "Alex Veteran",
        password: "password123",
        privacyAccepted: true,
        termsAccepted: true,
      });
      expect(mocks.push).toHaveBeenCalledWith("/client");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/account/profile",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ phone: "0712 345 678" }),
      }),
    );
  });

  it("shows the registration policy error returned by the API as a toast", async () => {
    mocks.signUp.mockResolvedValue({
      data: null,
      error: {
        code: "PUBLIC_REGISTRATION_DISABLED",
        message: "Public registration is currently disabled.",
      },
    });
    render(<AuthFlipPanel />);
    completeCommonFields();

    fireEvent.click(screen.getByRole("button", { name: /^create account/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Account registration is currently unavailable.",
      );
    });
    expect(screen.queryByText("Registration failed")).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("places signup validation errors beneath their controls without a toast", () => {
    render(<AuthFlipPanel />);

    fireEvent.click(screen.getByRole("button", { name: /^create account/i }));

    expect(screen.getByText("Enter your full name.")).toHaveAttribute(
      "id",
      "signup-name-error",
    );
    expect(document.querySelector("#signup-name")).toHaveAttribute(
      "aria-describedby",
      "signup-name-error",
    );
    expect(screen.getByText("Accept the terms and privacy policy to continue.")).toHaveAttribute(
      "id",
      "signup-accept-terms-error",
    );
    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("creates the organisation owner journey for a professional signup", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      } as Response)
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

    fireEvent.click(screen.getByRole("button", { name: /^create account/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/v1/professional/onboarding",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "ProLine Plumbing" }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
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

describe("authenticated auth-route guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/login";
    mocks.search = "";
    mocks.session = { user: { id: "user-1" } };
    mocks.sessionPending = false;
  });

  it("shows a workspace skeleton and redirects an authenticated user to their dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: "client:profile-1", kind: "client", href: "/client" },
        }),
      }),
    );

    render(<AuthFlipPanel />);

    expect(
      screen.getByRole("main", { name: "Opening your workspace" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/client");
    });
  });
});

describe("account journey sign in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = "/login";
    mocks.search = "";
    mocks.session = null;
    mocks.sessionPending = false;
    mocks.signIn.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("sends a signed-in user straight to their dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: "client:profile-1", kind: "client", href: "/client" },
        }),
      }),
    );

    render(<AuthFlipPanel />);

    fireEvent.change(document.querySelector("#signin-email")!, {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(document.querySelector("#signin-password")!, {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /remember me/i }));
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    await waitFor(() => {
      expect(mocks.signIn).toHaveBeenCalledWith({
        email: "alex@example.com",
        password: "password123",
        rememberMe: true,
      });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/v1/workspaces/enter",
        expect.objectContaining({ method: "POST" }),
      );
      expect(mocks.replace).toHaveBeenCalledWith("/client");
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("returns to the protected destination requested before sign in", async () => {
    mocks.search = "redirect=%2Fprofessional%2Fenquiries%3Fstatus%3Dnew";

    render(<AuthFlipPanel />);

    fireEvent.change(document.querySelector("#signin-email")!, {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(document.querySelector("#signin-password")!, {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/professional/enquiries?status=new",
      );
    });
  });

  it("keeps the login surface visible while one workspace redirect resolves", async () => {
    let resolveWorkspace!: (value: {
      ok: boolean;
      json: () => Promise<{
        data: { id: string; kind: string; href: string };
      }>;
    }) => void;
    const workspaceResponse = new Promise<{
      ok: boolean;
      json: () => Promise<{
        data: { id: string; kind: string; href: string };
      }>;
    }>((resolve) => {
      resolveWorkspace = resolve;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(workspaceResponse));
    const view = render(<AuthFlipPanel />);

    fireEvent.change(document.querySelector("#signin-email")!, {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(document.querySelector("#signin-password")!, {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    mocks.session = { user: { id: "user-1" } };
    view.rerender(<AuthFlipPanel />);

    expect(
      screen.getByRole("heading", { name: "Welcome back" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("main", { name: "Opening your workspace" }),
    ).not.toBeInTheDocument();

    resolveWorkspace({
      ok: true,
      json: async () => ({
        data: { id: "client:profile-1", kind: "client", href: "/client" },
      }),
    });

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/client");
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("places sign-in input errors beneath the fields without a toast", () => {
    render(<AuthFlipPanel />);

    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    expect(screen.getByText("Enter your email address.")).toHaveAttribute(
      "id",
      "signin-email-error",
    );
    expect(document.querySelector("#signin-email")).toHaveAttribute(
      "aria-describedby",
      "signin-email-error",
    );
    expect(screen.getByText("Enter your password.")).toHaveAttribute(
      "id",
      "signin-password-error",
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("shows an authentication failure as a toast instead of an inline banner", async () => {
    mocks.signIn.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    render(<AuthFlipPanel />);

    fireEvent.change(document.querySelector("#signin-email")!, {
      target: { value: "alex@example.com" },
    });
    fireEvent.change(document.querySelector("#signin-password")!, {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Unable to sign in with the details provided.",
      );
    });
    expect(screen.queryByText("Sign-in failed")).not.toBeInTheDocument();
  });

  it("keeps only supported and non-redundant sign-in options", () => {
    render(<AuthFlipPanel />);

    expect(screen.getByRole("link", { name: "Google" })).toHaveAttribute(
      "href",
      "/coming-soon/google-login",
    );
    expect(screen.queryByRole("button", { name: "Apple" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Microsoft" })).not.toBeInTheDocument();
    expect(screen.queryByText(/already have an account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/new to veterans bay/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });

  it("keeps the authentication switcher with the focused guest navigation", () => {
    render(<AuthFlipPanel />);

    const authentication = screen.getByRole("navigation", { name: "Authentication" });
    expect(authentication).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign In" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Signup" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("navigation", { name: "Guest navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Find Services" }),
    ).not.toBeInTheDocument();
    expect(
      [...document.querySelectorAll("img")].some((image) =>
        image.getAttribute("src")?.includes("veterans-bay-emblem.png"),
      ),
    ).toBe(true);
  });
});
