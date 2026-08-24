import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProfessionalBookingStart } from "@/components/bookings/professional-booking-start";
import { CustomerCreate } from "@/components/customers/customer-create";
import { CustomerList } from "@/components/customers/customer-list";
import { ProfessionalReviews } from "@/components/reviews/professional-reviews";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("professional workspace page headers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["customers", <CustomerList key="customers" />, "Customers"],
    [
      "customer creation",
      <CustomerCreate key="customer-create" />,
      "Add a customer",
    ],
    [
      "customer booking creation",
      <ProfessionalBookingStart key="booking-create" />,
      "Create a customer booking",
    ],
    ["reviews", <ProfessionalReviews key="reviews" />, "Reviews"],
  ])("keeps an h1 on the %s page", (_page, component, heading) => {
    render(component);

    expect(
      screen.getByRole("heading", { level: 1, name: heading }),
    ).toBeInTheDocument();
  });
});
