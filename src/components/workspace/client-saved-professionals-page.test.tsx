import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedProfessional } from "@/modules/saved-professionals/types";

import { ClientSavedProfessionalsPage } from "./client-saved-professionals-page";

vi.mock("@/components/workspace/workspace-shell-context", () => ({
  useWorkspaceShell: () => ({ workspaceId: "workspace-1", workspaceLabel: "Workspace", userId: "user-1" }),
  WorkspaceShellContext: { Provider: ({ children }: { children: unknown }) => children },
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user-1" } } }) },
}));

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const saved: SavedProfessional = {
  slug: "trusted-plumbing",
  businessName: "Trusted Plumbing",
  primaryCategory: "Plumbing",
  description: "Residential and commercial plumbing.",
  operatingLocation: "Nairobi",
  verified: true,
  logoUrl: null,
  serviceCount: 3,
  savedAt: "2026-07-23T09:00:00.000Z",
};

describe("client saved professionals page", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [saved] }),
      }),
    );
  });

  it("renders card-shaped placeholders while saved items load", () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));

    renderWithClient(<ClientSavedProfessionalsPage />);

    expect(
      screen.getByRole("status", { name: "Loading saved items" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("saved-item-card-skeleton")).toHaveLength(4);
  });

  it("renders the bounded saved professional projection", async () => {
    renderWithClient(<ClientSavedProfessionalsPage />);

    expect(await screen.findByText("Trusted Plumbing")).toBeInTheDocument();
    expect(screen.getByText("3 published services")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Trusted Plumbing/i }),
    ).toHaveAttribute("href", "/professionals/trusted-plumbing");
    expect(screen.getByText("Saved items")).toBeInTheDocument();
    expect(screen.getByText("Saved professionals")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Electrical Installation/i }),
    ).toHaveAttribute("href", "/services/electrical-installation");
    expect(
      screen.getByRole("link", { name: /Plumbing Repair/i }),
    ).toHaveAttribute("href", "/services/local-flow-plumbing-repair");
    expect(
      screen.getByRole("link", { name: /TV Wall Mounting/i }),
    ).toHaveAttribute("href", "/services/tv-wall-mounting");
    expect(
      screen.getByRole("link", { name: /Pipe Replacement Quotation/i }),
    ).toHaveAttribute(
      "href",
      "/client/quotations/d5000000-0000-4000-8000-000000000001",
    );
  });

  it("uses exact available profiles for illustrative empty-state cards", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    renderWithClient(<ClientSavedProfessionalsPage />);

    await screen.findByRole("heading", { name: "Assemble Pro Kenya" });
    expect(
      screen
        .getAllByRole("link", { name: /Assemble Pro Kenya/i })
        .find(
          (link) =>
            link.getAttribute("href") === "/professionals/assemble-pro-kenya",
        ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Sparkle Clean Services/i }),
    ).toHaveAttribute("href", "/professionals/sparkle-clean-services");
  });

  it("removes a professional from the local list after persistence succeeds", async () => {
    renderWithClient(<ClientSavedProfessionalsPage />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Remove Trusted Plumbing from saved",
      }),
    );

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/client/saved-professionals/trusted-plumbing",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Trusted Plumbing")).not.toBeInTheDocument(),
    );
  });
});
