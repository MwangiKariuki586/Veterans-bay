"use client";

import { CircleDollarSign, ReceiptText } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { PaymentSummary } from "@/modules/invoices/types";
import { listPayments } from "./invoice-api";
import { formatMoney } from "./invoice-list";

export function PaymentList() {
  const [items, setItems] = useState<PaymentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listPayments()
      .then((result) => setItems(result.items))
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Payments unavailable."),
      );
  }, []);

  if (!items && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading payments"
        description="Retrieving manual records and allocation totals."
      />
    );
  }
  return (
    <div>
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">
          Financial records
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
          Payments
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          Review manual payment records, allocation totals, and preserved
          adjustments.
        </p>
      </div>
      {error ? (
        <InlineAlert
          className="mt-5"
          title="Payments need attention"
          description={error}
        />
      ) : null}
      {items?.length === 0 ? (
        <StatePanel
          className="mt-5"
          title="No payments recorded"
          description="Record a payment from an issued invoice to build the auditable ledger."
        />
      ) : null}
      {items?.length ? (
        <div className="mt-5 grid gap-4">
          {items.map((payment) => (
            <Surface key={payment.id} className="p-5 shadow-none sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge
                    variant={
                      payment.status === "REVERSED" ? "warning" : "success"
                    }
                  >
                    {payment.status.replaceAll("_", " ")}
                  </Badge>
                  <h2 className="mt-3 font-bold">{payment.clientName}</h2>
                  <p className="mt-1 text-sm text-[#68717b]">
                    {payment.method.replaceAll("_", " ")}
                    {payment.transactionReference
                      ? ` · ${payment.transactionReference}`
                      : ""}
                  </p>
                </div>
                <p className="font-bold">
                  {formatMoney(payment.amountMinor, payment.currency)}
                </p>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-[#59646e] sm:grid-cols-3">
                <p className="flex items-center gap-2">
                  <ReceiptText className="size-4 text-[#5f8d11]" />
                  {new Date(payment.paidAt).toLocaleString()}
                </p>
                <p className="flex items-center gap-2">
                  <CircleDollarSign className="size-4 text-[#5f8d11]" />
                  {formatMoney(payment.allocatedMinor, payment.currency)} allocated
                </p>
                <p>
                  {formatMoney(payment.adjustedMinor, payment.currency)} reversed
                  or refunded
                </p>
              </div>
            </Surface>
          ))}
        </div>
      ) : null}
    </div>
  );
}
