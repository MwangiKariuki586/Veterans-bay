import type { PageResult } from "../../platform/http/pagination";

export const invoiceStatuses = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
  "REFUNDED",
] as const;

export const paymentMethods = [
  "CASH",
  "BANK_TRANSFER",
  "M_PESA_MANUAL",
  "CARD_MANUAL",
  "CHEQUE",
  "OTHER",
] as const;

export type InvoiceStatus = (typeof invoiceStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type InvoiceBucket = "outstanding" | "overdue" | "settled" | "drafts";
export type InvoiceSort =
  | "updated_desc"
  | "updated_asc"
  | "due_asc"
  | "due_desc"
  | "balance_desc"
  | "balance_asc";

export interface InvoiceSummaryStats {
  total: number;
  outstanding: number;
  overdue: number;
  paid: number;
  drafts: number;
  settled: number;
  amounts: InvoiceCurrencySummary[];
}

export interface InvoiceCurrencySummary {
  currency: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
}

export interface InvoicePage extends PageResult<InvoiceSummary> {
  summary: InvoiceSummaryStats;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  jobId: string;
  bookingId: string | null;
  serviceName: string;
  providerName: string;
  clientName: string;
  status: InvoiceStatus;
  currency: string;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  issuedAt: string | null;
  dueAt: string | null;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  sourceType: "JOB_BASE" | "JOB_VARIATION" | "CUSTOM";
  description: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
}

export interface PaymentAllocation {
  id: string;
  invoiceItemId: string;
  amountMinor: number;
  adjustedMinor: number;
}

export interface PaymentAdjustment {
  id: string;
  adjustmentType: "REVERSAL" | "REFUND";
  amountMinor: number;
  reason: string;
  transactionReference: string | null;
  evidenceAssetId: string | null;
  recordedAt: string;
}

export interface PaymentRecord {
  id: string;
  status: "RECORDED" | "PARTIALLY_ALLOCATED" | "ALLOCATED" | "REVERSED";
  amountMinor: number;
  currency: string;
  method: PaymentMethod;
  transactionReference: string | null;
  notes: string | null;
  evidenceAssetId: string | null;
  paidAt: string;
  createdAt: string;
  allocations: PaymentAllocation[];
  adjustments: PaymentAdjustment[];
}

export interface InvoiceDetail extends InvoiceSummary {
  organisationId: string;
  clientAccountId: string;
  subtotalMinor: number;
  taxMinor: number;
  notes: string | null;
  paymentTermsSnapshot: string;
  lockVersion: number;
  items: InvoiceItem[];
  payments: PaymentRecord[];
}

export interface PaymentSummary {
  id: string;
  clientName: string;
  amountMinor: number;
  allocatedMinor: number;
  adjustedMinor: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentRecord["status"];
  transactionReference: string | null;
  paidAt: string;
}
