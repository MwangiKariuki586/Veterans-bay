import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Brand } from "./brand";

describe("Brand", () => {
  it("renders the approved Veterans Bay logo asset", () => {
    const { container } = render(<Brand />);

    expect(screen.getByRole("link", { name: "Veterans Bay home" })).toHaveAttribute("href", "/");
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("veterans-bay-logo.png"),
    );
  });
});
