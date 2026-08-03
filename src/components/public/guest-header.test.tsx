import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GuestHeader } from "./guest-header";

describe("GuestHeader", () => {
  it("provides the focused unauthenticated navigation", () => {
    render(<GuestHeader />);

    expect(screen.getByRole("link", { name: "Veterans Bay home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "How It Works" })).toHaveAttribute("href", "/how-it-works");
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/contact");
  });

  it("can provide a landing-page login action without duplicate support content", () => {
    render(<GuestHeader trailing="login" />);

    expect(screen.getByRole("link", { name: "Log In" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("link", { name: "Contact support" })).not.toBeInTheDocument();
  });
});
