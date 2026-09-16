import type {
  QuotationDraftValues,
  QuotationLineItemCategory,
} from "./types";

export interface QuotationTotals {
  labourMinor: number;
  materialsMinor: number;
  transportMinor: number;
  additionalChargesMinor: number;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositMinor: number;
}

export function calculateQuotationTotals(
  values: Pick<
    QuotationDraftValues,
    "lineItems" | "discountMinor" | "taxMinor" | "depositMinor"
  >,
): QuotationTotals {
  const categoryTotals: Record<QuotationLineItemCategory, number> = {
    LABOUR: 0,
    MATERIAL: 0,
    TRANSPORT: 0,
    ADDITIONAL: 0,
  };

  for (const item of values.lineItems) {
    const lineTotal = safeMoneyProduct(item.quantity, item.unitPriceMinor);
    categoryTotals[item.category] = safeMoneySum(
      categoryTotals[item.category],
      lineTotal,
    );
  }

  const subtotalMinor = Object.values(categoryTotals).reduce(
    safeMoneySum,
    0,
  );
  if (values.discountMinor > subtotalMinor) {
    throw new Error("QUOTATION_DISCOUNT_EXCEEDS_SUBTOTAL");
  }
  const totalMinor = safeMoneySum(
    subtotalMinor - values.discountMinor,
    values.taxMinor,
  );
  if (values.depositMinor > totalMinor) {
    throw new Error("QUOTATION_DEPOSIT_EXCEEDS_TOTAL");
  }

  return {
    labourMinor: categoryTotals.LABOUR,
    materialsMinor: categoryTotals.MATERIAL,
    transportMinor: categoryTotals.TRANSPORT,
    additionalChargesMinor: categoryTotals.ADDITIONAL,
    subtotalMinor,
    discountMinor: values.discountMinor,
    taxMinor: values.taxMinor,
    totalMinor,
    depositMinor: values.depositMinor,
  };
}

function safeMoneyProduct(quantity: number, unitPriceMinor: number): number {
  const result = quantity * unitPriceMinor;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("QUOTATION_AMOUNT_OUT_OF_RANGE");
  }
  return result;
}

function safeMoneySum(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error("QUOTATION_AMOUNT_OUT_OF_RANGE");
  }
  return result;
}
