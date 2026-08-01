"use client";

import {
  CalendarClock,
  CircleDollarSign,
  FileCheck2,
  ReceiptText,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type {
  InvoiceDetail as InvoiceDetailRecord,
  PaymentMethod,
} from "@/modules/invoices/types";
import {
  adjustPayment,
  getInvoice,
  invoiceAction,
  invoiceApi,
} from "./invoice-api";
import { formatMoney } from "./invoice-list";

const selectClass =
  "min-h-11 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";
const textareaClass =
  "min-h-24 w-full resize-y rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";

export function InvoiceDetail({
  audience,
  invoiceId,
}: {
  audience: "client" | "professional";
  invoiceId: string;
}) {
  const [invoice, setInvoice] = useState<InvoiceDetailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [payment, setPayment] = useState({
    amount: "",
    method: "OTHER" as PaymentMethod,
    transactionReference: "PREVIEW-NO-FUNDS",
    notes: "Simulated preview record; no funds received.",
    paidAt: localDateTime(new Date()),
  });

  const refresh = useCallback(async () => {
    try {
      const next = await getInvoice(audience, invoiceId);
      setInvoice(next);
      setAllocations(
        Object.fromEntries(
          next.items
            .filter((item) => item.balanceMinor > 0)
            .map((item) => [item.id, String(item.balanceMinor / 100)]),
        ),
      );
      setPayment((current) => ({
        ...current,
        amount: current.amount || String(next.balanceMinor / 100),
      }));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invoice unavailable.");
    }
  }, [audience, invoiceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function run(
    key: string,
    action: () => Promise<InvoiceDetailRecord>,
    success: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      const next = await action();
      setInvoice(next);
      toast.success(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Financial action failed.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!invoice && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading invoice"
        description="Retrieving items, balances, and payment history."
      />
    );
  }
  if (!invoice) {
    return (
      <StatePanel
        variant="error"
        title="Invoice unavailable"
        description={error ?? "The invoice could not be loaded."}
      />
    );
  }

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const allocationValues = Object.entries(allocations)
      .map(([invoiceItemId, value]) => ({
        invoiceItemId,
        amountMinor: toMinor(value),
      }))
      .filter((item) => item.amountMinor > 0);
    await run(
      "payment",
      () =>
        invoiceAction(invoice.id, "payments", {
          idempotencyKey: crypto.randomUUID(),
          amountMinor: toMinor(payment.amount),
          currency: invoice.currency,
          method: payment.method,
          transactionReference: payment.transactionReference || undefined,
          notes: payment.notes || undefined,
          paidAt: new Date(payment.paidAt).toISOString(),
          allocations: allocationValues,
        }),
      "Manual payment recorded.",
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={invoice.status === "PAID" ? "success" : "trust"}>
              {invoice.status.replaceAll("_", " ")}
            </Badge>
            <span className="text-xs text-[#7a838c]">
              {invoice.invoiceNumber}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">
            {invoice.serviceName}
          </h1>
          <p className="mt-2 text-sm text-[#68717b]">
            {audience === "client" ? invoice.providerName : invoice.clientName}
          </p>
        </div>
        <Link
          href={`/${audience}/jobs/${invoice.jobId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          View completed job
        </Link>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          title="Invoice needs attention"
          description={error}
        />
      ) : null}
      <InlineAlert
        className="mt-5"
        variant="info"
        title="Manual financial record"
        description="Payments shown here were recorded by an authorised organisation member. They are not provider-confirmed M-Pesa or card transactions."
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="grid content-start gap-5">
          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Invoice items</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {invoice.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded-2xl bg-[#f6f8f8] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">{item.description}</p>
                    <p className="mt-1 text-xs text-[#68717b]">
                      {item.sourceType.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">
                      {formatMoney(item.totalMinor, invoice.currency)}
                    </p>
                    <p className="mt-1 text-xs text-[#68717b]">
                      {formatMoney(item.balanceMinor, invoice.currency)} due
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 border-t border-black/8 pt-5 text-sm">
              <MoneyRow
                label="Invoice total"
                value={formatMoney(invoice.totalMinor, invoice.currency)}
              />
              <MoneyRow
                label="Recorded payments"
                value={formatMoney(invoice.paidMinor, invoice.currency)}
              />
              <MoneyRow
                label="Balance due"
                value={formatMoney(invoice.balanceMinor, invoice.currency)}
                strong
              />
            </div>
          </Surface>

          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Payment history</h2>
            </div>
            {invoice.payments.length ? (
              <div className="mt-5 grid gap-4">
                {invoice.payments.map((item) => {
                  const available = item.allocations.reduce(
                    (sum, allocation) =>
                      sum +
                      allocation.amountMinor -
                      allocation.adjustedMinor,
                    0,
                  );
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-black/8 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Badge
                            variant={
                              item.status === "REVERSED"
                                ? "warning"
                                : "success"
                            }
                          >
                            {item.status.replaceAll("_", " ")}
                          </Badge>
                          <p className="mt-3 font-semibold">
                            {formatMoney(item.amountMinor, item.currency)} ·{" "}
                            {item.method.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-[#68717b]">
                            {new Date(item.paidAt).toLocaleString()}
                            {item.transactionReference
                              ? ` · ${item.transactionReference}`
                              : ""}
                          </p>
                        </div>
                        {item.evidenceAssetId ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void openEvidence(item.evidenceAssetId!, setError)
                            }
                          >
                            <FileCheck2 className="size-4" /> Evidence
                          </Button>
                        ) : null}
                      </div>
                      {item.adjustments.map((adjustment) => (
                        <div
                          key={adjustment.id}
                          className="mt-3 rounded-xl bg-[#fff7e8] px-3 py-2 text-xs"
                        >
                          {adjustment.adjustmentType}:{" "}
                          {formatMoney(
                            adjustment.amountMinor,
                            item.currency,
                          )}{" "}
                          · {adjustment.reason}
                        </div>
                      ))}
                      {audience === "professional" && available > 0 ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(["REVERSAL", "REFUND"] as const).map((kind) => (
                            <Button
                              key={kind}
                              type="button"
                              size="sm"
                              variant="outline"
                              loading={busy === `${kind}-${item.id}`}
                              onClick={() => {
                                const reason = window.prompt(
                                  `Reason for ${kind.toLowerCase()}`,
                                );
                                if (!reason) return;
                                void run(
                                  `${kind}-${item.id}`,
                                  () =>
                                    adjustPayment(item.id, {
                                      idempotencyKey: crypto.randomUUID(),
                                      adjustmentType: kind,
                                      amountMinor: available,
                                      reason,
                                      recordedAt: new Date().toISOString(),
                                    }),
                                  kind === "REVERSAL"
                                    ? "Payment reversal recorded."
                                    : "Refund recorded.",
                                );
                              }}
                            >
                              <RotateCcw className="size-4" />
                              {kind === "REVERSAL"
                                ? "Reverse remaining"
                                : "Record refund"}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <StatePanel
                className="mt-5"
                title="No payments recorded"
                description="Authorised manual payment records will appear here with their allocations."
              />
            )}
          </Surface>
        </div>

        <div className="grid content-start gap-5">
          <Surface className="p-5 shadow-none">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Invoice terms</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#68717b]">
              {invoice.paymentTermsSnapshot}
            </p>
            <dl className="mt-4 grid gap-3 text-sm">
              <MoneyRow
                label="Issued"
                value={
                  invoice.issuedAt
                    ? new Date(invoice.issuedAt).toLocaleDateString()
                    : "Draft"
                }
              />
              <MoneyRow
                label="Due"
                value={
                  invoice.dueAt
                    ? new Date(invoice.dueAt).toLocaleDateString()
                    : "Not set"
                }
              />
            </dl>
            {audience === "professional" && invoice.status === "DRAFT" ? (
              <Button
                className="mt-5 w-full"
                loading={busy === "issue"}
                onClick={() => {
                  const dueAt = new Date();
                  dueAt.setDate(dueAt.getDate() + 14);
                  void run(
                    "issue",
                    () =>
                      invoiceAction(invoice.id, "issue", {
                        lockVersion: invoice.lockVersion,
                        dueAt: dueAt.toISOString(),
                      }),
                    "Invoice issued.",
                  );
                }}
              >
                Issue with 14-day terms
              </Button>
            ) : null}
          </Surface>

          {audience === "professional" &&
          invoice.balanceMinor > 0 &&
          !["DRAFT", "CANCELLED", "REFUNDED"].includes(invoice.status) ? (
            <Surface className="p-5 shadow-none">
              <h2 className="font-bold">Record payment</h2>
              <p className="mt-2 text-sm leading-6 text-[#68717b]">
                Preview policy: record simulations only. Use Other, keep a
                PREVIEW- reference, and do not attach real payment evidence.
              </p>
              <form className="mt-5 grid gap-4" onSubmit={recordPayment}>
                <label className="grid gap-2 text-sm font-semibold">
                  Amount ({invoice.currency})
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={payment.amount}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Method
                  <select
                    className={selectClass}
                    value={payment.method}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        method: event.target.value as PaymentMethod,
                      }))
                    }
                  >
                    <option value="BANK_TRANSFER">Bank transfer</option>
                    <option value="M_PESA_MANUAL">M-Pesa (manual)</option>
                    <option value="CASH">Cash</option>
                    <option value="CARD_MANUAL">Card (manual)</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Payment date
                  <Input
                    type="datetime-local"
                    required
                    value={payment.paidAt}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        paidAt: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Transaction reference
                  <Input
                    value={payment.transactionReference}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        transactionReference: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid gap-3">
                  <p className="text-sm font-semibold">Item allocations</p>
                  {invoice.items
                    .filter((item) => item.balanceMinor > 0)
                    .map((item) => (
                      <label
                        key={item.id}
                        className="grid gap-2 text-xs font-semibold"
                      >
                        {item.description} ·{" "}
                        {formatMoney(item.balanceMinor, invoice.currency)} due
                        <Input
                          type="number"
                          min="0"
                          max={item.balanceMinor / 100}
                          step="0.01"
                          value={allocations[item.id] ?? ""}
                          onChange={(event) =>
                            setAllocations((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                </div>
                <label className="grid gap-2 text-sm font-semibold">
                  Notes
                  <textarea
                    className={textareaClass}
                    value={payment.notes}
                    onChange={(event) =>
                      setPayment((current) => ({
                        ...current,
                        notes: event.target.value,
                      }))
                    }
                  />
                </label>
                <Button type="submit" loading={busy === "payment"}>
                  Record simulated payment
                </Button>
              </form>
            </Surface>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#68717b]">{label}</dt>
      <dd className={strong ? "font-bold" : "font-semibold"}>{value}</dd>
    </div>
  );
}

async function openEvidence(
  assetId: string,
  setError: (message: string | null) => void,
) {
  try {
    const delivery = await invoiceApi<{ url: string }>(
      `/api/v1/storage/assets/${assetId}/delivery`,
    );
    window.open(delivery.url, "_blank", "noopener,noreferrer");
  } catch (cause) {
    setError(
      cause instanceof Error ? cause.message : "Evidence is unavailable.",
    );
  }
}

function localDateTime(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toMinor(value: string) {
  return Math.round(Number(value || 0) * 100);
}
