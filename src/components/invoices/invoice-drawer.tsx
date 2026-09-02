"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  Check,
  Download,
  FileText,
  ReceiptText,
  UserRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type {
  InvoiceDetail,
  InvoiceStatus,
  InvoiceSummary,
  PaymentRecord,
} from "@/modules/invoices/types";
import { getInvoice } from "./invoice-api";
import { formatMoney } from "./invoice-list";

type Audience = "client" | "professional";

const statusMeta: Record<InvoiceStatus, { label: string; variant: "neutral" | "trust" | "info" | "success" | "warning" | "danger" }> = {
  DRAFT: { label: "Draft", variant: "warning" },
  ISSUED: { label: "Awaiting payment", variant: "trust" },
  PARTIALLY_PAID: { label: "Partially paid", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  REFUNDED: { label: "Refunded", variant: "info" },
};

export function InvoiceDrawer({
  audience,
  selected,
  onClose,
}: {
  audience: Audience;
  selected: { id: string; placeholder?: InvoiceSummary };
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["invoice", audience, selected.id],
    queryFn: ({ signal }) => getInvoice(audience, selected.id, signal),
  });
  const invoice = detailQuery.data;
  const summary = invoice ?? selected.placeholder;
  const serviceHref = summary
    ? audience === "client" && summary.bookingId
      ? `/client/bookings/${summary.bookingId}#service-progress`
      : `/${audience}/jobs/${summary.jobId}`
    : `/${audience}`;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0"
        aria-describedby="invoice-drawer-description"
      >
        <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]">
              <FileText className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-semibold tracking-title">
                    {summary?.serviceName ?? "Invoice"}
                  </SheetTitle>
                  <SheetDescription id="invoice-drawer-description" className="mt-1 text-[0.68rem] text-muted-foreground">
                    {summary ? `${summary.invoiceNumber} · ${summary.providerName}` : "Retrieving the latest financial record."}
                  </SheetDescription>
                </div>
                {summary ? <Badge variant={statusMeta[summary.status].variant}>{statusMeta[summary.status].label}</Badge> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {detailQuery.isError ? (
            <InlineAlert
              variant="error"
              title="Invoice unavailable"
              description={detailQuery.error instanceof Error ? detailQuery.error.message : "The invoice could not be loaded."}
            />
          ) : invoice ? (
            <div className="space-y-4">
              <DrawerSection number="1" title="Financial summary">
                <div className="grid grid-cols-2 divide-x divide-y divide-black/7 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] sm:grid-cols-4 sm:divide-y-0">
                  <SummaryMetric icon={WalletCards} label="Total" value={formatMoney(invoice.totalMinor, invoice.currency)} />
                  <SummaryMetric icon={Banknote} label="Paid" value={formatMoney(invoice.paidMinor, invoice.currency)} success={invoice.paidMinor > 0} />
                  <SummaryMetric icon={ReceiptText} label="Balance due" value={formatMoney(invoice.balanceMinor, invoice.currency)} danger={invoice.status === "OVERDUE"} />
                  <SummaryMetric icon={CalendarClock} label="Due date" value={invoice.dueAt ? formatDate(invoice.dueAt) : "Not issued"} />
                </div>
              </DrawerSection>

              <DrawerSection number="2" title="Related service">
                <dl className="grid grid-cols-2 overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <DrawerDetail label="Booking reference" value={invoice.bookingId ? bookingReference(invoice.bookingId) : "Not linked"} />
                  <DrawerDetail label="Client" value={invoice.clientName} icon={UserRound} />
                  <DrawerDetail label="Professional" value={invoice.providerName} icon={UserRound} />
                  <DrawerDetail label="Invoice date" value={invoice.issuedAt ? formatDate(invoice.issuedAt) : "Draft"} icon={CalendarClock} />
                </dl>
              </DrawerSection>

              <DrawerSection number="3" title="Line items">
                <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div className="grid grid-cols-[minmax(0,1fr)_44px_100px] gap-2 border-b border-black/7 bg-[#fbfcfd] px-3 py-2 text-[0.62rem] font-semibold text-muted-foreground">
                    <span>Description</span><span className="text-center">Qty</span><span className="text-right">Amount</span>
                  </div>
                  {invoice.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_44px_100px] gap-2 border-b border-black/6 px-3 py-2.5 text-[0.68rem] last:border-b-0">
                      <span className="min-w-0"><span className="block font-medium text-foreground">{item.description}</span><span className="mt-0.5 block text-[0.61rem] text-muted-foreground">{sourceLabel(item.sourceType)}</span></span>
                      <span className="text-center text-muted-foreground numeric-tabular">{item.quantity}</span>
                      <span className="text-right font-medium numeric-tabular">{formatMoney(item.totalMinor, invoice.currency)}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-black/8 px-3 py-2.5 text-[0.7rem] font-semibold">
                    <span className="text-right">Total</span><span className="min-w-[100px] text-right numeric-tabular">{formatMoney(invoice.totalMinor, invoice.currency)}</span>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection number="4" title="Payment history">
                <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  {invoice.payments.length ? invoice.payments.map((payment) => <PaymentRow key={payment.id} payment={payment} />) : (
                    <p className="px-3 py-4 text-[0.68rem] text-muted-foreground">No payment has been recorded for this invoice.</p>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-black/8 bg-[#fbfcfd] px-3 py-2.5 text-[0.7rem] font-semibold">
                    <span>Remaining balance</span><span className="numeric-tabular">{formatMoney(invoice.balanceMinor, invoice.currency)}</span>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection number="5" title="Timeline / status">
                <div className="rounded-[12px] border border-black/8 bg-white px-3 py-1 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  {timeline(invoice).map((event, index, events) => (
                    <div key={`${event.title}-${event.date}`} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 py-2.5 text-[0.65rem]">
                      <span className="relative mt-0.5 grid size-4 place-items-center rounded-full bg-[#5f8d11] text-white">
                        <Check className="size-2.5" aria-hidden="true" />
                        {index < events.length - 1 ? <span className="absolute left-1/2 top-4 h-[calc(100%+10px)] w-px -translate-x-1/2 bg-black/10" /> : null}
                      </span>
                      <span><span className="font-medium text-foreground">{event.title}</span><span className="ml-2 text-muted-foreground">{event.detail}</span><span className="mt-0.5 block text-[0.6rem] text-muted-foreground">{event.date}</span></span>
                    </div>
                  ))}
                </div>
              </DrawerSection>

              <DrawerSection number="6" title="Notes & payment terms">
                <div className="space-y-2 rounded-[12px] border border-black/8 bg-white p-3 text-[0.66rem] leading-5 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <p><span className="font-semibold text-foreground">Payment terms: </span>{invoice.paymentTermsSnapshot}</p>
                  {invoice.notes ? <p><span className="font-semibold text-foreground">Invoice note: </span>{invoice.notes}</p> : null}
                  <p className="rounded-[9px] bg-[#eef4ff] px-3 py-2 text-[#40536a]">Payments shown here are manual records entered by the professional. Veterans Bay does not confirm or process the underlying transfer of funds.</p>
                </div>
              </DrawerSection>
            </div>
          ) : (
            <InvoiceDrawerSkeleton />
          )}
        </div>

        {summary ? (
          <div className="shrink-0 border-t border-black/8 bg-white px-4 py-3 sm:px-5">
            <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
              <a href={`/api/v1/${audience}/invoices/${summary.id}/download`} className={buttonVariants({ className: "w-full" })}>
                <Download className="size-4" aria-hidden="true" /> Download invoice
              </a>
              <Link href={serviceHref} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                <ReceiptText className="size-4" aria-hidden="true" />
                {audience === "client" ? "View service record" : "Open completed job"}
              </Link>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-2 text-[0.68rem] font-semibold text-foreground">{number}. {title}</h3>{children}</section>;
}

function SummaryMetric({ icon: Icon, label, value, success, danger }: { icon: typeof WalletCards; label: string; value: string; success?: boolean; danger?: boolean }) {
  return <div className="min-w-0 px-3 py-3"><span className="flex items-center gap-1.5 text-[0.61rem] text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</span><span className={cn("mt-1.5 block truncate text-[0.72rem] font-semibold numeric-tabular", success && "text-[#4e8f12]", danger && "text-danger")}>{value}</span></div>;
}

function DrawerDetail({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof UserRound }) {
  return <div className="min-w-0 border-b border-r border-black/7 px-3 py-2.5 even:border-r-0"><dt className="flex items-center gap-1.5 text-[0.6rem] text-muted-foreground">{Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}{label}</dt><dd className="mt-1 truncate text-[0.68rem] font-medium text-foreground">{value}</dd></div>;
}

function PaymentRow({ payment }: { payment: PaymentRecord }) {
  const adjustedMinor = payment.adjustments.reduce((total, adjustment) => total + adjustment.amountMinor, 0);
  return <div className="flex items-start justify-between gap-3 border-b border-black/6 px-3 py-3 last:border-b-0"><div className="min-w-0"><p className="text-[0.68rem] font-medium text-foreground">{paymentMethodLabel(payment.method)}</p><p className="mt-0.5 truncate text-[0.61rem] text-muted-foreground">{formatDate(payment.paidAt)} · Recorded by professional{payment.transactionReference ? ` · ${payment.transactionReference}` : ""}</p>{adjustedMinor ? <p className="mt-1 text-[0.61rem] text-danger">{formatMoney(adjustedMinor, payment.currency)} reversed or refunded</p> : null}</div><span className="shrink-0 text-[0.7rem] font-semibold text-[#4e8f12] numeric-tabular">{formatMoney(payment.amountMinor - adjustedMinor, payment.currency)}</span></div>;
}

function timeline(invoice: InvoiceDetail) {
  const events: Array<{ title: string; detail: string; date: string }> = [];
  if (invoice.issuedAt) events.push({ title: "Invoice issued", detail: "Sent to client", date: formatDate(invoice.issuedAt) });
  for (const payment of [...invoice.payments].reverse()) events.push({ title: "Payment recorded", detail: `${paymentMethodLabel(payment.method)} · ${formatMoney(payment.amountMinor, payment.currency)}`, date: formatDate(payment.paidAt) });
  if (invoice.dueAt && invoice.balanceMinor > 0) events.push({ title: invoice.status === "OVERDUE" ? "Payment overdue" : "Payment due", detail: formatMoney(invoice.balanceMinor, invoice.currency), date: formatDate(invoice.dueAt) });
  if (["PAID", "REFUNDED", "CANCELLED"].includes(invoice.status)) events.push({ title: statusMeta[invoice.status].label, detail: "Current invoice status", date: formatDate(invoice.updatedAt) });
  if (events.length === 0) events.push({ title: "Draft prepared", detail: "Not yet issued", date: formatDate(invoice.updatedAt) });
  return events;
}

function InvoiceDrawerSkeleton() {
  return <div className="space-y-4" aria-busy="true">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className={cn("rounded-[12px]", index === 2 ? "h-40" : "h-24")} />)}</div>;
}

function bookingReference(id: string) { return `BK-${id.slice(-6).toUpperCase()}`; }
function sourceLabel(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function paymentMethodLabel(value: string) { return value === "M_PESA_MANUAL" ? "M-PESA manual record" : sourceLabel(value); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)); }
