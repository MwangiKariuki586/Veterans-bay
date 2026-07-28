"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Surface } from "@/components/ui/surface";
import type {
  QuotationDetail,
  QuotationDraftValues,
  QuotationLineItemCategory,
} from "@/modules/quotations/types";
import {
  createQuotation,
  createQuotationRevision,
  updateQuotation,
} from "./quotation-api";
import { formatQuotationMoney } from "./quotation-view";

type FormLineItem = {
  category: QuotationLineItemCategory;
  description: string;
  quantity: string;
  unitPrice: string;
};

export function QuotationEditor({
  requestId,
  quotation,
  mode,
  onSaved,
}: {
  requestId?: string;
  quotation?: QuotationDetail;
  mode: "create" | "update" | "revision";
  onSaved?: (quotation: QuotationDetail) => void;
}) {
  const router = useRouter();
  const sourceVersion = quotation?.versions.find(
    (item) => item.versionNumber === quotation.currentVersionNumber,
  );
  const [lineItems, setLineItems] = useState<FormLineItem[]>(
    sourceVersion?.lineItems.map((item) => ({
      category: item.category,
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPriceMinor / 100),
    })) ?? [
      {
        category: "LABOUR",
        description: "",
        quantity: "1",
        unitPrice: "",
      },
    ],
  );
  const [currency, setCurrency] = useState(sourceVersion?.currency ?? "KES");
  const [discount, setDiscount] = useState(
    String((sourceVersion?.discountMinor ?? 0) / 100),
  );
  const [tax, setTax] = useState(String((sourceVersion?.taxMinor ?? 0) / 100));
  const [deposit, setDeposit] = useState(
    String((sourceVersion?.depositMinor ?? 0) / 100),
  );
  const [duration, setDuration] = useState(
    String(sourceVersion?.expectedDurationMinutes ?? 120),
  );
  const [proposedStart, setProposedStart] = useState(
    toLocalDateTime(sourceVersion?.proposedStartAt),
  );
  const [validUntil, setValidUntil] = useState(() =>
    toLocalDateTime(
      sourceVersion?.validUntil ??
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000).toISOString(),
    ),
  );
  const [scope, setScope] = useState(sourceVersion?.scope ?? "");
  const [exclusions, setExclusions] = useState(
    sourceVersion?.exclusions ?? "Only the work described in the scope is included.",
  );
  const [warrantyTerms, setWarrantyTerms] = useState(
    sourceVersion?.warrantyTerms ?? "Workmanship warranty applies to the completed scope.",
  );
  const [paymentTerms, setPaymentTerms] = useState(
    sourceVersion?.paymentTerms ?? "Balance is due after completion.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotalMinor = useMemo(
    () =>
      lineItems.reduce(
        (sum, item) =>
          sum +
          Math.max(0, Number.parseInt(item.quantity, 10) || 0) *
            moneyToMinor(item.unitPrice),
        0,
      ),
    [lineItems],
  );
  const totalMinor =
    subtotalMinor - moneyToMinor(discount) + moneyToMinor(tax);

  function updateItem(index: number, values: Partial<FormLineItem>) {
    setLineItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...values } : item,
      ),
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const values: QuotationDraftValues = {
        currency,
        lineItems: lineItems.map((item) => ({
          category: item.category,
          description: item.description.trim(),
          quantity: Number.parseInt(item.quantity, 10),
          unitPriceMinor: moneyToMinor(item.unitPrice),
        })),
        discountMinor: moneyToMinor(discount),
        taxMinor: moneyToMinor(tax),
        depositMinor: moneyToMinor(deposit),
        expectedDurationMinutes: Number.parseInt(duration, 10),
        proposedStartAt: proposedStart
          ? new Date(proposedStart).toISOString()
          : null,
        validUntil: new Date(validUntil).toISOString(),
        scope: scope.trim(),
        exclusions: exclusions.trim(),
        warrantyTerms: warrantyTerms.trim(),
        paymentTerms: paymentTerms.trim(),
      };
      const saved =
        mode === "create"
          ? await createQuotation(requiredRequestId(requestId), values)
          : mode === "revision"
            ? await createQuotationRevision(
                requiredQuotation(quotation).id,
                requiredQuotation(quotation).lockVersion,
                values,
              )
            : await updateQuotation(
                requiredQuotation(quotation).id,
                requiredQuotation(quotation).lockVersion,
                values,
              );
      onSaved?.(saved);
      router.push(`/professional/quotations/${saved.id}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Quotation could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link
        href={
          quotation
            ? `/professional/quotations/${quotation.id}`
            : requestId
              ? `/professional/enquiries/${requestId}`
              : "/professional/quotations"
        }
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" /> Back
      </Link>
      <div className="mt-5">
        <p className="text-sm font-semibold text-[#5f8d11]">
          {mode === "revision" ? "New immutable version" : "Commercial terms"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
          {mode === "create"
            ? "Prepare quotation"
            : mode === "revision"
              ? "Prepare revision"
              : "Edit draft quotation"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          Totals are calculated authoritatively by the server. Submitted versions
          become read-only.
        </p>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Quotation needs attention"
          description={error}
        />
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">Line items</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setLineItems((current) => [
                    ...current,
                    {
                      category: "LABOUR",
                      description: "",
                      quantity: "1",
                      unitPrice: "",
                    },
                  ])
                }
              >
                <Plus className="size-4" /> Add item
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  className="relative grid gap-3 rounded-2xl border border-black/8 p-4 pr-16 sm:grid-cols-2"
                >
                  <Field label="Category">
                    <select
                      value={item.category}
                      onChange={(event) =>
                        updateItem(index, {
                          category: event.target
                            .value as QuotationLineItemCategory,
                        })
                      }
                      className={controlClass}
                    >
                      <option value="LABOUR">Labour</option>
                      <option value="MATERIAL">Material</option>
                      <option value="TRANSPORT">Transport</option>
                      <option value="ADDITIONAL">Additional</option>
                    </select>
                  </Field>
                  <Field label="Description">
                    <input
                      value={item.description}
                      onChange={(event) =>
                        updateItem(index, { description: event.target.value })
                      }
                      className={controlClass}
                      required
                    />
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, { quantity: event.target.value })
                      }
                      className={controlClass}
                    />
                  </Field>
                  <Field label={`Unit price (${currency})`}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, { unitPrice: event.target.value })
                      }
                      className={controlClass}
                    />
                  </Field>
                  <button
                    type="button"
                    aria-label={`Remove line item ${index + 1}`}
                    disabled={lineItems.length === 1}
                    className="absolute right-3 top-3 grid size-11 place-items-center rounded-full text-danger hover:bg-danger-soft disabled:opacity-30"
                    onClick={() =>
                      setLineItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="grid gap-5 p-5 shadow-none sm:grid-cols-2 sm:p-6">
            <Field label="Scope">
              <textarea
                rows={6}
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Exclusions">
              <textarea
                rows={6}
                value={exclusions}
                onChange={(event) => setExclusions(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Warranty terms">
              <textarea
                rows={5}
                value={warrantyTerms}
                onChange={(event) => setWarrantyTerms(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Payment terms">
              <textarea
                rows={5}
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
                className={controlClass}
              />
            </Field>
          </Surface>
        </div>

        <aside>
          <Surface className="sticky top-5 space-y-4 p-5 shadow-none">
            <h2 className="text-lg font-bold">Pricing & timing</h2>
            <Field label="Currency">
              <input
                value={currency}
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                className={controlClass}
              />
            </Field>
            <Field label="Discount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Tax">
              <input
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(event) => setTax(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Deposit">
              <input
                type="number"
                min="0"
                step="0.01"
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Expected duration (minutes)">
              <input
                type="number"
                min="15"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Proposed start">
              <input
                type="datetime-local"
                value={proposedStart}
                onChange={(event) => setProposedStart(event.target.value)}
                className={controlClass}
              />
            </Field>
            <Field label="Valid until">
              <input
                type="datetime-local"
                required
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                className={controlClass}
              />
            </Field>
            <dl className="space-y-2 border-t border-black/8 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#68717b]">Subtotal</dt>
                <dd>{formatQuotationMoney(subtotalMinor, currency)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{formatQuotationMoney(Math.max(0, totalMinor), currency)}</dd>
              </div>
            </dl>
            <Button
              type="button"
              className="w-full"
              loading={busy}
              onClick={() => void save()}
            >
              {mode === "revision" ? "Create revision draft" : "Save draft"}
            </Button>
          </Surface>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <span className="mt-2 block font-normal">{children}</span>
    </label>
  );
}

const controlClass =
  "min-h-11 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[#8eb81d] focus:ring-2 focus:ring-[#c7f52b]/25";

function moneyToMinor(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function requiredRequestId(value?: string) {
  if (!value) throw new Error("Select an enquiry before creating a quotation.");
  return value;
}

function requiredQuotation(value?: QuotationDetail) {
  if (!value) throw new Error("Quotation details are unavailable.");
  return value;
}
