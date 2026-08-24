"use client";

import { CalendarClock, CircleDollarSign, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import {
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import { cn } from "@/lib/utils";
import {
  invoiceStatuses,
  type InvoiceStatus,
  type InvoiceSummary,
} from "@/modules/invoices/types";
import { listInvoices } from "./invoice-api";

export function InvoiceList({
  audience,
}: {
  audience: "client" | "professional";
}) {
  const [status, setStatus] = useState<InvoiceStatus | "ALL">("ALL");
  const cacheKey = `${audience}:${status}`;
  const [items, setItems] = useState<InvoiceSummary[] | null>(() =>
    getCachedResource<InvoiceSummary[]>("invoices-list", cacheKey),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hit = getCachedResource<InvoiceSummary[]>(
      "invoices-list",
      `${audience}:${status}`,
    );
    if (hit) setItems(hit);
    else setItems(null);

    void listInvoices(audience, status === "ALL" ? undefined : status)
      .then((result) => {
        setCachedResource(
          "invoices-list",
          `${audience}:${status}`,
          result.items,
        );
        setItems(result.items);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Invoices unavailable.",
        ),
      );
  }, [audience, status]);

  return (
    <div>
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">
          Financial records
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-title">
          {audience === "client" ? "My invoices" : "Invoices"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          {audience === "client"
            ? "Review issued amounts, manually recorded payments, and the remaining balance."
            : "Issue auditable invoices and keep manual payments, allocations, and reversals clear."}
        </p>
      </div>
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Invoice status filter"
      >
        {(["ALL", ...invoiceStatuses] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setStatus(item);
            }}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold",
              status === item
                ? "border-[#8eb81d] bg-[#eff9c9]"
                : "border-black/8 bg-white text-[#68717b]",
            )}
          >
            {item === "ALL" ? "All" : item.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {error ? (
        <InlineAlert
          className="mt-5"
          title="Invoices need attention"
          description={error}
        />
      ) : null}
      {!items && !error ? (
        <div className="mt-5 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : null}
      {items?.length === 0 ? (
        <StatePanel
          className="mt-5"
          title="No invoices in this view"
          description={
            status === "ALL"
              ? audience === "professional"
                ? "Create an invoice from a completed job to start the financial record."
                : "Issued invoices will appear here."
              : "Choose another status to see the rest of the invoices."
          }
        />
      ) : null}
      {items?.length ? (
        <div className="mt-5 grid gap-4">
          {items.map((invoice) => (
            <Link
              key={invoice.id}
              href={`/${audience}/invoices/${invoice.id}`}
              className="rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Surface className="p-5 shadow-none transition-colors hover:border-[#b5d657] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge variant={statusVariant(invoice.status)}>
                      {invoice.status.replaceAll("_", " ")}
                    </Badge>
                    <h2 className="mt-3 text-lg font-semibold">
                      {invoice.serviceName}
                    </h2>
                    <p className="mt-1 text-sm text-[#68717b]">
                      {invoice.invoiceNumber} ·{" "}
                      {audience === "client"
                        ? invoice.providerName
                        : invoice.clientName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {formatMoney(invoice.totalMinor, invoice.currency)}
                    </p>
                    <p className="mt-1 text-xs text-[#68717b]">
                      {formatMoney(invoice.balanceMinor, invoice.currency)} due
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-[#59646e] sm:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <ReceiptText className="size-4 text-[#5f8d11]" />
                    Manual payment record
                  </p>
                  <p className="flex items-center gap-2">
                    <CircleDollarSign className="size-4 text-[#5f8d11]" />
                    {formatMoney(invoice.paidMinor, invoice.currency)} recorded
                  </p>
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-[#5f8d11]" />
                    {invoice.dueAt
                      ? `Due ${new Date(invoice.dueAt).toLocaleDateString()}`
                      : "Not issued"}
                  </p>
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function statusVariant(status: InvoiceStatus) {
  if (status === "PAID") return "success" as const;
  if (status === "PARTIALLY_PAID" || status === "DRAFT")
    return "warning" as const;
  if (status === "OVERDUE") return "danger" as const;
  if (status === "REFUNDED") return "info" as const;
  if (status === "CANCELLED") return "neutral" as const;
  return "trust" as const;
}

export function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
