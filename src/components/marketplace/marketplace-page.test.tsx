import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarketplacePage } from "./marketplace-page";

describe("marketplace page", () => {
  it("renders find services fixtures and trust strip", () => {
    render(<MarketplacePage />);

    expect(
      screen.getByRole("heading", { name: "Find Services" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified Pros")).toBeInTheDocument();
    expect(screen.getByText("ProLine Plumbing")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /ProLine Plumbing/i }),
    ).toHaveAttribute("href", "/services/plumbing-inspection");
  });
});
