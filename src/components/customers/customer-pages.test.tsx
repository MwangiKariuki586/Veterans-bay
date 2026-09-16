import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CustomerBalance,
  CustomerDetail as CustomerDetailRecord,
  CustomerPage,
} from "@/modules/customers/types";
import { CustomerDetail } from "./customer-detail";
import { CustomerList } from "./customer-list";

const customer: CustomerDetailRecord = {
  id: "00000000-0000-4000-8000-000000000401",
  accountProfileId: null,
  displayName: "Amina Customer",
  email: "amina@example.test",
  phone: null,
  acquisitionSource: "PROFESSIONAL_IMPORTED",
  status: "IMPORTED",
  duplicateOfCustomerId: null,
  tags: ["Annual service"],
  lastServiceAt: null,
  createdAt: new Date().toISOString(),
  notes: [
    {
      id: "00000000-0000-4000-8000-000000000402",
      body: "Prefers morning appointments.",
      authorName: "Professional Owner",
      createdAt: new Date().toISOString(),
    },
  ],
  history: [],
};
const page: CustomerPage = {
  items: [customer],
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
};
const balance: CustomerBalance = {
  invoiceTotalMinor: 100000,
  paidMinor: 40000,
  outstandingMinor: 60000,
  currency: "KES",
};

afterEach(() => vi.restoreAllMocks());
describe("customer pages", () => {
  it("renders organisation customer origin, tags, and registration state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: page }),
      }),
    );
    render(<CustomerList />);
    expect(
      await screen.findByRole("heading", { name: customer.displayName }),
    ).toBeInTheDocument();
    expect(screen.getByText("PROFESSIONAL IMPORTED")).toBeInTheDocument();
    expect(screen.getByText("Annual service")).toBeInTheDocument();
  });

  it("shows private notes, restricted history, and permitted balances", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((path: string) =>
        Promise.resolve({
          ok: true,
          json: async () => ({
            data: path.endsWith("/balance") ? balance : customer,
          }),
        }),
      ),
    );
    render(<CustomerDetail customerId={customer.id} />);
    expect(
      await screen.findByRole("heading", { name: customer.displayName }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Prefers morning appointments."),
    ).toBeInTheDocument();
    expect(screen.getByText(/600/)).toBeInTheDocument();
    expect(screen.getByText("No service history")).toBeInTheDocument();
  });
});
