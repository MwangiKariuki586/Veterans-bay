import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DemoEnvironmentNotice } from "./demo-environment-notice";

describe("demo environment notice", () => {
  it("clearly warns against real activity and data", () => {
    render(<DemoEnvironmentNotice />);

    const notice = screen.getByRole("complementary", {
      name: "Demonstration environment notice",
    });
    expect(notice).toHaveTextContent("Demonstration environment only");
    expect(notice).toHaveTextContent("Do not enter real personal");
    expect(notice).toHaveTextContent("No real services or payments are processed");
  });
});
