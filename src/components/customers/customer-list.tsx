"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- scoped query keys require stable manual deps */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, Search, Star, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumnDef } from "@/components/ui/data-table";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type { CustomerDetail, CustomerPage, CustomerSummary, ProfessionalCustomerSummary } from "@/modules/customers/types";
import { getCustomer, listCustomers } from "./customer-api";

type CustomerQuery = {
  page: number;
  pageSize: number;
  bucket: "all" | "active" | "with-balance" | "repeat" | "archived";
  status: string;
  acquisitionSource: string;
  search: string;
  sort: "updated_desc" | "updated_asc" | "name_asc" | "name_desc" | "lastService_desc" | "lastService_asc";
};

type CustomerPageWithSummary = CustomerPage & { summary: ProfessionalCustomerSummary; acquisitionSources: string[] };
type SelectedCustomer = { id: string; placeholder?: CustomerSummary };

const SEARCH_DEBOUNCE_MS = 160;
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const bucketTabs: Array<{ value: CustomerQuery["bucket"]; label: string; count?: keyof ProfessionalCustomerSummary }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active", count: "active" },
  { value: "repeat", label: "Repeat", count: "repeat" },
  { value: "archived", label: "Archived" },
];

const defaultQuery: CustomerQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  status: "",
  acquisitionSource: "",
  search: "",
  sort: "updated_desc",
};

async function listProfessionalCustomers(query: CustomerQuery, signal?: AbortSignal): Promise<CustomerPageWithSummary> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.status) params.set("status", query.status);
  if (query.acquisitionSource) params.set("acquisitionSource", query.acquisitionSource);
  if (query.search) params.set("search", query.search);
  if (query.sort !== "updated_desc") params.set("sort", query.sort);
  return listCustomers(params.toString()) as unknown as Promise<CustomerPageWithSummary>;
}

function queryFromParams(searchParams: URLSearchParams): CustomerQuery {
  const bucket = (searchParams.get("bucket") as CustomerQuery["bucket"]) ?? "all";
  const sort = (searchParams.get("sort") as CustomerQuery["sort"]) ?? "updated_desc";
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(Number(searchParams.get("pageSize"))) ? Number(searchParams.get("pageSize")) : 10,
    bucket: ["all", "active", "with-balance", "repeat", "archived"].includes(bucket) ? bucket : "all",
    status: searchParams.get("status") ?? "",
    acquisitionSource: searchParams.get("acquisitionSource") ?? "",
    search: searchParams.get("search") ?? "",
    sort: (["updated_desc", "updated_asc", "name_asc", "name_desc", "lastService_desc", "lastService_asc"] as const).includes(sort as never) ? sort : "updated_desc",
  };
}

function queryString(state: CustomerQuery) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.status) params.set("status", state.status);
  if (state.acquisitionSource) params.set("acquisitionSource", state.acquisitionSource);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

export function CustomerList() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queryState, setQueryState] = useState<CustomerQuery>(() => queryFromParams(searchParams));
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedCustomer | null>(null);

  const updateParams = useCallback(
    (changes: Partial<CustomerQuery>, resetPage = true) => {
      const next = { ...queryState, ...changes, page: resetPage ? 1 : (changes.page ?? queryState.page) };
      setQueryState(next);
      replaceUrl(pathname, queryString(next));
    },
    [pathname, queryState],
  );

  useEffect(() => {
    const normalized = search.trim();
    if (normalized === queryState.search) return;
    const timeout = window.setTimeout(() => updateParams({ search: normalized }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [queryState.search, search, updateParams]);

  const customerQuery: any = useQuery({
    queryKey: ["professional-customers", queryState] as unknown as readonly unknown[],
    queryFn: ({ signal }: { signal: AbortSignal }) => listProfessionalCustomers(queryState, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    retry: 2,
  } as never);

  const result = customerQuery.data;
  const searchPending = search.trim() !== queryState.search;
  const showProgress = searchPending || (customerQuery.isFetching && customerQuery.isPlaceholderData);
  const hasData = Boolean(result);
  const isInitialLoading = customerQuery.isPending;
  const isBackgroundError = hasData && customerQuery.isError;
  useWorkspaceContentReady(!isInitialLoading);

  const canViewFinancials = false;

  const columns = useMemo<DataTableColumnDef<CustomerSummary, unknown>[]>(() => {
    const base: DataTableColumnDef<CustomerSummary, unknown>[] = [
      { id: "customer", header: "Customer", cell: ({ row }) => <CustomerIdentity customer={row.original} /> },
      { id: "contact", header: "Contact", cell: ({ row }) => <span className="text-[0.72rem] text-muted-foreground">{row.original.email ?? row.original.phone ?? "No contact"}</span> },
      { id: "source", header: "Source", cell: ({ row }) => <span className="whitespace-nowrap rounded-full bg-[#eef8c8] px-2.5 py-1 text-[0.62rem] font-semibold">{row.original.acquisitionSource.replaceAll("_", " ")}</span> },
      { id: "status", header: "Status", cell: ({ row }) => <CustomerStatusBadge status={row.original.status} /> },
      { id: "lastService", header: "Last service", cell: ({ row }) => <span className="text-[0.72rem] text-muted-foreground">{row.original.lastServiceAt ? new Date(row.original.lastServiceAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "No service yet"}</span> },
      { id: "tags", header: "Tags", cell: ({ row }) => row.original.tags.length ? (<span className="flex flex-wrap gap-1">{row.original.tags.slice(0, 2).map((tag) => (<span key={tag} className="rounded-full bg-[#f1eaff] px-2 py-0.5 text-[0.62rem] font-medium text-[#6335e9]">{tag}</span>))}{row.original.tags.length > 2 ? <span className="text-[0.62rem] text-muted-foreground">+{row.original.tags.length - 2}</span> : null}</span>) : <span className="text-muted-foreground">—</span> },
      { id: "action", header: "Action", cell: ({ row }) => <Link href={`/professional/customers/${row.original.id}`} className="font-semibold text-trust hover:text-foreground">View</Link> },
    ];
    if (canViewFinancials) {
      base.splice(5, 0, { id: "balance", header: "Outstanding", cell: () => <span className="text-muted-foreground">—</span> } as DataTableColumnDef<CustomerSummary, unknown>);
    }
    return base;
  }, [canViewFinancials]);

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, "");
  };

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6b9f16]">Customer relationships</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">Customers</h1>
          <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">Manage customer details, service history, private notes, and repeat work from one place.</p>
        </div>
        <Link href="/professional/customers/new" className={buttonVariants()}>
          Add customer
        </Link>
      </header>

      {isInitialLoading && customerQuery.isError && !hasData ? (
        <InlineAlert className="mt-5" variant="error" title="Customers unavailable" description={customerQuery.error instanceof Error ? customerQuery.error.message : "Customers could not be loaded."}>
          <button type="button" onClick={() => void customerQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">Try again</button>
        </InlineAlert>
      ) : (
        <>
          {isBackgroundError ? (
            <InlineAlert className="mt-4" variant="error" title="Customers update failed" description={customerQuery.error instanceof Error ? customerQuery.error.message : "Customers could not be refreshed."}>
              <button type="button" onClick={() => void customerQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">Try again</button>
            </InlineAlert>
          ) : null}
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Customer summary">
            <WorkspaceMetricCard loading={isInitialLoading} icon={Users} tone="green" label="Total customers" value={result?.summary.total} hint="Your complete book" />
            <WorkspaceMetricCard loading={isInitialLoading} icon={Heart} tone="blue" label="Active" value={result?.summary.active} hint="Ready for booking" />
            <WorkspaceMetricCard loading={isInitialLoading} icon={Star} tone="purple" label="Repeat clients" value={result?.summary.repeat} hint={result?.summary.repeat ? "Return customers" : "No repeat yet"} />
            <WorkspaceMetricCard loading={isInitialLoading} icon={TrendingUp} tone="orange" label="New 30 days" value={result?.summary.new30d} hint={result?.summary.new30d ? "Recently added" : "No new this month"} />
          </section>
          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Customer views">
            {bucketTabs.map((tab) => {
              const active = queryState.bucket === tab.value;
              const count = tab.count ? result?.summary[tab.count] : null;
              return (
                <button key={tab.value} type="button" onClick={() => updateParams({ bucket: tab.value, status: "" })} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition", active ? "border-[#83b72c] text-[#426d08]" : "border-transparent text-[#536170] hover:text-foreground")} aria-current={active ? "page" : undefined}>
                  {tab.label}
                  {count !== null ? <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">{count ?? <Skeleton className="h-3 w-4 rounded-full" />}</span> : null}
                </button>
              );
            })}
          </nav>
          <section className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]" aria-label="Professional customers">
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search customers</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring" placeholder="Search name, email, or phone..." />
              </label>
              <label><span className="sr-only">Filter by acquisition</span><select value={queryState.acquisitionSource} onChange={(event) => updateParams({ acquisitionSource: event.target.value })} className={selectClass}><option value="">All sources</option>{result?.acquisitionSources.map((src: string) => (<option key={src} value={src}>{src.replaceAll("_", " ")}</option>))}</select></label>
              <label><span className="sr-only">Filter by status</span><select value={queryState.status} onChange={(event) => updateParams({ status: event.target.value, bucket: "all" })} className={selectClass}><option value="">All statuses</option><option value="REGISTERED">Registered</option><option value="IMPORTED">Imported</option><option value="INVITATION_PENDING">Invited</option><option value="DUPLICATE_CANDIDATE">Duplicate</option><option value="ARCHIVED">Archived</option></select></label>
              <label><span className="sr-only">Sort customers</span><select value={queryState.sort} onChange={(event) => updateParams({ sort: event.target.value as CustomerQuery["sort"] })} className={selectClass}><option value="updated_desc">Recently updated</option><option value="updated_asc">Oldest updated</option><option value="name_asc">Name A–Z</option><option value="name_desc">Name Z–A</option><option value="lastService_desc">Last service recent</option><option value="lastService_asc">Last service oldest</option></select></label>
              {showProgress ? (<span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite"><Spinner className="size-3.5 text-[#6b9f16]" />Updating customers…</span>) : null}
              <button type="button" onClick={clearFilters} className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted">Clear filters</button>
            </div>
            <div className="relative" aria-busy={showProgress}>
              <DataTable loading={isInitialLoading} loadingLabel="Loading customers" columns={columns} data={result?.items ?? []} getRowId={(row) => row.id} getRowLabel={(row) => `View customer ${row.displayName}`} onRowClick={(row) => setSelected({ id: row.id, placeholder: row })} mobileRow={(row) => <CustomerMobileCard customer={row} />} empty={result ? (<StatePanel className="m-4 border-dashed shadow-none" title={result.summary.total === 0 ? "No customers yet" : "No customers match these filters"} description={result.summary.total === 0 ? "Add an existing customer or accept a marketplace booking to begin." : "Clear a filter or try a different search."}>{result.summary.total > 0 ? (<Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>) : (<Link href="/professional/customers/new" className={buttonVariants({ size: "sm" })}>Add customer</Link>)}</StatePanel>) : null} />
            </div>
            {result ? <CustomerPagination page={result.page} pageSize={result.pageSize} totalItems={result.totalItems} totalPages={result.totalPages} onPage={(page) => updateParams({ page }, false)} onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)} /> : null}
          </section>
          {selected ? <CustomerDrawer selected={selected} onClose={closeDrawer} /> : null}
        </>
      )}
    </div>
  );
}

function CustomerIdentity({ customer }: { customer: CustomerSummary }) {
  const initials = customer.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">{initials}</span>
      <span className="min-w-0"><span className="block max-w-40 truncate font-semibold text-foreground">{customer.displayName}</span><span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">{customer.email ?? customer.phone ?? "No contact"}</span></span>
    </span>
  );
}

function CustomerStatusBadge({ status }: { status: CustomerSummary["status"] }) {
  const variant = status === "REGISTERED" ? "success" : status === "ARCHIVED" ? "neutral" : status === "DUPLICATE_CANDIDATE" ? "warning" : "info";
  return <Badge variant={variant as never} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium">{status.replaceAll("_", " ")}</Badge>;
}

function CustomerMobileCard({ customer }: { customer: CustomerSummary }) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3"><CustomerIdentity customer={customer} /><CustomerStatusBadge status={customer.status} /></div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-black/6 py-3 text-xs">
        <div><p className="text-muted-foreground">Source</p><p className="mt-1 font-medium">{customer.acquisitionSource.replaceAll("_", " ")}</p></div>
        <div><p className="text-muted-foreground">Last service</p><p className="mt-1 font-medium">{customer.lastServiceAt ? new Date(customer.lastServiceAt).toLocaleDateString("en-KE") : "No service"}</p></div>
        <div className="col-span-2"><p className="text-muted-foreground">Tags</p><p className="mt-1">{customer.tags.length ? customer.tags.join(", ") : "No tags"}{customer.duplicateOfCustomerId ? <span className="ml-2 text-amber-700">Duplicate candidate</span> : null}</p></div>
      </div>
      <div className="mt-3 flex justify-end"><Link href={`/professional/customers/${customer.id}`} className="text-xs font-semibold text-trust hover:underline">View customer</Link></div>
    </article>
  );
}

function CustomerPagination({ page, pageSize, totalItems, totalPages, onPage, onPageSize }: { page: number; pageSize: number; totalItems: number; totalPages: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages))).sort((a, b) => a - b);
  return (
    <nav aria-label="Customer pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.68rem] text-muted-foreground">Showing {start} to {end} of {totalItems} customers</p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="customer-page-size">Customers per page</label>
        <select id="customer-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className={cn(selectClass, "h-9")}><option value="10">10 per page</option><option value="20">20 per page</option><option value="50">50 per page</option></select>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Previous page"><ChevronLeft className="size-4" /></button>
        {pages.map((item, index) => (<span key={item} className="contents">{index > 0 && item - pages[index - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}<button type="button" onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined} className={cn("grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium", item === page && "border border-[#83b72c] text-[#5f8d11]")}>{item}</button></span>))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Next page"><ChevronRight className="size-4" /></button>
      </div>
    </nav>
  );
}

function CustomerDrawer({ selected, onClose }: { selected: SelectedCustomer; onClose: () => void }) {
  const detailQuery: any = useQuery({ queryKey: ["customer-detail", selected.id] as unknown as readonly unknown[], queryFn: ({ signal }: { signal: AbortSignal }) => getCustomer(selected.id), staleTime: 30_000, retry: 2 } as never);
  const detail = detailQuery.data as CustomerDetail | undefined;
  const placeholder = selected.placeholder;
  const display = detail ?? (placeholder as unknown as CustomerDetail | undefined);
  const isLoading = detailQuery.isPending && !detail;
  const isRefreshing = detailQuery.isFetching && !!detail;
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0" aria-describedby="customer-drawer-description">
        <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">{(display?.displayName ?? placeholder?.displayName ?? "C").slice(0, 2).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><SheetTitle className="truncate text-xl font-semibold tracking-title">{display?.displayName ?? placeholder?.displayName ?? "Customer"}</SheetTitle><SheetDescription id="customer-drawer-description" className="mt-1 text-[0.68rem] text-muted-foreground">{display?.email ?? placeholder?.email ?? display?.phone ?? placeholder?.phone ?? "No contact"}</SheetDescription></div>
                {display ? <Badge variant={display.status === "REGISTERED" ? "success" : display.status === "ARCHIVED" ? "neutral" : "info"}>{display.status.replaceAll("_", " ")}</Badge> : null}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {isLoading ? (
            <CustomerDrawerSkeleton />
          ) : detailQuery.isError && !detail ? (
            <InlineAlert variant="error" title="Customer unavailable" description={detailQuery.error instanceof Error ? detailQuery.error.message : "The customer could not be loaded."}><button type="button" onClick={() => void detailQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">Try again</button></InlineAlert>
          ) : isRefreshing ? (
            <CustomerDrawerRefreshingSkeleton />
          ) : display ? (
            <div className="space-y-4">
              <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">1</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Contact & source</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 font-medium">{display.email ?? "Not provided"}</dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="mt-1 font-medium">{display.phone ?? "Not provided"}</dd></div><div><dt className="text-muted-foreground">Source</dt><dd className="mt-1"><span className="rounded-full bg-[#eef8c8] px-2.5 py-1 text-[0.62rem] font-semibold">{display.acquisitionSource.replaceAll("_", " ")}</span></dd></div><div><dt className="text-muted-foreground">Last service</dt><dd className="mt-1 font-medium">{display.lastServiceAt ? new Date(display.lastServiceAt).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "No service yet"}</dd></div></dl>{display.tags?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{display.tags.map((tag: string) => (<span key={tag} className="rounded-full bg-[#f1eaff] px-2.5 py-1 text-xs font-medium text-[#6335e9]">{tag}</span>))}</div> : null}</div></section>
              <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">2</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Recent history</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">{detail?.history?.length ? (<ul className="divide-y divide-black/5">{detail.history.slice(0, 3).map((item: CustomerDetail["history"][number]) => (<li key={item.id} className="flex items-center justify-between gap-2 py-2 text-xs"><span className="font-medium">{item.label}</span><Badge variant="neutral" className="text-[0.62rem]">{item.status.replaceAll("_", " ")}</Badge></li>))}</ul>) : (<p className="text-sm text-muted-foreground">No service history yet. Recent bookings, jobs, and quotations will appear here.</p>)} {detail?.notes?.length ? <div className="mt-3 rounded-[10px] bg-[#f7f9fa] p-3 text-xs leading-5"><p className="font-semibold">Latest private note</p><p className="mt-1 text-muted-foreground line-clamp-2">{detail.notes[0].body}</p></div> : null}</div></section>
              <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">3</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Actions</h3></div><div className="mt-2 grid gap-2"><Link href={`/professional/customers/${display.id}`} className={buttonVariants({ variant: "primary" })}>View details</Link><Link href={`/professional/bookings/new?customerId=${display.id}`} className={buttonVariants({ variant: "outline" })}>Create booking</Link><p className="text-[0.68rem] leading-4 text-muted-foreground">The drawer shows the most important relationship context. Use View details for full notes, tags, and repeat-booking workflow.</p></div></section>
            </div>
          ) : null}
        </div>
        {display ? (<div className="shrink-0 border-t border-black/8 bg-white px-4 py-4 sm:px-6"><div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={onClose}>Close</Button><Link href={`/professional/customers/${display.id}`} className={buttonVariants({ variant: "primary" })}>View details</Link></div></div>) : null}
      </SheetContent>
    </Sheet>
  );
}

function CustomerDrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading customer details">
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">1</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Contact & source</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1"><Skeleton className="h-4 w-24 rounded-md" /></dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div><div><dt className="text-muted-foreground">Source</dt><dd className="mt-1"><Skeleton className="h-5 w-16 rounded-full" /></dd></div><div><dt className="text-muted-foreground">Last service</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div></dl></div></section>
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">2</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Recent history</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><Skeleton className="h-4 w-full rounded-md" /><Skeleton className="mt-2 h-4 w-5/6 rounded-md" /><Skeleton className="mt-2 h-4 w-3/4 rounded-md" /></div></section>
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">3</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Actions</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><Skeleton className="h-9 w-full rounded-full" /></div></section>
    </div>
  );
}

function CustomerDrawerRefreshingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading customer details">
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">1</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Contact & source</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div><div><dt className="text-muted-foreground">Phone</dt><dd className="mt-1"><Skeleton className="h-4 w-16 rounded-md" /></dd></div></dl></div></section>
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">2</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Recent history</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><Skeleton className="h-12 w-full rounded-[10px]" /></div></section>
      <section><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">3</span><h3 className="text-xs font-semibold tracking-wide text-[#536170]">Actions</h3></div><div className="mt-2 rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]"><Skeleton className="h-8 w-full rounded-full" /></div></section>
    </div>
  );
}
