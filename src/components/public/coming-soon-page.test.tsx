import { cleanup, render, screen } from "@testing-library/react";
import { Bolt } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/workspace/authenticated-shell", () => ({
  AuthenticatedShell: ({ kind, children }: { kind: string; children: React.ReactNode }) => (
    <div data-testid={`${kind}-workspace-shell`}>{children}</div>
  ),
}));

import { FeatureStatusPage } from "./coming-soon-page";

const baseProps = {
  title: "Feature status title",
  description: "Feature-specific availability details.",
  icon: <Bolt aria-hidden="true" />,
  primaryAction: { href: "/primary", label: "Primary action" },
  secondaryAction: { href: "/secondary", label: "Secondary action" },
  previewContent: <div>Feature-specific preview</div>,
  benefits: [{ icon: <Bolt aria-hidden="true" />, title: "Relevant benefit" }],
} as const;

afterEach(cleanup);

describe("FeatureStatusPage", () => {
  it.each([
    ["coming-soon", "Coming soon"],
    ["under-maintenance", "Under maintenance"],
    ["temporarily-unavailable", "Temporarily unavailable"],
  ] as const)("renders the %s status variant", (status, label) => {
    render(<FeatureStatusPage {...baseProps} status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Feature status title" })).toBeInTheDocument();
    expect(screen.getByText("Feature-specific preview")).toBeInTheDocument();
    expect(screen.getByText("Relevant benefit")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
    expect(screen.getByRole("link", { name: "Primary action" })).toHaveAttribute("href", "/primary");
    expect(screen.getByRole("link", { name: "Secondary action" })).toHaveAttribute("href", "/secondary");
  });

  it.each(["client", "professional", "admin"] as const)(
    "renders inside the %s workspace shell",
    (shellType) => {
      render(<FeatureStatusPage {...baseProps} status="under-maintenance" shellType={shellType} />);
      expect(screen.getByTestId(`${shellType}-workspace-shell`)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Back to workspace" })).toHaveAttribute(
        "href",
        shellType === "client" ? "/client" : `/${shellType}`,
      );
    },
  );
});
