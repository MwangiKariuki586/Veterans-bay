"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- scoped query keys require stable manual deps */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  Inbox,
  MapPin,
  MessageSquareText,
  Search,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
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
import { Surface } from "@/components/ui/surface";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type {
  ProfessionalEnquiryBucket,
  ProfessionalEnquirySort,
  ProfessionalEnquirySummary,
  ProfessionalServiceRequest,
  ServiceRequestStatus,
} from "@/modules/service-requests/types";
import { requestApi } from "./request-api";

type EnquiryItem = {
  id: string;
  category: string | null;
  description: string | null;
  location: string | null;
  preferredTime: string | null;
  urgency: "FLEXIBLE" | "SOON" | "URGENT" | null;
  status: ServiceRequestStatus;
  preferredProfessionalName: string | null;
  createdAt: string;
  updatedAt: string;
};

type EnquiryPage = {
  items: EnquiryItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: ProfessionalEnquirySummary;
  categories: string[];
};

type EnquiryQuery = {
  page: number;
  pageSize: number;
  bucket: ProfessionalEnquiryBucket;
  status: string;
  category: string;
  urgency: string;
  search: string;
  sort: ProfessionalEnquirySort;
};

const SEARCH_DEBOUNCE_MS = 160;
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const bucketTabs: Array<{ value: ProfessionalEnquiryBucket; label: string; count?: keyof ProfessionalEnquirySummary }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New", count: "newEnquiries" },
  { value: "in-review", label: "In review", count: "awaitingReview" },
  { value: "awaiting-info", label: "Awaiting info", count: "needsInfo" },
  { value: "converted", label: "Converted", count: "converted" },
  { value: "closed", label: "Closed", count: "closed" },
];

const statusMeta: Record<ServiceRequestStatus, { label: string; variant: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  SUBMITTED: { label: "New", variant: "warning" },
  UNDER_REVIEW: { label: "In review", variant: "info" },
  MORE_INFORMATION_REQUIRED: { label: "Needs info", variant: "warning" },
  ASSESSMENT_REQUIRED: { label: "Assessment", variant: "warning" },
  QUOTED: { label: "Quoted", variant: "success" },
  CONVERTED: { label: "Converted", variant: "success" },
  DECLINED: { label: "Declined", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  EXPIRED: { label: "Expired", variant: "neutral" },
};

const urgencyTone: Record<string, string> = {
  URGENT: "text-danger",
  SOON: "text-[#d16b16]",
  FLEXIBLE: "text-muted-foreground",
};

const defaultQuery: EnquiryQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  status: "",
  category: "",
  urgency: "",
  search: "",
  sort: "updated_desc",
};

async function listProfessionalEnquiries(query: EnquiryQuery, signal?: AbortSignal): Promise<EnquiryPage> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.status) params.set("status", query.status);
  if (query.category) params.set("category", query.category);
  if (query.urgency) params.set("urgency", query.urgency);
  if (query.search) params.set("search", query.search);
  if (query.sort !== "updated_desc") params.set("sort", query.sort);
  return requestApi<EnquiryPage>(`/api/v1/professional/enquiries?${params.toString()}`, { signal });
}

function queryFromParams(searchParams: URLSearchParams): EnquiryQuery {
  const bucket = (searchParams.get("bucket") as ProfessionalEnquiryBucket) ?? "all";
  const sort = (searchParams.get("sort") as ProfessionalEnquirySort) ?? "updated_desc";
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(Number(searchParams.get("pageSize"))) ? Number(searchParams.get("pageSize")) : 10,
    bucket: ["all", "new", "in-review", "awaiting-info", "converted", "closed"].includes(bucket) ? bucket : "all",
    status: searchParams.get("status") ?? "",
    category: searchParams.get("category") ?? "",
    urgency: searchParams.get("urgency") ?? "",
    search: searchParams.get("search") ?? "",
    sort: (["updated_desc", "updated_asc", "category_asc", "category_desc", "status_asc", "status_desc"] as const).includes(sort as never) ? sort : "updated_desc",
  };
}

function queryString(state: EnquiryQuery) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.status) params.set("status", state.status);
  if (state.category) params.set("category", state.category);
  if (state.urgency) params.set("urgency", state.urgency);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

type SelectedEnquiry = { id: string; placeholder?: EnquiryItem };

export function ProfessionalEnquiriesPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [queryState, setQueryState] = useState<EnquiryQuery>(() => queryFromParams(searchParams));
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedEnquiry | null>(null);

  const updateParams = useCallback(
    (changes: Partial<EnquiryQuery>, resetPage = true) => {
      const next = {
        ...queryState,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? queryState.page),
      };
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

  const enquiryQuery: any = useQuery({
    queryKey: ["enquiries", queryState] as unknown as readonly unknown[],
    queryFn: ({ signal }: { signal: AbortSignal }) => listProfessionalEnquiries(queryState, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
  } as never);

  const result = enquiryQuery.data;
  const searchPending = search.trim() !== queryState.search;
  const showProgress = searchPending || (enquiryQuery.isFetching && enquiryQuery.isPlaceholderData);
  const hasData = Boolean(result);
  const isInitialLoading = enquiryQuery.isPending;
  const isBackgroundError = hasData && enquiryQuery.isError;
  useWorkspaceContentReady(!isInitialLoading);

  const columns = useMemo<DataTableColumnDef<EnquiryItem, unknown>[]>(
    () => [
      {
        id: "enquiry",
        header: "Enquiry",
        cell: ({ row }) => <EnquiryIdentity enquiry={row.original} />,
      },
      {
        id: "category",
        header: () => (
          <SortHeader label="Category" column="category" sort={queryState.sort} onSort={(c) => updateParams({ sort: queryState.sort === `${c}_asc` ? `${c}_desc` : `${c}_asc` as ProfessionalEnquirySort })} />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.category ?? "—"}</span>,
      },
      {
        id: "status",
        header: () => (
          <SortHeader label="Status" column="status" sort={queryState.sort} onSort={(c) => updateParams({ sort: queryState.sort === `${c}_asc` ? `${c}_desc` : `${c}_asc` as ProfessionalEnquirySort })} />
        ),
        cell: ({ row }) => <EnquiryStatusBadge status={row.original.status} />,
      },
      {
        id: "urgency",
        header: "Urgency",
        cell: ({ row }) => <UrgencyCell urgency={row.original.urgency} />,
      },
      {
        id: "schedule",
        header: "Preferred schedule",
        cell: ({ row }) => <span className="whitespace-nowrap text-[0.72rem] text-muted-foreground">{row.original.preferredTime ?? "Not specified"}</span>,
      },
      {
        id: "updated",
        header: () => (
          <SortHeader label="Updated" column="updated" sort={queryState.sort} onSort={(c) => updateParams({ sort: queryState.sort === `${c}_asc` ? `${c}_desc` : `${c}_asc` as ProfessionalEnquirySort })} />
        ),
        cell: ({ row }) => <UpdatedCell iso={row.original.updatedAt} />,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <Link href={`/professional/enquiries/${row.original.id}`} className="font-semibold text-trust transition-colors hover:text-foreground">
            Review
          </Link>
        ),
      },
    ],
    [queryState.sort, updateParams],
  );

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, "");
  };

  const onRowClick = useCallback((row: EnquiryItem) => {
    setSelected({ id: row.id, placeholder: row });
  }, []);

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header>
        <p className="text-xs font-semibold text-[#6b9f16]">Professional workspace</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">Service enquiries</h1>
        <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
          Qualify submitted requirements, request clarification, and convert the right enquiries into quotations.
        </p>
      </header>

      {isInitialLoading && enquiryQuery.isError && !hasData ? (
        <InlineAlert className="mt-5" variant="error" title="Enquiries unavailable" description={enquiryQuery.error instanceof Error ? enquiryQuery.error.message : "Enquiries could not be loaded."}>
          <button type="button" onClick={() => void enquiryQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">
            Try again
          </button>
        </InlineAlert>
      ) : (
        <>
          {isBackgroundError ? (
            <InlineAlert className="mt-4" variant="error" title="Enquiries update failed" description={enquiryQuery.error instanceof Error ? enquiryQuery.error.message : "Enquiries could not be refreshed."}>
              <button type="button" onClick={() => void enquiryQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">
                Try again
              </button>
            </InlineAlert>
          ) : null}

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Enquiry summary">
            <WorkspaceMetricCard
              loading={isInitialLoading}
              icon={ClipboardList}
              tone="green"
              label="New enquiries"
              value={result?.summary.newEnquiries}
              hint={result?.summary.newEnquiries ? "Awaiting first response" : "No new enquiries"}
              hintTone={result?.summary.newEnquiries ? "danger" : "muted"}
            />
            <WorkspaceMetricCard
              loading={isInitialLoading}
              icon={Clock3}
              tone="blue"
              label="In review"
              value={result?.summary.awaitingReview}
              hint={result?.summary.awaitingReview ? "Actively qualifying" : "Nothing in review"}
            />
            <WorkspaceMetricCard
              loading={isInitialLoading}
              icon={CircleAlert}
              tone="orange"
              label="Needs info"
              value={result?.summary.needsInfo}
              hint={result?.summary.needsInfo ? "Waiting on client" : "No info requests"}
              hintTone={result?.summary.needsInfo ? "danger" : "muted"}
            />
            <WorkspaceMetricCard
              loading={isInitialLoading}
              icon={FileCheck2}
              tone="purple"
              label="Converted"
              value={result?.summary.converted}
              hint={`${result?.summary.urgent ?? 0} urgent enquiries`}
            />
          </section>

          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Enquiry status views">
            {bucketTabs.map((tab) => {
              const active = queryState.bucket === tab.value;
              const count = tab.count ? result?.summary[tab.count] : null;
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
                >
                  {tab.label}
                  {count !== null ? (
                    <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">{count ?? <Skeleton className="h-3 w-4 rounded-full" />}</span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <section className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]" aria-label="Professional enquiries">
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search enquiries</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder="Search category, location or description..."
                />
              </label>

              <label>
                <span className="sr-only">Filter by category</span>
                <select value={queryState.category} onChange={(event) => updateParams({ category: event.target.value })} className={selectClass}>
                  <option value="">All categories</option>
                  {result?.categories.map((cat: string) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Filter by status</span>
                <select value={queryState.status} onChange={(event) => updateParams({ status: event.target.value, bucket: "all" })} className={selectClass}>
                  <option value="">All statuses</option>
                  {Object.entries(statusMeta).filter(([k]) => k !== "DRAFT").map(([status, meta]) => (
                    <option key={status} value={status}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="sr-only">Filter by urgency</span>
                <select value={queryState.urgency} onChange={(event) => updateParams({ urgency: event.target.value })} className={selectClass}>
                  <option value="">All urgency</option>
                  <option value="URGENT">Urgent</option>
                  <option value="SOON">Soon</option>
                  <option value="FLEXIBLE">Flexible</option>
                </select>
              </label>

              {showProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating enquiries…
                </span>
              ) : null}
              <button type="button" onClick={clearFilters} className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted">
                Clear filters
              </button>
            </div>

            <div className="relative" aria-busy={showProgress}>
              <DataTable
                loading={isInitialLoading}
                loadingLabel="Loading enquiries"
                columns={columns}
                data={result?.items ?? []}
                getRowId={(row) => row.id}
                getRowLabel={(row) => `Review enquiry ${row.category ?? "service"} ${row.id.slice(-6)}`}
                onRowClick={onRowClick}
                mobileRow={(row) => <EnquiryMobileCard enquiry={row} />}
                empty={
                  result ? (
                    <StatePanel
                      className="m-4 border-dashed shadow-none"
                      title={result.summary.total === 0 ? "No enquiries to review" : "No enquiries match these filters"}
                      description={result.summary.total === 0 ? "New requests addressed to this organisation will appear here." : "Clear a filter or try a different search."}
                    >
                      {result.summary.total > 0 ? (
                        <Button size="sm" variant="outline" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      ) : null}
                    </StatePanel>
                  ) : null
                }
              />
            </div>
            {result ? (
              <EnquiryPagination
                page={result.page}
                pageSize={result.pageSize}
                totalItems={result.totalItems}
                totalPages={result.totalPages}
                onPage={(page) => updateParams({ page }, false)}
                onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)}
              />
            ) : null}
          </section>
          {selected ? <EnquiryDrawer selected={selected} onClose={closeDrawer} /> : null}
        </>
      )}
    </div>
  );
}

function EnquiryDrawer({ selected, onClose }: { selected: SelectedEnquiry; onClose: () => void }) {
  const detailQuery: any = useQuery({
    queryKey: ["enquiry-detail", selected.id] as unknown as readonly unknown[],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      requestApi<ProfessionalServiceRequest>(`/api/v1/professional/enquiries/${selected.id}`, { signal }),
    staleTime: 30_000,
    retry: 2,
  } as never);

  const detail = detailQuery.data as ProfessionalServiceRequest | undefined;
  const placeholder = selected.placeholder;
  const display = detail ?? (placeholder as unknown as ProfessionalServiceRequest | undefined);
  const isLoading = detailQuery.isPending && !detail;
  const isRefreshing = detailQuery.isFetching && !!detail;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0" aria-describedby="enquiry-drawer-description">
        <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f1eaff] text-[#6335e9]">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-semibold tracking-title">{display?.category ?? placeholder?.category ?? "Service enquiry"}</SheetTitle>
                  <SheetDescription id="enquiry-drawer-description" className="mt-1 text-[0.68rem] text-muted-foreground">REQ-{selected.id.slice(-6).toUpperCase()}</SheetDescription>
                </div>
                {display ? <Badge variant={statusMeta[display.status as ServiceRequestStatus]?.variant ?? "neutral"}>{statusMeta[display.status as ServiceRequestStatus]?.label ?? display.status.replaceAll("_", " ")}</Badge> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {isLoading ? (
            <EnquiryDrawerSkeleton />
          ) : detailQuery.isError && !detail ? (
            <InlineAlert variant="error" title="Enquiry unavailable" description={detailQuery.error instanceof Error ? detailQuery.error.message : "The enquiry could not be loaded."}>
              <button type="button" onClick={() => void detailQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">Try again</button>
            </InlineAlert>
          ) : isRefreshing ? (
            <EnquiryDrawerRefreshingSkeleton />
          ) : display ? (
            <div className="space-y-4">
              <DrawerSection number="1" title="Client & location">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <p className="text-sm font-semibold text-foreground">{(display as ProfessionalServiceRequest).client?.displayName ?? "Client details hidden"}</p>
                  {(display as ProfessionalServiceRequest).client?.primaryEmail ? <p className="mt-1 text-xs text-muted-foreground">{(display as ProfessionalServiceRequest).client.primaryEmail}</p> : null}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" />{display.location ?? "Location not specified"}</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-muted-foreground" />{display.preferredTime ?? "Schedule flexible"}</span>
                    <span className={cn("inline-flex items-center gap-1.5 font-medium", urgencyTone[display.urgency ?? ""] ?? "text-muted-foreground")}><Zap className="size-3.5" />{display.urgency ?? "Urgency not set"}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-muted-foreground" />{new Date(display.updatedAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</span>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection number="2" title="Requirements">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#4f5963]">{display.description?.trim() ? display.description : "No description provided."}</p>
                </div>
              </DrawerSection>

              <DrawerSection number="3" title="Next actions">
                <div className="grid gap-2">
                  {(display as ProfessionalServiceRequest).conversionEligible ? (
                    <Link href={`/professional/quotations/new?requestId=${display.id}`} className={buttonVariants({ variant: "primary" })}>
                      <FileText className="size-4" /> Prepare quotation
                    </Link>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/professional/enquiries/${display.id}`} className={buttonVariants({ variant: display.conversionEligible ? "outline" : "primary" })}>
                      View details
                    </Link>
                    <Button variant="outline" asChild>
                      <Link href={`/professional/enquiries/${display.id}#conversation`}><MessageSquareText className="size-4" /> Conversation</Link>
                    </Button>
                  </div>
                  <p className="text-[0.68rem] leading-4 text-muted-foreground">The drawer shows the most important context. Use View details for full history, attachments, and workflow actions.</p>
                </div>
              </DrawerSection>
            </div>
          ) : null}
        </div>

        {display ? (
          <div className="shrink-0 border-t border-black/8 bg-white px-4 py-4 sm:px-6">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Link href={`/professional/enquiries/${display.id}`} className={buttonVariants({ variant: "primary" })}>View details</Link>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">{number}</span>
        <h3 className="text-xs font-semibold tracking-wide text-[#536170]">{title}</h3>
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EnquiryDrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading enquiry details">
      <DrawerSection number="1" title="Client & location">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1"><Skeleton className="h-4 w-28 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1"><Skeleton className="h-4 w-24 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Schedule</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Urgency</dt><dd className="mt-1"><Skeleton className="h-4 w-16 rounded-full" /></dd></div>
            <div><dt className="text-muted-foreground">Updated</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
          </dl>
        </div>
      </DrawerSection>
      <DrawerSection number="2" title="Requirements">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="mt-2 h-4 w-5/6 rounded-md" />
          <Skeleton className="mt-2 h-4 w-3/4 rounded-md" />
        </div>
      </DrawerSection>
      <DrawerSection number="3" title="Next actions">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <Skeleton className="h-9 w-full rounded-full" />
          <Skeleton className="mt-2 h-9 w-full rounded-full" />
        </div>
      </DrawerSection>
    </div>
  );
}

function EnquiryDrawerRefreshingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading enquiry details">
      <DrawerSection number="1" title="Client & location">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1"><Skeleton className="h-4 w-28 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Contact</dt><dd className="mt-1"><Skeleton className="h-4 w-24 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Schedule</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
          </dl>
        </div>
      </DrawerSection>
      <DrawerSection number="2" title="Requirements">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <Skeleton className="h-16 w-full rounded-[10px]" />
        </div>
      </DrawerSection>
      <DrawerSection number="3" title="Next actions">
        <div className="rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <Skeleton className="h-8 w-full rounded-full" />
        </div>
      </DrawerSection>
    </div>
  );
}

function EnquiryIdentity({ enquiry }: { enquiry: EnquiryItem }) {
  return (
    <span className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f1eaff] text-[#6335e9]">
        <ClipboardList className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-48 truncate font-semibold text-foreground">{enquiry.category ?? "Service enquiry"}</span>
        <span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">REQ-{enquiry.id.slice(-6).toUpperCase()}</span>
        <span className="mt-0.5 line-clamp-1 block max-w-48 text-[0.64rem] text-muted-foreground">{enquiry.description ?? "No description"}</span>
      </span>
    </span>
  );
}

function EnquiryStatusBadge({ status }: { status: ServiceRequestStatus }) {
  const meta = statusMeta[status] ?? { label: status.replaceAll("_", " "), variant: "neutral" as const };
  return (
    <Badge variant={meta.variant} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium">
      {meta.label}
    </Badge>
  );
}

function UrgencyCell({ urgency }: { urgency: string | null }) {
  if (!urgency) return <span className="text-muted-foreground">—</span>;
  const tone = urgencyTone[urgency] ?? "text-muted-foreground";
  const Icon = urgency === "URGENT" ? Zap : urgency === "SOON" ? Timer : Inbox;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.72rem] font-medium", tone)}>
      <Icon className="size-3.5" />
      {urgency.replaceAll("_", " ")}
    </span>
  );
}

function UpdatedCell({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <span className="whitespace-nowrap">
      <span className="block font-medium">
        {date.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}
      </span>
      <span className="text-[0.62rem] text-muted-foreground">
        {date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}
      </span>
    </span>
  );
}

function EnquiryMobileCard({ enquiry }: { enquiry: EnquiryItem }) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <EnquiryIdentity enquiry={enquiry} />
        <EnquiryStatusBadge status={enquiry.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-black/6 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Urgency</p>
          <p className="mt-1 font-medium">
            <UrgencyCell urgency={enquiry.urgency} />
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Location</p>
          <p className="mt-1 truncate font-medium">{enquiry.location ?? "Not specified"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Preferred time</p>
          <p className="mt-1 font-medium">{enquiry.preferredTime ?? "Not specified"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Updated</p>
          <p className="mt-1 font-medium">{new Date(enquiry.updatedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={`/professional/enquiries/${enquiry.id}`} className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-trust hover:underline">
          Review <TrendingUp className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: "updated" | "category" | "status";
  sort: ProfessionalEnquirySort;
  onSort: (column: "updated" | "category" | "status") => void;
}) {
  const active = sort.startsWith(column);
  return (
    <button type="button" onClick={() => onSort(column)} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
      {label}
      <ArrowUpDown className="size-3" aria-hidden="true" />
    </button>
  );
}

function EnquiryPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages))).sort((a, b) => a - b);
  return (
    <nav aria-label="Enquiry pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} enquiries
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="enquiry-page-size">
          Enquiries per page
        </label>
        <select id="enquiry-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className={cn(selectClass, "h-9")}>
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
        </select>
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Previous page">
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((item, index) => (
          <span key={item} className="contents">
            {index > 0 && item - pages[index - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
            <button
              type="button"
              onClick={() => onPage(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn("grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium", item === page && "border border-[#83b72c] text-[#5f8d11]")}
            >
              {item}
            </button>
          </span>
        ))}
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Next page">
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}
