import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/professional",
}));

import { WorkspaceSidebar } from "./workspace-sidebar";

describe("workspace sidebar", () => {
  it("renders professional navigation with an active dashboard link", () => {
    render(
      <WorkspaceSidebar kind="professional" workspaceLabel="Alex's Plumbing" />,
    );

    expect(screen.getByRole("navigation", { name: "Workspace navigation" })).toBeInTheDocument();
    expect(screen.getByText("Alex's Plumbing")).toBeInTheDocument();
    expect(screen.getByText("Verified Pro")).toBeInTheDocument();

    const dashboard = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboard).toHaveAttribute("href", "/professional");
    expect(dashboard).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("link", { name: "Enquiries" })).toHaveAttribute(
      "href",
      "/professional/enquiries",
    );
    expect(screen.getByRole("link", { name: "Open help center" })).toHaveAttribute(
      "href",
      "/help",
    );
  });

  it("renders a lighter client navigation set", () => {
    render(<WorkspaceSidebar kind="client" workspaceLabel="Personal" />);

    expect(screen.getByRole("link", { name: "Invoices" })).toHaveAttribute(
      "href",
      "/client/invoices",
    );
    expect(screen.queryByText("Verified Pro")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Quotations" }),
    ).toHaveAttribute("href", "/client/quotations");
  });
});
