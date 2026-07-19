import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicFooter } from "./public-footer";

describe("public footer", () => {
  it("renders explore support company and trust content", () => {
    render(<PublicFooter />);

    expect(
      screen.getByRole("navigation", { name: "Footer Explore links" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer Support links" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Footer Company links" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact Support" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByText("Background Verified")).toBeInTheDocument();
    expect(screen.getByText("Rated & Reviewed")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
  });
});
