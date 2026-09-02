"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileClock,
  FileText,
  ReceiptText,
  Search,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumnDef } from "@/components/ui/data-table";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import {
  invoiceStatuses,
  type InvoiceBucket,
  type InvoiceSort,
  type InvoiceStatus,
  type InvoiceSummary,
  type InvoiceSummaryStats,
} from "@/modules/invoices/types";
import { listInvoicesPage, type InvoiceListQuery } from "./invoice-api";
import { InvoiceDrawer } from "./invoice-drawer";

type Audience = "client" | "professional";
type SelectedInvoice = { id: string; placeholder?: InvoiceSummary };
type StatusVariant = "neutral" | "trust" | "info" | "success" | "warning" | "danger";

const SEARCH_DEBOUNCE_MS = 160;
const defaultQuery: InvoiceListQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  status: "",
  search: "",
  sort: "updated_desc",
};
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const statusMeta: Record<InvoiceStatus, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: "Draft", variant: "warning" },
  ISSUED: { label: "Awaiting payment", variant: "trust" },
  PARTIALLY_PAID: { label: "Partially paid", variant: "warning" },
  PAID: { label: "Paid", variant: "success" },
  OVERDUE: { label: "Overdue", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  REFUNDED: { label: "Refunded", variant: "info" },
};

const professionalTabs: Array<{
  value: "all" | InvoiceBucket;
  label: string;
  count?: keyof Pick<InvoiceSummaryStats, "drafts" | "outstanding" | "overdue" | "settled">;
}> = [
  { value: "all", label: "All" },
  { value: "drafts", label: "Drafts", count: "drafts" },
  { value: "outstanding", label: "Outstanding", count: "outstanding" },
  { value: "overdue", label: "Overdue", count: "overdue" },
  { value: "settled", label: "Settled", count: "settled" },
];

const clientTabs: typeof professionalTabs = [
  { value: "all", label: "All" },
  { value: "outstanding", label: "To pay", count: "outstanding" },
  { value: "overdue", label: "Overdue", count: "overdue" },
  { value: "settled", label: "Paid & refunded", count: "settled" },
];

export function InvoiceList({ audience }: { audience: Audience }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryState, setQueryState] = useState<InvoiceListQuery>(() =>
    queryFromParams(searchParams, audience),
  );
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedInvoice | null>(() => {
    const invoiceId = searchParams.get("invoiceId");
    return invoiceId ? { id: invoiceId } : null;
  });

  const updateParams = useCallback(
    (changes: Partial<InvoiceListQuery>, resetPage = true) => {
      const next = {
        ...queryState,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? queryState.page),
      };
      setQueryState(next);
      replaceUrl(pathname, queryString(next, selected?.id));
    },
    [pathname, queryState, selected?.id],
  );

  useEffect(() => {
    const normalized = search.trim();
    if (normalized === queryState.search) return;
    const timeout = window.setTimeout(
      () => updateParams({ search: normalized }),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [queryState.search, search, updateParams]);

  const invoiceQuery = useQuery({
    queryKey: ["invoices", audience, queryState],
    queryFn: ({ signal }) => listInvoicesPage(audience, queryState, signal),
    placeholderData: keepPreviousData,
  });
  const result = invoiceQuery.data;
  const searchPending = search.trim() !== queryState.search;
  const showProgress = searchPending || (invoiceQuery.isFetching && invoiceQuery.isPlaceholderData);
  useWorkspaceContentReady(!invoiceQuery.isPending);

  const openInvoice = useCallback(
    (invoice: InvoiceSummary) => {
      setSelected({ id: invoice.id, placeholder: invoice });
      replaceUrl(pathname, queryString(queryState, invoice.id));
    },
    [pathname, queryState],
  );
  const closeInvoice = useCallback(() => {
    setSelected(null);
    replaceUrl(pathname, queryString(queryState));
  }, [pathname, queryState]);

  const columns = useMemo<DataTableColumnDef<InvoiceSummary, unknown>[]>(
    () => [
      { id: "invoice", header: "Invoice", cell: ({ row }) => <InvoiceIdentity invoice={row.original} /> },
      {
        id: "counterparty",
        header: audience === "client" ? "Professional" : "Client",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {audience === "client" ? row.original.providerName : row.original.clientName}
          </span>
        ),
      },
      { id: "status", header: "Status", cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} /> },
      { id: "due", header: "Due date", cell: ({ row }) => <DueDate invoice={row.original} /> },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => <span className="font-medium numeric-tabular">{formatMoney(row.original.totalMinor, row.original.currency)}</span>,
      },
      { id: "balance", header: "Balance", cell: ({ row }) => <Balance invoice={row.original} /> },
      {
        id: "updated",
        header: "Updated",
        cell: ({ row }) => <span className="text-muted-foreground">{formatShortDate(row.original.updatedAt)}</span>,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <button type="button" onClick={() => openInvoice(row.original)} className="font-semibold text-trust transition-colors hover:text-foreground">
            {row.original.balanceMinor > 0 ? "Review" : "View record"}
          </button>
        ),
      },
    ],
    [audience, openInvoice],
  );

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, queryString(defaultQuery, selected?.id));
  };

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6b9f16]">
            {audience === "client" ? "Financial records" : "Accounts workspace"}
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">
            {audience === "client" ? "Your invoices" : "Invoices"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
            {audience === "client"
              ? "See what was charged, what your professional recorded as paid, and any balance still due."
              : "Track drafts, outstanding balances, due dates, and auditable payment records from completed work."}
          </p>
        </div>
        {audience === "professional" ? (
          <Link href="/professional/payments" className={buttonVariants({ variant: "outline" })}>
            <ReceiptText className="size-4" aria-hidden="true" />
            Payment ledger
          </Link>
        ) : null}
      </header>

      {invoiceQuery.isPending ? (
        <InvoiceListSkeleton />
      ) : invoiceQuery.isError ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Invoices unavailable"
          description={invoiceQuery.error instanceof Error ? invoiceQuery.error.message : "Invoices could not be loaded."}
        />
      ) : result ? (
        <>
          <InvoiceMetrics audience={audience} summary={result.summary} />
          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Invoice status views">
            {(audience === "client" ? clientTabs : professionalTabs).map((tab) => {
              const active = queryState.bucket === tab.value;
              const count = tab.count ? result.summary[tab.count] : null;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateParams({ bucket: tab.value, status: "" })}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition",
                    active ? "border-[#83b72c] text-[#426d08]" : "border-transparent text-[#536170] hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                  aria-label={count === null ? tab.label : `${tab.label}: ${count}`}
                >
                  {tab.label}
                  {count !== null ? (
                    <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">{count}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <section
            className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]"
            aria-label={audience === "client" ? "Client invoices" : "Professional invoices"}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[300px]">
                <span className="sr-only">Search invoices</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder={audience === "client" ? "Search invoice, service or professional..." : "Search invoice, service or client..."}
                />
              </label>
              <label>
                <span className="sr-only">Filter invoices by status</span>
                <select
                  value={queryState.status}
                  onChange={(event) => updateParams({ status: event.target.value as "" | InvoiceStatus, bucket: "all" })}
                  className={selectClass}
                >
                  <option value="">All statuses</option>
                  {invoiceStatuses
                    .filter((status) => audience === "professional" || status !== "DRAFT")
                    .map((status) => <option key={status} value={status}>{statusMeta[status].label}</option>)}
                </select>
              </label>
              <label>
                <span className="sr-only">Sort invoices</span>
                <select value={queryState.sort} onChange={(event) => updateParams({ sort: event.target.value as InvoiceSort })} className={selectClass}>
                  <option value="updated_desc">Recently updated</option>
                  <option value="updated_asc">Oldest updated</option>
                  <option value="due_asc">Due soonest</option>
                  <option value="due_desc">Due latest</option>
                  <option value="balance_desc">Highest balance</option>
                  <option value="balance_asc">Lowest balance</option>
                </select>
              </label>
              {showProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating invoices…
                </span>
              ) : null}
              <button type="button" onClick={clearFilters} className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted">
                Clear filters
              </button>
            </div>

            <div className="relative" aria-busy={showProgress}>
              <DataTable
                columns={columns}
                data={result.items}
                getRowId={(row) => row.id}
                getRowLabel={(row) => `View invoice ${row.invoiceNumber}`}
                onRowClick={openInvoice}
                mobileRow={(row) => <InvoiceMobileCard invoice={row} audience={audience} onOpen={openInvoice} />}
                empty={
                  <StatePanel
                    className="m-4 border-dashed shadow-none"
                    title={result.summary.total === 0 ? (audience === "professional" ? "No invoices yet" : "No invoices available") : "No invoices match these filters"}
                    description={
                      result.summary.total === 0
                        ? audience === "professional"
                          ? "Create an invoice from an eligible completed job to begin its financial record."
                          : "Issued invoices and their recorded payments will appear here."
                        : "Clear a filter or try a different search."
                    }
                  >
                    {result.summary.total > 0 ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : null}
                  </StatePanel>
                }
              />
            </div>
            <InvoicePagination
              page={result.page}
              pageSize={result.pageSize}
              totalItems={result.totalItems}
              totalPages={result.totalPages}
              onPage={(page) => updateParams({ page }, false)}
              onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)}
            />
          </section>
          {selected ? (
            <InvoiceDrawer audience={audience} selected={selected} onClose={closeInvoice} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function InvoiceMetrics({ audience, summary }: { audience: Audience; summary: InvoiceSummaryStats }) {
  const base = `/${audience}/invoices`;
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Invoice summary">
      <WorkspaceMetricCard
        icon={audience === "client" ? FileText : WalletCards}
        tone="green"
        label={audience === "client" ? "Total invoices" : "Outstanding balance"}
        value={audience === "client" ? summary.total : formatSummaryMoney(summary, "outstandingMinor")}
        hint={audience === "client" ? "Your complete financial record" : `${summary.outstanding} open invoice${summary.outstanding === 1 ? "" : "s"}`}
        href={base}
        action="View all"
      />
      <WorkspaceMetricCard
        icon={CircleAlert}
        tone="orange"
        label="Overdue invoices"
        value={summary.overdue}
        hint={summary.overdue ? "Requires attention" : "Nothing overdue"}
        hintTone={summary.overdue ? "danger" : "muted"}
        href={`${base}?bucket=overdue`}
        action="Review overdue"
      />
      <WorkspaceMetricCard
        icon={audience === "client" ? Banknote : FileClock}
        tone="blue"
        label={audience === "client" ? "Balance remaining" : "Draft invoices"}
        value={audience === "client" ? formatSummaryMoney(summary, "outstandingMinor") : summary.drafts}
        hint={audience === "client" ? (summary.outstanding ? `${summary.outstanding} invoice${summary.outstanding === 1 ? "" : "s"} still open` : "No balance remaining") : "Ready to review and issue"}
        href={`${base}?bucket=${audience === "client" ? "outstanding" : "drafts"}`}
        action={audience === "client" ? "View balances" : "Review drafts"}
      />
      <WorkspaceMetricCard
        icon={CheckCircle2}
        tone="purple"
        label="Payments recorded"
        value={formatSummaryMoney(summary, "paidMinor")}
        hint="Manual financial records"
        href={audience === "professional" ? "/professional/payments" : `${base}?bucket=settled`}
        action={audience === "professional" ? "Open ledger" : "View settled"}
      />
    </section>
  );
}

function InvoiceIdentity({ invoice }: { invoice: InvoiceSummary }) {
  return (
    <div className="min-w-[190px]">
      <p className="font-semibold text-foreground">{invoice.serviceName}</p>
      <p className="mt-0.5 text-[0.67rem] text-muted-foreground">{invoice.invoiceNumber}</p>
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = statusMeta[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function DueDate({ invoice }: { invoice: InvoiceSummary }) {
  if (!invoice.dueAt) return <span className="text-muted-foreground">Not issued</span>;
  const overdue = invoice.status === "OVERDUE";
  return (
    <span className={cn("block", overdue ? "text-danger" : "text-foreground")}>
      <span className="block font-medium">{formatShortDate(invoice.dueAt)}</span>
      <span className="mt-0.5 block text-[0.64rem] text-muted-foreground">{overdue ? "Past due" : "Payment due"}</span>
    </span>
  );
}

function Balance({ invoice }: { invoice: InvoiceSummary }) {
  return (
    <span className="block min-w-[110px]">
      <span className={cn("block font-semibold numeric-tabular", invoice.status === "OVERDUE" ? "text-danger" : "text-foreground")}>
        {formatMoney(invoice.balanceMinor, invoice.currency)}
      </span>
      <span className="mt-0.5 block text-[0.64rem] text-muted-foreground">{formatMoney(invoice.paidMinor, invoice.currency)} recorded</span>
    </span>
  );
}

function InvoiceMobileCard({ invoice, audience, onOpen }: { invoice: InvoiceSummary; audience: Audience; onOpen: (invoice: InvoiceSummary) => void }) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3"><InvoiceIdentity invoice={invoice} /><InvoiceStatusBadge status={invoice.status} /></div>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        {audience === "client" ? "Professional" : "Client"}
        <span className="ml-2 font-medium text-foreground">{audience === "client" ? invoice.providerName : invoice.clientName}</span>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-black/6 py-3">
        <div>
          <p className="text-[0.64rem] text-muted-foreground">Balance</p>
          <p className={cn("mt-1 text-sm font-semibold numeric-tabular", invoice.status === "OVERDUE" && "text-danger")}>{formatMoney(invoice.balanceMinor, invoice.currency)}</p>
        </div>
        <div>
          <p className="text-[0.64rem] text-muted-foreground">Due date</p>
          <p className="mt-1 text-sm font-medium">{invoice.dueAt ? formatShortDate(invoice.dueAt) : "Not issued"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[0.67rem] text-muted-foreground">{formatMoney(invoice.paidMinor, invoice.currency)} recorded</span>
        <button type="button" onClick={() => onOpen(invoice)} className="text-[0.7rem] font-semibold text-trust transition-colors hover:text-foreground">View invoice</button>
      </div>
    </article>
  );
}

function InvoicePagination({ page, pageSize, totalItems, totalPages, onPage, onPageSize }: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3 text-[0.68rem] text-muted-foreground">
      <span>Showing {from}–{to} of {totalItems}</span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className="h-9 rounded-[9px] border border-black/8 bg-white px-2 text-[0.68rem] font-medium text-foreground outline-none focus:border-ring">
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <Button type="button" size="icon" variant="outline" className="size-9 min-h-9" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous invoice page"><ChevronLeft className="size-4" /></Button>
        <span className="min-w-16 text-center font-medium text-foreground">{page} / {totalPages}</span>
        <Button type="button" size="icon" variant="outline" className="size-9 min-h-9" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next invoice page"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}

function InvoiceListSkeleton() {
  return (
    <div className="mt-4" aria-busy="true" aria-label="Loading invoices">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-[16px]" />)}</div>
      <Skeleton className="mt-3 h-10 rounded-none" />
      <Skeleton className="mt-2 h-[330px] rounded-[15px]" />
    </div>
  );
}

function queryFromParams(searchParams: URLSearchParams, audience: Audience): InvoiceListQuery {
  const bucketValues: Array<"all" | InvoiceBucket> = ["all", "outstanding", "overdue", "settled", "drafts"];
  const sortValues: InvoiceSort[] = ["updated_desc", "updated_asc", "due_asc", "due_desc", "balance_desc", "balance_asc"];
  const rawBucket = searchParams.get("bucket");
  const rawStatus = searchParams.get("status");
  const rawSort = searchParams.get("sort");
  const bucket = bucketValues.includes(rawBucket as "all" | InvoiceBucket) ? (rawBucket as "all" | InvoiceBucket) : "all";
  return {
    page: positiveNumber(searchParams.get("page"), 1),
    pageSize: Math.min(50, positiveNumber(searchParams.get("pageSize"), 10)),
    bucket: audience === "client" && bucket === "drafts" ? "all" : bucket,
    status: invoiceStatuses.includes(rawStatus as InvoiceStatus) && !(audience === "client" && rawStatus === "DRAFT") ? (rawStatus as InvoiceStatus) : "",
    search: searchParams.get("search")?.slice(0, 120) ?? "",
    sort: sortValues.includes(rawSort as InvoiceSort) ? (rawSort as InvoiceSort) : "updated_desc",
  };
}

function queryString(query: InvoiceListQuery, invoiceId?: string) {
  const params = new URLSearchParams();
  if (query.page > 1) params.set("page", String(query.page));
  if (query.pageSize !== 10) params.set("pageSize", String(query.pageSize));
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.sort !== "updated_desc") params.set("sort", query.sort);
  if (invoiceId) params.set("invoiceId", invoiceId);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

function positiveNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatSummaryMoney(
  summary: InvoiceSummaryStats,
  field: "paidMinor" | "outstandingMinor",
) {
  if (summary.amounts.length === 0) return "—";
  if (summary.amounts.length > 1) return `${summary.amounts.length} currencies`;
  const amount = summary.amounts[0]!;
  return formatMoney(amount[field], amount.currency);
}

export function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amountMinor / 100);
}
