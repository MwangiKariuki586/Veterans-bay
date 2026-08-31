import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AuthenticatedFooter } from "./authenticated-footer";

describe("authenticated footer", () => {
  it("accepts shell positioning styles while preserving its footer semantics", () => {
    render(<AuthenticatedFooter className="mt-auto" />);

    expect(screen.getByRole("contentinfo")).toHaveClass("mt-auto");
    expect(screen.getByRole("navigation", { name: "Legal" })).toBeInTheDocument();
  });
});
