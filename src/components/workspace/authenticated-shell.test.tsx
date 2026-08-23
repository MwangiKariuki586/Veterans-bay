import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthenticatedShell } from "./authenticated-shell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/components/public/site-header", () => ({
  SiteHeader: () => <header>Workspace header</header>,
}));

vi.mock("@/components/workspace/workspace-sidebar", () => ({
  WorkspaceSidebar: () => <aside>Workspace navigation</aside>,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null, isPending: true }),
  },
}));

vi.mock("@/lib/client-resource-cache", () => ({
  clearAllClientResourceCaches: vi.fn(),
  getCachedResource: () => "Client workspace",
  setCachedResource: vi.fn(),
}));

describe("authenticated shell", () => {
  it("pins the shared footer after short workspace content", () => {
    render(
      <AuthenticatedShell kind="client" hideIntro>
        <section>Short page content</section>
      </AuthenticatedShell>,
    );

    const footer = screen.getByRole("contentinfo");

    expect(footer.parentElement).toHaveClass(
      "flex",
      "min-h-full",
      "flex-col",
      "gap-6",
    );
    expect(footer).toHaveClass("mt-auto");
    expect(screen.getByText("Short page content")).toBeInTheDocument();
  });
});
