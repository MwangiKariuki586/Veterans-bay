import { buildSimplePdf, type PdfLine } from "../quotations/quotation-pdf";
import type { InvoiceDetail } from "./types";

export function createInvoicePdf(
  invoice: InvoiceDetail,
): Uint8Array<ArrayBuffer> {
  const lines: PdfLine[] = [
    { text: "VETERANS BAY", strong: true },
    { text: "INVOICE", strong: true },
    { text: `Invoice: ${invoice.invoiceNumber}` },
    { text: `Professional: ${invoice.providerName}` },
    { text: `Client: ${invoice.clientName}` },
    { text: `Service: ${invoice.serviceName}` },
    { text: `Status: ${titleCase(invoice.status)}` },
    { text: `Issued: ${formatDate(invoice.issuedAt)}` },
    { text: `Due: ${formatDate(invoice.dueAt)}` },
    { text: "" },
    { text: "LINE ITEMS", strong: true },
  ];

  for (const item of invoice.items) {
    lines.push({
      text: `${item.description} | ${titleCase(item.sourceType)} | Qty ${item.quantity} | ${formatMoney(item.totalMinor, invoice.currency)}`,
    });
  }

  lines.push(
    { text: "" },
    { text: `Subtotal: ${formatMoney(invoice.subtotalMinor, invoice.currency)}` },
    { text: `Tax: ${formatMoney(invoice.taxMinor, invoice.currency)}` },
    { text: `Invoice total: ${formatMoney(invoice.totalMinor, invoice.currency)}`, strong: true },
    { text: `Recorded payments: ${formatMoney(invoice.paidMinor, invoice.currency)}` },
    { text: `Balance due: ${formatMoney(invoice.balanceMinor, invoice.currency)}`, strong: true },
    { text: "" },
    { text: "PAYMENT HISTORY", strong: true },
  );

  if (invoice.payments.length === 0) {
    lines.push({ text: "No payments have been recorded." });
  } else {
    for (const payment of invoice.payments) {
      lines.push({
        text: `${titleCase(payment.method)} | ${formatMoney(payment.amountMinor, payment.currency)} | ${formatDate(payment.paidAt)} | ${payment.transactionReference ?? "No reference"}`,
      });
      for (const adjustment of payment.adjustments) {
        lines.push({
          text: `${titleCase(adjustment.adjustmentType)} | ${formatMoney(adjustment.amountMinor, payment.currency)} | ${formatDate(adjustment.recordedAt)} | ${adjustment.reason}`,
        });
      }
    }
  }

  lines.push(
    { text: "" },
    { text: "PAYMENT TERMS", strong: true },
    { text: invoice.paymentTermsSnapshot },
  );
  if (invoice.notes) {
    lines.push({ text: "" }, { text: "NOTES", strong: true }, { text: invoice.notes });
  }
  lines.push(
    { text: "" },
    { text: "Payments in this invoice are manual records entered by the professional." },
    { text: "Veterans Bay does not confirm or process the underlying transfer of funds." },
  );
  return buildSimplePdf(lines, "invoice");
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
