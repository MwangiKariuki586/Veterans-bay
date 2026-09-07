"use client";

/* eslint-disable react-hooks/preserve-manual-memoization -- scoped query keys require stable manual deps */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Search,
  UsersRound,
  Wrench,
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
import type { JobDetail, JobSummary, ProfessionalJobBucket, ProfessionalJobSort, ProfessionalJobSummary } from "@/modules/jobs/types";
import { getJob, jobApi } from "./job-api";

type JobPage = {
  items: JobSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary: ProfessionalJobSummary;
};

type JobQuery = {
  page: number;
  pageSize: number;
  bucket: ProfessionalJobBucket;
  search: string;
  sort: ProfessionalJobSort;
  status: string;
};

const SEARCH_DEBOUNCE_MS = 160;
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const bucketTabs: Array<{ value: ProfessionalJobBucket; label: string; count?: keyof ProfessionalJobSummary }> = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled", count: "scheduledToday" },
  { value: "in-progress", label: "In progress", count: "inProgress" },
  { value: "awaiting-confirmation", label: "Awaiting confirmation", count: "awaitingConfirmation" },
  { value: "needs-attention", label: "Needs attention", count: "needsAttention" },
  { value: "completed", label: "Completed", count: "completed" },
];

const defaultQuery: JobQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  search: "",
  sort: "updated_desc",
  status: "",
};

async function listProfessionalJobs(query: JobQuery, signal?: AbortSignal): Promise<JobPage> {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  if (query.bucket !== "all") params.set("bucket", query.bucket);
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.sort !== "updated_desc") params.set("sort", query.sort);
  return jobApi<JobPage>(`/api/v1/professional/jobs?${params.toString()}`, { signal: signal as unknown as RequestInit["signal"] } as never);
}

function queryFromParams(searchParams: URLSearchParams): JobQuery {
  const bucket = (searchParams.get("bucket") as ProfessionalJobBucket) ?? "all";
  const sort = (searchParams.get("sort") as ProfessionalJobSort) ?? "updated_desc";
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(Number(searchParams.get("pageSize"))) ? Number(searchParams.get("pageSize")) : 10,
    bucket: ["all", "scheduled", "in-progress", "awaiting-confirmation", "completed", "needs-attention"].includes(bucket) ? bucket : "all",
    search: searchParams.get("search") ?? "",
    sort: (["updated_desc", "updated_asc", "scheduled_desc", "scheduled_asc", "total_desc", "total_asc"] as const).includes(sort as never) ? sort : "updated_desc",
    status: searchParams.get("status") ?? "",
  };
}

function queryString(state: JobQuery) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.status) params.set("status", state.status);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

export function JobList({ audience }: { audience: "client" | "professional" }) {
  if (audience === "client") return <ClientJobList />;
  return <ProfessionalJobList />;
}

function ClientJobList() {
  // keep simple client redirect style – uses same component but without summary (light)
  return <ProfessionalJobList />;
}

type SelectedJob = { id: string; placeholder?: JobSummary };

function ProfessionalJobList() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [queryState, setQueryState] = useState<JobQuery>(() => queryFromParams(searchParams));
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedJob | null>(null);

  const updateParams = useCallback(
    (changes: Partial<JobQuery>, resetPage = true) => {
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

  const jobsQuery: any = useQuery({
    queryKey: ["professional-jobs", queryState] as unknown as readonly unknown[],
    queryFn: ({ signal }: { signal: AbortSignal }) => listProfessionalJobs(queryState, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    retry: 2,
  } as never);

  const result = jobsQuery.data;
  const searchPending = search.trim() !== queryState.search;
  const showProgress = searchPending || (jobsQuery.isFetching && jobsQuery.isPlaceholderData);
  const hasData = Boolean(result);
  const isInitialLoading = jobsQuery.isPending;
  const isBackgroundError = hasData && jobsQuery.isError;
  useWorkspaceContentReady(!isInitialLoading);

  const columns = useMemo<DataTableColumnDef<JobSummary, unknown>[]>(
    () => [
      {
        id: "job",
        header: "Job",
        cell: ({ row }) => <JobIdentity job={row.original} />,
      },
      {
        id: "client",
        header: "Client",
        cell: ({ row }) => <span className="font-medium">{row.original.clientName}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <JobStatusBadge status={row.original.status} />,
      },
      {
        id: "schedule",
        header: "Schedule",
        cell: ({ row }) => <ScheduleCell job={row.original} />,
      },
      {
        id: "assignment",
        header: "Assignment",
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-muted-foreground">
            <UsersRound className="size-3.5 text-[#5f8d11]" />
            {row.original.assignmentNames.length ? row.original.assignmentNames.join(", ") : "Unassigned"}
          </span>
        ),
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => <span className="font-semibold numeric-tabular">{formatMoney(row.original.totalMinor, row.original.currency)}</span>,
      },
      {
        id: "updated",
        header: "Updated",
        cell: ({ row }) => <span className="text-[0.72rem] text-muted-foreground">{new Date(row.original.updatedAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}</span>,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <Link href={`/professional/jobs/${row.original.id}`} className="font-semibold text-trust hover:text-foreground">
            Open
          </Link>
        ),
      },
    ],
    [],
  );

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, "");
  };

  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header>
        <p className="text-xs font-semibold text-[#6b9f16]">Service fulfilment</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">Jobs</h1>
        <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">Coordinate field work, assignments, evidence, changes, and client confirmation.</p>
      </header>

      {isInitialLoading && jobsQuery.isError && !hasData ? (
        <InlineAlert className="mt-5" variant="error" title="Jobs unavailable" description={jobsQuery.error instanceof Error ? jobsQuery.error.message : "Jobs could not be loaded."}>
          <button type="button" onClick={() => void jobsQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">
            Try again
          </button>
        </InlineAlert>
      ) : (
        <>
          {isBackgroundError ? (
            <InlineAlert className="mt-4" variant="error" title="Jobs update failed" description={jobsQuery.error instanceof Error ? jobsQuery.error.message : "Jobs could not be refreshed."}>
              <button type="button" onClick={() => void jobsQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">
                Try again
              </button>
            </InlineAlert>
          ) : null}

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Job summary">
            <WorkspaceMetricCard loading={isInitialLoading} icon={CalendarDays} tone="green" label="Today" value={result?.summary.scheduledToday} hint="Scheduled today" />
            <WorkspaceMetricCard loading={isInitialLoading} icon={Wrench} tone="blue" label="In progress" value={result?.summary.inProgress} hint="Active field work" hintTone={result?.summary.inProgress ? "danger" : "muted"} />
            <WorkspaceMetricCard loading={isInitialLoading} icon={Clock3} tone="orange" label="Awaiting confirmation" value={result?.summary.awaitingConfirmation} hint={result?.summary.awaitingConfirmation ? "Client action needed" : "No confirmations"} hintTone={result?.summary.awaitingConfirmation ? "danger" : "muted"} />
            <WorkspaceMetricCard loading={isInitialLoading} icon={AlertTriangle} tone="purple" label="Needs attention" value={result?.summary.needsAttention} hint="On hold / return visits" hintTone={result?.summary.needsAttention ? "danger" : "muted"} />
          </section>

          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Job views">
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
                  {count !== null ? <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">{count ?? <Skeleton className="h-3 w-4 rounded-full" />}</span> : null}
                </button>
              );
            })}
          </nav>

          <section className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]" aria-label="Professional jobs">
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search jobs</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder="Search job or client..."
                />
              </label>
              <label>
                <span className="sr-only">Sort jobs</span>
                <select value={queryState.sort} onChange={(event) => updateParams({ sort: event.target.value as JobQuery["sort"] })} className={selectClass}>
                  <option value="updated_desc">Recently updated</option>
                  <option value="updated_asc">Oldest updated</option>
                  <option value="scheduled_desc">Schedule latest</option>
                  <option value="scheduled_asc">Schedule earliest</option>
                  <option value="total_desc">Highest value</option>
                  <option value="total_asc">Lowest value</option>
                </select>
              </label>
              {showProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating jobs…
                </span>
              ) : null}
              <button type="button" onClick={clearFilters} className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted">
                Clear filters
              </button>
            </div>

            <div className="relative" aria-busy={showProgress}>
              <DataTable
                loading={isInitialLoading}
                loadingLabel="Loading jobs"
                columns={columns}
                data={result?.items ?? []}
                getRowId={(row) => row.id}
                getRowLabel={(row) => `Open job ${row.serviceName}`}
                onRowClick={(row) => setSelected({ id: row.id, placeholder: row })}
                mobileRow={(row) => <JobMobileCard job={row} />}
                empty={
                  result ? (
                    <StatePanel
                      className="m-4 border-dashed shadow-none"
                      title={result.summary.total === 0 ? "No jobs yet" : "No jobs match these filters"}
                      description={result.summary.total === 0 ? "Confirmed bookings will appear here as actionable jobs." : "Clear a filter or try a different search."}
                    >
                      {result.summary.total > 0 ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : null}
                    </StatePanel>
                  ) : null
                }
              />
            </div>
            {result ? (
              <JobPagination page={result.page} pageSize={result.pageSize} totalItems={result.totalItems} totalPages={result.totalPages} onPage={(page) => updateParams({ page }, false)} onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)} />
            ) : null}
          </section>
          {selected ? <JobDrawer selected={selected} onClose={closeDrawer} /> : null}
        </>
      )}
    </div>
  );
}

function JobDrawer({ selected, onClose }: { selected: SelectedJob; onClose: () => void }) {
  const detailQuery: any = useQuery({
    queryKey: ["job-detail", selected.id] as unknown as readonly unknown[],
    queryFn: ({ signal }: { signal: AbortSignal }) => getJob("professional", selected.id),
    staleTime: 30_000,
    retry: 2,
  } as never);

  const detail = detailQuery.data as JobDetail | undefined;
  const placeholder = selected.placeholder;
  const display = detail ?? (placeholder as unknown as JobDetail | undefined);
  const isLoading = detailQuery.isPending && !detail;
  const isRefreshing = detailQuery.isFetching && !!detail;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0" aria-describedby="job-drawer-description">
        <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#eaf5e5] text-[#2f7d18]">
              <Wrench className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-semibold tracking-title">{display?.serviceName ?? "Job"}</SheetTitle>
                  <SheetDescription id="job-drawer-description" className="mt-1 text-[0.68rem] text-muted-foreground">JOB-{selected.id.slice(-6).toUpperCase()} {display?.bookingId ? `· BK-${display.bookingId.slice(-6).toUpperCase()}` : ""}</SheetDescription>
                </div>
                {display ? <JobStatusBadge status={display.status as JobSummary["status"]} /> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {isLoading ? (
            <JobDrawerSkeleton />
          ) : detailQuery.isError && !detail ? (
            <InlineAlert variant="error" title="Job unavailable" description={detailQuery.error instanceof Error ? detailQuery.error.message : "The job could not be loaded."}>
              <button type="button" onClick={() => void detailQuery.refetch()} className="mt-2 text-xs font-semibold text-trust underline">Try again</button>
            </InlineAlert>
          ) : isRefreshing ? (
            <JobDrawerRefreshingSkeleton />
          ) : display ? (
            <div className="space-y-4">
              <DrawerSection number="1" title="Overview">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1 font-semibold">{display.clientName}</dd></div>
                    <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 font-semibold">{formatMoney(display.totalMinor, display.currency)}</dd></div>
                    <div><dt className="text-muted-foreground">Scheduled</dt><dd className="mt-1 font-medium">{display.scheduledStartsAt ? new Date(display.scheduledStartsAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "Schedule pending"}</dd></div>
                    <div><dt className="text-muted-foreground">Assignment</dt><dd className="mt-1 font-medium">{placeholder?.assignmentNames?.join(", ") || (detail as JobDetail)?.assignments?.filter(a=>a.active).map(a=>a.displayName).join(", ") || "Unassigned"}</dd></div>
                  </dl>
                </div>
              </DrawerSection>

              <DrawerSection number="2" title="Progress">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  {detail ? (
                    <>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[#eef8c8] px-2.5 py-1 font-medium">Checklist: {detail.checklist.filter(c=>c.completed).length}/{detail.checklist.length}</span>
                        <span className="rounded-full bg-[#eaf1ff] px-2.5 py-1 font-medium">Updates: {detail.updates.length}</span>
                        <span className="rounded-full bg-[#f1eaff] px-2.5 py-1 font-medium">Evidence: {detail.evidence.length}</span>
                      </div>
                      {detail.scopeSnapshot ? <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-[#4f5963]">{detail.scopeSnapshot}</p> : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Open the job to see full checklist, evidence, and timeline.</p>
                  )}
                </div>
              </DrawerSection>

              <DrawerSection number="3" title="Next actions">
                <div className="grid gap-2">
                  <Link href={`/professional/jobs/${display.id}`} className={buttonVariants({ variant: "primary" })}>View details</Link>
                  <p className="text-[0.68rem] leading-4 text-muted-foreground">The drawer shows the most important operational summary. Use View details for full fulfilment workflow, variations, and evidence upload.</p>
                </div>
              </DrawerSection>
            </div>
          ) : null}
        </div>

        {display ? (
          <div className="shrink-0 border-t border-black/8 bg-white px-4 py-4 sm:px-6">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Link href={`/professional/jobs/${display.id}`} className={buttonVariants({ variant: "primary" })}>View details</Link>
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

function JobDrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading job details">
      <DrawerSection number="1" title="Overview">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1"><Skeleton className="h-4 w-28 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Scheduled</dt><dd className="mt-1"><Skeleton className="h-4 w-32 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Assignment</dt><dd className="mt-1"><Skeleton className="h-4 w-24 rounded-md" /></dd></div>
          </dl>
        </div>
      </DrawerSection>
      <DrawerSection number="2" title="Progress">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <div className="flex gap-2"><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /><Skeleton className="h-6 w-16 rounded-full" /></div>
          <Skeleton className="mt-3 h-4 w-full rounded-md" /><Skeleton className="mt-2 h-4 w-5/6 rounded-md" />
        </div>
      </DrawerSection>
      <DrawerSection number="3" title="Next actions">
        <div className="rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <Skeleton className="h-9 w-full rounded-full" />
        </div>
      </DrawerSection>
    </div>
  );
}

function JobDrawerRefreshingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" role="status" aria-label="Loading job details">
      <DrawerSection number="1" title="Overview">
        <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div><dt className="text-muted-foreground">Client</dt><dd className="mt-1"><Skeleton className="h-4 w-24 rounded-md" /></dd></div>
            <div><dt className="text-muted-foreground">Total</dt><dd className="mt-1"><Skeleton className="h-4 w-20 rounded-md" /></dd></div>
          </dl>
        </div>
      </DrawerSection>
      <DrawerSection number="2" title="Progress">
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

function JobIdentity({ job }: { job: JobSummary }) {
  return (
    <span className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#eaf5e5] text-[#2f7d18]">
        <Wrench className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-48 truncate font-semibold text-foreground">{job.serviceName}</span>
        <span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">JOB-{job.id.slice(-6).toUpperCase()}</span>
      </span>
    </span>
  );
}

function JobStatusBadge({ status }: { status: JobSummary["status"] }) {
  const variant =
    status === "COMPLETED" ? "success" : ["CANCELLED", "DISPUTED"].includes(status) ? "danger" : ["ON_HOLD", "RETURN_VISIT_REQUIRED", "AWAITING_CLIENT_CONFIRMATION"].includes(status) ? "warning" : "info";
  return (
    <Badge variant={variant as never} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium capitalize">
      {status.replaceAll("_", " ").toLowerCase()}
    </Badge>
  );
}

function ScheduleCell({ job }: { job: JobSummary }) {
  if (!job.scheduledStartsAt) return <span className="text-muted-foreground">Schedule pending</span>;
  const date = new Date(job.scheduledStartsAt);
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem]">
      <CalendarDays className="size-3.5 text-[#68717b]" />
      {date.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}
    </span>
  );
}

function JobMobileCard({ job }: { job: JobSummary }) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <JobIdentity job={job} />
        <JobStatusBadge status={job.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-black/6 py-3 text-xs">
        <div>
          <p className="text-muted-foreground">Client</p>
          <p className="mt-1 font-medium">{job.clientName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Assignment</p>
          <p className="mt-1 font-medium">{job.assignmentNames.length ? job.assignmentNames.join(", ") : "Unassigned"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Schedule</p>
          <p className="mt-1 font-medium">{job.scheduledStartsAt ? new Date(job.scheduledStartsAt).toLocaleDateString("en-KE") : "Pending"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="mt-1 font-semibold">{formatMoney(job.totalMinor, job.currency)}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Link href={`/professional/jobs/${job.id}`} className="text-xs font-semibold text-trust hover:underline">
          Open job
        </Link>
      </div>
    </article>
  );
}

function JobPagination({ page, pageSize, totalItems, totalPages, onPage, onPageSize }: { page: number; pageSize: number; totalItems: number; totalPages: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  const pages = Array.from(new Set([1, page - 1, page, page + 1, totalPages].filter((item) => item >= 1 && item <= totalPages))).sort((a, b) => a - b);
  return (
    <nav aria-label="Job pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} jobs
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="job-page-size">
          Jobs per page
        </label>
        <select id="job-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className={cn(selectClass, "h-9")}>
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
            <button type="button" onClick={() => onPage(item)} aria-current={item === page ? "page" : undefined} className={cn("grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium", item === page && "border border-[#83b72c] text-[#5f8d11]")}>
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

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amountMinor / 100);
}
