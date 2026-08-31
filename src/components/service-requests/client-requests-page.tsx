"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  EllipsisVertical,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataTable, type DataTableColumnDef } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type {
  ClientRequestBucket,
  ClientRequestSort,
  ClientRequestSummary,
  ClientServiceRequest,
  ServiceRequestOptions,
  ServiceRequestStatus,
} from "@/modules/service-requests/types";
import type { PageResult } from "@/platform/http/pagination";
import {
  ClientRequestForm,
  type ClientRequestInitial,
} from "./client-request-form";
import { requestApi } from "./request-api";

type RequestPage = PageResult<ClientServiceRequest> & { summary: ClientRequestSummary };
type SelectedRequest = {
  id: string;
  placeholder?: ClientServiceRequest;
};
type RequestEditor = {
  requestId?: string;
  initial?: ClientRequestInitial;
};
type StatusVariant = "neutral" | "trust" | "info" | "success" | "warning" | "danger";
type RequestQueryState = {
  page: number;
  pageSize: number;
  bucket: "all" | ClientRequestBucket;
  category: string;
  status: string;
  preferredTime: string;
  urgency: string;
  search: string;
  sort: ClientRequestSort;
};

const defaultQueryState: RequestQueryState = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  category: "",
  status: "",
  preferredTime: "",
  urgency: "",
  search: "",
  sort: "updated_desc",
};

const SEARCH_DEBOUNCE_MS = 160;

const statusMeta: Record<ServiceRequestStatus, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  SUBMITTED: { label: "Submitted", variant: "warning" },
  UNDER_REVIEW: { label: "Under review", variant: "info" },
  MORE_INFORMATION_REQUIRED: { label: "More info needed", variant: "warning" },
  ASSESSMENT_REQUIRED: { label: "Assessment needed", variant: "warning" },
  QUOTED: { label: "Quote received", variant: "info" },
  CONVERTED: { label: "Converted", variant: "success" },
  DECLINED: { label: "Declined", variant: "danger" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  EXPIRED: { label: "Expired", variant: "neutral" },
};

const tabs: Array<{ value: "all" | ClientRequestBucket; label: string; count: keyof ClientRequestSummary }> = [
  { value: "all", label: "All", count: "total" },
  { value: "draft", label: "Drafts", count: "drafts" },
  { value: "active", label: "Active", count: "active" },
  { value: "needs-action", label: "Needs action", count: "needsAction" },
  { value: "closed", label: "Closed", count: "closed" },
];

const bucketStatuses: Record<ClientRequestBucket, ServiceRequestStatus[]> = {
  draft: ["DRAFT"],
  active: [
    "SUBMITTED",
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "ASSESSMENT_REQUIRED",
    "QUOTED",
  ],
  "needs-action": ["MORE_INFORMATION_REQUIRED", "QUOTED"],
  closed: ["CONVERTED", "DECLINED", "CANCELLED", "EXPIRED"],
};

const selectClass = "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

export function ClientRequestsPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [queryState, setQueryState] = useState<RequestQueryState>(() =>
    requestQueryStateFrom(searchParams),
  );
  const {
    page,
    bucket,
    category,
    status,
    preferredTime,
    urgency,
    sort,
  } = queryState;
  const [search, setSearch] = useState(queryState.search);
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest | null>(
    () => {
      const requestId = searchParams.get("requestId");
      return requestId ? { id: requestId } : null;
    },
  );
  const routeRequestEditor = requestEditorFrom(searchParams);
  const [requestEditorOverride, setRequestEditor] = useState<
    RequestEditor | null | undefined
  >(undefined);
  const requestEditor =
    requestEditorOverride === undefined
      ? routeRequestEditor
      : requestEditorOverride;

  const openRequest = useCallback(
    (request: ClientServiceRequest) => {
      setRequestEditor(null);
      setSelectedRequest({ id: request.id, placeholder: request });
      const query = new URLSearchParams(window.location.search);
      clearEditorParams(query);
      query.set("requestId", request.id);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${query.toString()}`,
      );
    },
    [pathname],
  );

  const closeRequest = useCallback(() => {
    setSelectedRequest(null);
    const query = new URLSearchParams(window.location.search);
    query.delete("requestId");
    window.history.replaceState(
      window.history.state,
      "",
      query.size ? `${pathname}?${query.toString()}` : pathname,
    );
  }, [pathname]);

  const openNewRequest = useCallback(() => {
    setSelectedRequest(null);
    setRequestEditor({
      initial: { source: "MARKETPLACE_DISCOVERY" },
    });
    const query = new URLSearchParams(window.location.search);
    query.delete("requestId");
    clearEditorParams(query);
    query.set("editor", "new");
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}?${query.toString()}`,
    );
  }, [pathname]);

  const closeRequestEditor = useCallback(() => {
    setRequestEditor(null);
    const query = new URLSearchParams(window.location.search);
    clearEditorParams(query);
    window.history.replaceState(
      window.history.state,
      "",
      query.size ? `${pathname}?${query.toString()}` : pathname,
    );
  }, [pathname]);

  const handleDraftSaved = useCallback((saved: ClientServiceRequest) => {
    setRequestEditor({ requestId: saved.id });
    const query = new URLSearchParams(window.location.search);
    clearEditorParams(query);
    query.set("editor", saved.id);
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}?${query.toString()}`,
    );
    void queryClient.invalidateQueries({ queryKey: ["client-requests"] });
  }, [pathname, queryClient]);

  const handleRequestSubmitted = useCallback((submitted: ClientServiceRequest) => {
    setRequestEditor(null);
    setSelectedRequest({ id: submitted.id, placeholder: submitted });
    const query = new URLSearchParams(window.location.search);
    clearEditorParams(query);
    query.set("requestId", submitted.id);
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}?${query.toString()}`,
    );
    void queryClient.invalidateQueries({ queryKey: ["client-requests"] });
  }, [pathname, queryClient]);

  const updateParams = useCallback((changes: Partial<RequestQueryState>, resetPage = true) => {
    const nextState: RequestQueryState = {
      ...queryState,
      ...changes,
      page: resetPage ? 1 : (changes.page ?? queryState.page),
    };
    setQueryState(nextState);
    const query = requestQuerySearch(nextState);
    window.history.replaceState(
      window.history.state,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }, [pathname, queryState]);

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (normalizedSearch === queryState.search) return;
    const timeout = window.setTimeout(() => {
      updateParams({ search: normalizedSearch });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [queryState.search, search, updateParams]);

  const requestQuery = useQuery({
    queryKey: ["client-requests", queryState],
    queryFn: ({ signal }) => loadRequests(queryState, signal),
    placeholderData: keepPreviousData,
  });
  const optionsQuery = useQuery({
    queryKey: ["client-request-options"],
    queryFn: ({ signal }) => requestApi<ServiceRequestOptions>("/api/v1/client/requests/options", { signal }),
    staleTime: 5 * 60_000,
  });
  const result = requestQuery.data;
  const normalizedSearch = search.trim();
  const searchInputIsPending = normalizedSearch !== queryState.search;
  const cachedUnsearchedResult = queryClient.getQueryData<RequestPage>([
    "client-requests",
    { ...queryState, search: "" },
  ]);
  const shouldFilterCachedRows =
    searchInputIsPending || requestQuery.isPlaceholderData;
  const visibleItems = result
    ? shouldFilterCachedRows
      ? filterCachedRequests(
          searchInputIsPending || queryState.search
            ? cachedUnsearchedResult?.items ?? result.items
            : result.items,
          { ...queryState, search: normalizedSearch },
        )
      : result.items
    : [];
  const showQueryProgress =
    searchInputIsPending ||
    (requestQuery.isFetching && requestQuery.isPlaceholderData);
  const progressLabel =
    normalizedSearch || queryState.search ? "Searching…" : "Updating requests…";
  useWorkspaceContentReady(!requestQuery.isPending);

  useEffect(() => {
    if (!result || page >= result.totalPages || queryState.search) return;
    const nextState = { ...queryState, page: page + 1 };
    void queryClient.prefetchQuery({
      queryKey: ["client-requests", nextState],
      queryFn: ({ signal }) => loadRequests(nextState, signal),
      staleTime: 30_000,
    });
  }, [page, queryClient, queryState, result]);

  const setSortFor = useCallback((column: "updated" | "category" | "status") => {
    updateParams({ sort: sort === `${column}_asc` ? `${column}_desc` : `${column}_asc` });
  }, [sort, updateParams]);

  const columns = useMemo<DataTableColumnDef<ClientServiceRequest, unknown>[]>(() => [
    { id: "request", header: "Request", cell: ({ row }) => <RequestIdentity request={row.original} /> },
    {
      id: "category",
      header: () => <SortHeader label="Category" column="category" sort={sort} onSort={setSortFor} />,
      cell: ({ row }) => <span className="flex items-center gap-2 whitespace-nowrap text-[#536170]"><span className="size-1.5 rounded-full bg-[#8b5cf6]" />{row.original.category ?? "Uncategorised"}</span>,
    },
    { id: "status", header: () => <SortHeader label="Status" column="status" sort={sort} onSort={setSortFor} />, cell: ({ row }) => <RequestStatus status={row.original.status} /> },
    { id: "professional", header: "Professional", cell: ({ row }) => <ProfessionalCell request={row.original} /> },
    {
      id: "schedule",
      header: "Preferred schedule",
      cell: ({ row }) => <span className="flex max-w-40 items-start gap-2 text-[#536170]"><CalendarDays className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span className="line-clamp-2">{row.original.preferredTime ?? "Not set"}</span></span>,
    },
    { id: "budget", header: "Budget", cell: ({ row }) => <BudgetCell request={row.original} /> },
    { id: "updated", header: () => <SortHeader label="Updated" column="updated" sort={sort} onSort={setSortFor} />, cell: ({ row }) => <UpdatedCell iso={row.original.updatedAt} /> },
    { id: "action", header: "Action", cell: ({ row }) => <RequestAction request={row.original} onOpen={openRequest} /> },
  ], [openRequest, setSortFor, sort]);

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQueryState);
    window.history.replaceState(window.history.state, "", pathname);
  };

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6b9f16]">Client requests</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">Your service requests</h1>
          <p className="mt-1.5 text-[0.78rem] text-muted-foreground">Track requests, respond when needed, and follow them through to booking.</p>
        </div>
        <Button onClick={openNewRequest} className="h-10 min-h-10 rounded-[9px] px-5 text-xs shadow-none"><Plus className="size-4" aria-hidden="true" /> New request</Button>
      </header>

      {requestQuery.isPending ? <RequestsSkeleton /> : requestQuery.isError ? (
        <InlineAlert className="mt-5" variant="error" title="Requests unavailable" description={requestQuery.error instanceof Error ? requestQuery.error.message : "Requests could not be loaded."} />
      ) : result ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Request summary">
            <WorkspaceMetricCard icon={ClipboardList} tone="green" label="Total requests" value={result.summary.total} hint="Across all statuses" href="/client/requests" action="View requests" />
            <WorkspaceMetricCard icon={RefreshCw} tone="blue" label="Active requests" value={result.summary.active} hint="Awaiting progress" href="/client/requests?bucket=active" action="View active" />
            <WorkspaceMetricCard icon={CircleAlert} tone="orange" label="Needs action" value={result.summary.needsAction} hint={result.summary.needsAction ? "Your response is required" : "Nothing needs attention"} hintTone={result.summary.needsAction ? "danger" : "muted"} href="/client/requests?bucket=needs-action" action="Review now" />
            <WorkspaceMetricCard icon={FileText} tone="purple" label="Drafts" value={result.summary.drafts} hint={result.summary.drafts ? "Ready to complete" : "No saved drafts"} href="/client/requests?bucket=draft" action="Continue drafts" />
          </section>

          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Request status views">
            {tabs.map((tab) => {
              const active = bucket === tab.value;
              return <button key={tab.value} type="button" onClick={() => updateParams({ bucket: tab.value, status: "" })} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition", active ? "border-[#83b72c] text-[#426d08]" : "border-transparent text-[#536170] hover:text-foreground")} aria-current={active ? "page" : undefined}>{tab.label}{tab.value !== "all" ? <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">{result.summary[tab.count]}</span> : null}</button>;
            })}
          </nav>

          <section className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]" aria-label="Service requests">
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search requests</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring" placeholder="Search requests..." />
              </label>
              <FilterSelect label="Category" value={category} onChange={(value) => updateParams({ category: value })}>
                <option value="">Category</option>{optionsQuery.data?.categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </FilterSelect>
              <FilterSelect label="Status" value={status} onChange={(value) => updateParams({ status: value, bucket: "all" })}>
                <option value="">Status</option>{Object.entries(statusMeta).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </FilterSelect>
              <FilterSelect label="Preferred time" value={preferredTime} onChange={(value) => updateParams({ preferredTime: value })}>
                <option value="">Preferred time</option><option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option><option value="weekend">Weekend</option><option value="flexible">Flexible</option>
              </FilterSelect>
              <FilterSelect label="More filters" value={urgency} onChange={(value) => updateParams({ urgency: value })} icon>
                <option value="">More filters</option><option value="FLEXIBLE">Flexible urgency</option><option value="SOON">Needed soon</option><option value="URGENT">Urgent</option>
              </FilterSelect>
              {showQueryProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  {progressLabel}
                </span>
              ) : null}
              <button type="button" onClick={clearFilters} className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted">Clear filters</button>
            </div>

            <div className="relative" aria-busy={showQueryProgress}>
              <DataTable
                columns={columns}
                data={visibleItems}
                getRowId={(row) => row.id}
                getRowLabel={(row) => `View details for ${requestTitle(row)}`}
                onRowClick={openRequest}
                mobileRow={(row) => <RequestMobileCard request={row} onOpen={openRequest} />}
                empty={
                <StatePanel
                  className="m-4 border-dashed shadow-none"
                  title={showQueryProgress ? "Checking all requests" : result.summary.total === 0 ? "No service requests yet" : "No requests match these filters"}
                  description={showQueryProgress ? "Confirming matches beyond the requests already loaded." : result.summary.total === 0 ? "Create your first request and track every response here." : "Clear a filter or try a different search."}
                >
                  {showQueryProgress ? null : result.summary.total === 0 ? <Button size="sm" onClick={openNewRequest}>Create request</Button> : <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
                </StatePanel>
                }
              />
            </div>

            <RequestPagination page={result.page} pageSize={result.pageSize} totalItems={result.totalItems} totalPages={result.totalPages} onPage={(nextPage) => updateParams({ page: nextPage }, false)} onPageSize={(nextSize) => updateParams({ pageSize: nextSize, page: 1 }, false)} />
          </section>
          {selectedRequest ? (
            <RequestDetailsDrawer
              requestId={selectedRequest.id}
              placeholder={selectedRequest.placeholder}
              onOpenChange={(open) => {
                if (!open) closeRequest();
              }}
            />
          ) : null}
        </>
      ) : null}
      {requestEditor ? (
        <RequestEditorDrawer
          editor={requestEditor}
          onOpenChange={(open) => {
            if (!open) closeRequestEditor();
          }}
          onDraftSaved={handleDraftSaved}
          onSubmitted={handleRequestSubmitted}
        />
      ) : null}
    </div>
  );
}

function requestEditorFrom(searchParams: URLSearchParams): RequestEditor | null {
  const editor = searchParams.get("editor");
  if (!editor) return null;
  if (editor !== "new") return { requestId: editor };
  const source = searchParams.get("requestSource");
  const supportedSources: ClientRequestInitial["source"][] = [
    "MARKETPLACE_DISCOVERY",
    "PROFESSIONAL_BOOKING_LINK",
    "REPEAT_CLIENT",
    "DIRECT_SERVICE_PAGE",
  ];
  return {
    initial: {
      source: supportedSources.includes(source as ClientRequestInitial["source"])
        ? (source as ClientRequestInitial["source"])
        : "MARKETPLACE_DISCOVERY",
      category: searchParams.get("requestCategory") ?? undefined,
      preferredProfessionalSlug:
        searchParams.get("requestProfessional") ?? undefined,
      preferredServiceSlug: searchParams.get("requestService") ?? undefined,
    },
  };
}

function clearEditorParams(query: URLSearchParams) {
  for (const key of [
    "editor",
    "requestSource",
    "requestCategory",
    "requestProfessional",
    "requestService",
  ]) {
    query.delete(key);
  }
}

function filterCachedRequests(
  requests: ClientServiceRequest[],
  query: RequestQueryState,
) {
  const search = query.search.trim().toLocaleLowerCase();
  const category = query.category.toLocaleLowerCase();
  const preferredTime = query.preferredTime.toLocaleLowerCase();
  return requests.filter((request) => {
    if (query.bucket !== "all" && !bucketStatuses[query.bucket].includes(request.status)) return false;
    if (query.status && request.status !== query.status) return false;
    if (category && request.category?.toLocaleLowerCase() !== category) return false;
    if (preferredTime && !request.preferredTime?.toLocaleLowerCase().includes(preferredTime)) return false;
    if (query.urgency && request.urgency !== query.urgency) return false;
    if (!search) return true;
    return [
      request.preferredServiceName,
      request.category,
      request.description,
      request.preferredProfessionalName,
    ].some((value) => value?.toLocaleLowerCase().includes(search));
  });
}

function requestQueryStateFrom(searchParams: URLSearchParams): RequestQueryState {
  const parsedPageSize = Number(searchParams.get("pageSize"));
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(parsedPageSize) ? parsedPageSize : 10,
    bucket: (searchParams.get("bucket") ?? "all") as "all" | ClientRequestBucket,
    category: searchParams.get("category") ?? "",
    status: searchParams.get("status") ?? "",
    preferredTime: searchParams.get("preferredTime") ?? "",
    urgency: searchParams.get("urgency") ?? "",
    search: searchParams.get("search") ?? "",
    sort: (searchParams.get("sort") ?? "updated_desc") as ClientRequestSort,
  };
}

function requestQuerySearch(state: RequestQueryState) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.category) params.set("category", state.category);
  if (state.status) params.set("status", state.status);
  if (state.preferredTime) params.set("preferredTime", state.preferredTime);
  if (state.urgency) params.set("urgency", state.urgency);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  return params.toString();
}

function loadRequests(state: RequestQueryState, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize), sort: state.sort });
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.category) params.set("category", state.category);
  if (state.status) params.set("status", state.status);
  if (state.preferredTime) params.set("preferredTime", state.preferredTime);
  if (state.urgency) params.set("urgency", state.urgency);
  if (state.search) params.set("search", state.search);
  return requestApi<RequestPage>(`/api/v1/client/requests?${params}`, { signal });
}

function FilterSelect({ label, value, onChange, children, icon = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; icon?: boolean }) {
  return <label className="relative"><span className="sr-only">{label}</span>{icon ? <Filter className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" /> : null}<select value={value} onChange={(event) => onChange(event.target.value)} className={cn(selectClass, icon && "pl-8")}>{children}</select></label>;
}

function SortHeader({ label, column, sort, onSort }: { label: string; column: "updated" | "category" | "status"; sort: ClientRequestSort; onSort: (column: "updated" | "category" | "status") => void }) {
  const direction = sort === `${column}_asc` ? "asc" : sort === `${column}_desc` ? "desc" : null;
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground" aria-label={`Sort by ${label}`}>{label}<Icon className="size-3" aria-hidden="true" /></button>;
}

function requestTitle(request: ClientServiceRequest) {
  return request.preferredServiceName ?? request.category ?? "Service request";
}

function RequestIdentity({ request }: { request: ClientServiceRequest }) {
  return <span className="flex min-w-[190px] items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f2eaff] text-[#7b42e8]"><ClipboardList className="size-4" aria-hidden="true" /></span><span className="min-w-0"><span className="block max-w-48 truncate font-semibold text-foreground">{requestTitle(request)}</span><span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">REQ-{request.id.slice(-6).toUpperCase()}</span></span></span>;
}

function RequestStatus({ status }: { status: ServiceRequestStatus }) {
  const meta = statusMeta[status];
  return <Badge variant={meta.variant} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium">{meta.label}</Badge>;
}

function ProfessionalCell({ request }: { request: ClientServiceRequest }) {
  if (!request.preferredProfessionalName) return <span className="text-muted-foreground">—</span>;
  const initials = request.preferredProfessionalName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <span className="flex min-w-[135px] items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">{initials}</span><span className="max-w-28 truncate font-semibold">{request.preferredProfessionalName}</span></span>;
}

function BudgetCell({ request }: { request: ClientServiceRequest }) {
  const min = request.budgetMinMinor;
  const max = request.budgetMaxMinor;
  let value = "Not set";
  if (min !== null && max !== null) value = min === max ? formatMoney(min) : `${formatMoney(min)}–${formatMoney(max)}`;
  else if (min !== null) value = `From ${formatMoney(min)}`;
  else if (max !== null) value = `Up to ${formatMoney(max)}`;
  return <span><span className="block whitespace-nowrap font-semibold">{value}</span><span className="text-[0.62rem] text-muted-foreground">Budget</span></span>;
}

function UpdatedCell({ iso }: { iso: string }) {
  const date = new Date(iso);
  return <span className="whitespace-nowrap"><span className="block font-medium">{date.toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}</span><span className="text-[0.62rem] text-muted-foreground">{date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}</span></span>;
}

function RequestAction({ request, onOpen }: { request: ClientServiceRequest; onOpen: (request: ClientServiceRequest) => void }) {
  const action = requestWorkflowAction(request);
  return <span className="flex items-center justify-end"><DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="grid size-9 place-items-center rounded-[9px] border border-black/8 hover:bg-muted" aria-label={`More actions for ${requestTitle(request)}`}><EllipsisVertical className="size-4" /></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onOpen(request)}>View details</DropdownMenuItem>{action ? <DropdownMenuItem asChild><Link href={action.href}>{action.label}</Link></DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu></span>;
}

function RequestEditorDrawer({
  editor,
  onOpenChange,
  onDraftSaved,
  onSubmitted,
}: {
  editor: RequestEditor;
  onOpenChange: (open: boolean) => void;
  onDraftSaved: (request: ClientServiceRequest) => void;
  onSubmitted: (request: ClientServiceRequest) => void;
}) {
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full w-[min(31rem,94vw)] flex-col overflow-hidden p-0"
        aria-describedby="request-editor-description"
      >
        <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3 pr-10">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[#f2eaff] text-[#7b42e8]">
              <ClipboardList className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold">
                {editor.requestId ? "Edit service request" : "New service request"}
              </SheetTitle>
              <SheetDescription
                id="request-editor-description"
                className="mt-0.5 text-xs text-muted-foreground"
              >
                {editor.requestId
                  ? "Update the information the professional needs."
                  : "Tell the professional what you need help with."}
              </SheetDescription>
            </div>
          </div>
        </div>
        <ClientRequestForm
          requestId={editor.requestId}
          initial={editor.initial}
          display="drawer"
          onDraftSaved={onDraftSaved}
          onSubmitted={onSubmitted}
        />
      </SheetContent>
    </Sheet>
  );
}

function RequestDetailsDrawer({
  requestId,
  placeholder,
  onOpenChange,
}: {
  requestId: string;
  placeholder?: ClientServiceRequest;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["client-request", requestId],
    queryFn: ({ signal }) => requestApi<ClientServiceRequest>(`/api/v1/client/requests/${requestId}`, { signal }),
    placeholderData: placeholder,
  });
  const detail = detailQuery.data ?? placeholder;
  const action = detail ? requestWorkflowAction(detail) : null;
  const secondaryAction = detail
    ? requestSecondaryAction(detail)
    : { label: "New request", href: "/client/requests?editor=new" };

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full w-[min(31rem,94vw)] flex-col overflow-hidden p-0"
        aria-describedby="request-drawer-description"
      >
        <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3 pr-10">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[#f2eaff] text-[#7b42e8]"><ClipboardList className="size-4.5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold">{detail ? requestTitle(detail) : "Request details"}</SheetTitle>
              <SheetDescription id="request-drawer-description" className="mt-0.5 text-xs text-muted-foreground">
                {detail ? `REQ-${detail.id.slice(-6).toUpperCase()} · Updated ${new Date(detail.updatedAt).toLocaleDateString("en-KE")}` : "Retrieving the latest request details."}
              </SheetDescription>
            </div>
          </div>
          {detailQuery.isFetching ? <span className="mt-4 inline-flex items-center gap-2 text-[0.68rem] text-muted-foreground" role="status"><Spinner className="size-3.5 text-[#6b9f16]" />Refreshing details…</span> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {detail ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4"><span className="text-xs font-medium text-muted-foreground">Status</span><RequestStatus status={detail.status} /></div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-xs"><DrawerDetail label="Category" value={detail.category ?? "Not set"} /><DrawerDetail label="Professional" value={detail.preferredProfessionalName ?? "Not assigned"} /><DrawerDetail label="Preferred schedule" value={detail.preferredTime ?? "Not set"} /><DrawerDetail label="Urgency" value={detail.urgency ? detail.urgency.toLowerCase().replace(/^./, (value) => value.toUpperCase()) : "Not set"} /><DrawerDetail label="Location" value={detail.location ?? "Not set"} /><div><dt className="text-muted-foreground">Budget</dt><dd className="mt-1"><BudgetCell request={detail} /></dd></div></dl>
              <div><h3 className="text-xs font-medium text-muted-foreground">Request details</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{detail.description ?? "No description provided."}</p></div>
            </div>
          ) : detailQuery.isError ? (
            <InlineAlert variant="error" title="Request unavailable" description={detailQuery.error instanceof Error ? detailQuery.error.message : "The request details could not be loaded."} />
          ) : (
            <div className="space-y-4" aria-busy="true"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-32 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-3 border-t border-black/7 bg-white px-6 py-4" aria-label="Request actions">
          <Link href={secondaryAction.href} className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>{secondaryAction.label}</Link>
          {action ? <Link href={action.href} className={cn(buttonVariants(), "flex-1")}>{action.label}</Link> : null}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function requestWorkflowAction(request: ClientServiceRequest) {
  if (request.status === "DRAFT") {
    return { label: "Continue draft", href: `/client/requests?editor=${encodeURIComponent(request.id)}` };
  }
  if (request.status === "MORE_INFORMATION_REQUIRED") {
    return { label: "Provide info", href: `/client/requests?editor=${encodeURIComponent(request.id)}` };
  }
  if (request.status === "QUOTED") {
    return { label: "Review quote", href: "/client/quotations" };
  }
  if (request.status === "CONVERTED") {
    return { label: "View booking", href: "/client/bookings" };
  }
  return null;
}

function requestSecondaryAction(request: ClientServiceRequest) {
  return request.preferredProfessionalSlug
    ? {
        label: "View professional",
        href: `/professionals/${encodeURIComponent(request.preferredProfessionalSlug)}`,
      }
    : { label: "New request", href: "/client/requests?editor=new" };
}

function DrawerDetail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>;
}

function RequestMobileCard({ request, onOpen }: { request: ClientServiceRequest; onOpen: (request: ClientServiceRequest) => void }) {
  return <article className="rounded-[14px] border border-black/7 bg-white p-4 shadow-[0_4px_14px_rgba(15,31,43,0.035)]"><div className="flex items-start justify-between gap-3"><RequestIdentity request={request} /><RequestStatus status={request.status} /></div><dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[0.7rem]"><div><dt className="text-muted-foreground">Professional</dt><dd className="mt-0.5 font-medium">{request.preferredProfessionalName ?? "Not assigned"}</dd></div><div><dt className="text-muted-foreground">Budget</dt><dd className="mt-0.5"><BudgetCell request={request} /></dd></div><div><dt className="text-muted-foreground">Preferred schedule</dt><dd className="mt-0.5 font-medium">{request.preferredTime ?? "Not set"}</dd></div><div><dt className="text-muted-foreground">Updated</dt><dd className="mt-0.5"><UpdatedCell iso={request.updatedAt} /></dd></div></dl><div className="mt-4"><RequestAction request={request} onOpen={onOpen} /></div></article>;
}

function RequestPagination({ page, pageSize, totalItems, totalPages, onPage, onPageSize }: { page: number; pageSize: number; totalItems: number; totalPages: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1);
  return <nav aria-label="Request pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3"><p className="text-[0.68rem] text-muted-foreground">Showing {start} to {end} of {totalItems} requests</p><div className="flex items-center gap-2"><label className="sr-only" htmlFor="request-page-size">Requests per page</label><select id="request-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className={cn(selectClass, "h-9")}><option value="10">10 per page</option><option value="20">20 per page</option><option value="50">50 per page</option></select><button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Previous page"><ChevronLeft className="size-4" /></button>{pages.map((item, index) => <span key={item} className="contents">{index > 0 && item - pages[index - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}<button type="button" onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined} className={cn("grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium", item === page && "border border-[#83b72c] text-[#5f8d11]")}>{item}</button></span>)}<button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className="grid size-9 place-items-center rounded-lg disabled:opacity-35" aria-label="Next page"><ChevronRight className="size-4" /></button></div></nav>;
}

function RequestsSkeleton() {
  return <div className="mt-4 space-y-3" aria-busy="true"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[84px] rounded-[16px]" />)}</div><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-[440px] rounded-[15px]" /></div>;
}

function formatMoney(minor: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minor / 100).replace("KES", "KSh");
}
