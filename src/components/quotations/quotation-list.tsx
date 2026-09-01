"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  EllipsisVertical,
  FileCheck2,
  FileText,
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type {
  ClientQuotationBucket,
  ClientQuotationSort,
  ClientQuotationValidity,
  QuotationStatus,
  QuotationSummary,
} from "@/modules/quotations/types";
import {
  getQuotation,
  listClientQuotations,
  listQuotations,
  type ClientQuotationPage,
  type ClientQuotationQuery,
  type QuotationPage,
} from "./quotation-api";
import { formatQuotationMoney } from "./quotation-view";

type StatusVariant = "neutral" | "trust" | "info" | "success" | "warning" | "danger";
type SelectedQuotation = { id: string; placeholder?: QuotationSummary };

const SEARCH_DEBOUNCE_MS = 160;
const DAY_MS = 86_400_000;
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const defaultQuery: ClientQuotationQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  category: "",
  status: "",
  validity: "",
  search: "",
  sort: "updated_desc",
};

const statusMeta: Record<QuotationStatus, { label: string; variant: StatusVariant }> = {
  DRAFT: { label: "Draft", variant: "neutral" },
  SUBMITTED: { label: "Awaiting review", variant: "warning" },
  VIEWED: { label: "Awaiting decision", variant: "info" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  DECLINED: { label: "Declined", variant: "danger" },
  REVISION_REQUESTED: { label: "Revision requested", variant: "warning" },
  REPLACED: { label: "Replaced", variant: "neutral" },
  EXPIRED: { label: "Expired", variant: "neutral" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
};

const bucketStatuses: Record<ClientQuotationBucket, QuotationStatus[]> = {
  "awaiting-decision": ["SUBMITTED", "VIEWED"],
  accepted: ["ACCEPTED"],
  "in-revision": ["REVISION_REQUESTED"],
  closed: ["DECLINED", "REPLACED", "EXPIRED", "CANCELLED"],
};

const tabs: Array<{
  value: "all" | ClientQuotationBucket;
  label: string;
  count?: "awaitingDecision" | "accepted" | "inRevision" | "closed";
}> = [
  { value: "all", label: "All" },
  { value: "awaiting-decision", label: "Awaiting decision", count: "awaitingDecision" },
  { value: "accepted", label: "Accepted", count: "accepted" },
  { value: "in-revision", label: "In revision", count: "inRevision" },
  { value: "closed", label: "Closed", count: "closed" },
];

export function QuotationList({ audience }: { audience: "client" | "professional" }) {
  return audience === "client" ? <ClientQuotationList /> : <ProfessionalQuotationList />;
}

function ClientQuotationList() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [queryState, setQueryState] = useState<ClientQuotationQuery>(() =>
    queryFromParams(searchParams),
  );
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedQuotation | null>(() => {
    const quotationId = searchParams.get("quotationId");
    return quotationId ? { id: quotationId } : null;
  });

  const updateParams = useCallback(
    (changes: Partial<ClientQuotationQuery>, resetPage = true) => {
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

  const quotationQuery = useQuery({
    queryKey: ["client-quotations", queryState],
    queryFn: ({ signal }) => listClientQuotations(queryState, signal),
    placeholderData: keepPreviousData,
  });
  const result = quotationQuery.data;
  const normalizedSearch = search.trim();
  const searchPending = normalizedSearch !== queryState.search;
  const cachedUnsearched = queryClient.getQueryData<ClientQuotationPage>([
    "client-quotations",
    { ...queryState, search: "" },
  ]);
  const filterCached = searchPending || quotationQuery.isPlaceholderData;
  const visibleItems = result
    ? filterCached
      ? filterCachedQuotations(
          searchPending || queryState.search
            ? cachedUnsearched?.items ?? result.items
            : result.items,
          { ...queryState, search: normalizedSearch },
        )
      : result.items
    : [];
  const showProgress =
    searchPending || (quotationQuery.isFetching && quotationQuery.isPlaceholderData);
  useWorkspaceContentReady(!quotationQuery.isPending);

  const openQuotation = useCallback(
    (quotation: QuotationSummary) => {
      setSelected({ id: quotation.id, placeholder: quotation });
      replaceUrl(pathname, queryString(queryState, quotation.id));
    },
    [pathname, queryState],
  );
  const closeQuotation = useCallback(() => {
    setSelected(null);
    replaceUrl(pathname, queryString(queryState));
  }, [pathname, queryState]);
  const setSort = useCallback(
    (column: "updated" | "total" | "valid_until") => {
      updateParams({
        sort:
          queryState.sort === `${column}_asc`
            ? `${column}_desc`
            : `${column}_asc`,
      });
    },
    [queryState.sort, updateParams],
  );

  const columns = useMemo<DataTableColumnDef<QuotationSummary, unknown>[]>(
    () => [
      {
        id: "quotation",
        header: "Quotation",
        cell: ({ row }) => <QuotationIdentity quotation={row.original} />,
      },
      {
        id: "professional",
        header: "Professional",
        cell: ({ row }) => <ProfessionalCell quotation={row.original} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <QuotationStatusBadge quotation={row.original} />,
      },
      {
        id: "total",
        header: () => (
          <SortHeader
            label="Total"
            column="total"
            sort={queryState.sort}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => <MoneyCell quotation={row.original} />,
      },
      {
        id: "validUntil",
        header: () => (
          <SortHeader
            label="Valid until"
            column="valid_until"
            sort={queryState.sort}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => <ValidityCell quotation={row.original} />,
      },
      {
        id: "updated",
        header: () => (
          <SortHeader
            label="Updated"
            column="updated"
            sort={queryState.sort}
            onSort={setSort}
          />
        ),
        cell: ({ row }) => <UpdatedCell iso={row.original.updatedAt} />,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <QuotationAction quotation={row.original} onOpen={openQuotation} />
        ),
      },
    ],
    [openQuotation, queryState.sort, setSort],
  );

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, "");
  };

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header>
        <p className="text-xs font-semibold text-[#6b9f16]">Client quotations</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">
          Your quotations
        </h1>
        <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
          Compare pricing and terms, respond before they expire, and keep accepted
          agreements together.
        </p>
      </header>

      {quotationQuery.isPending ? (
        <QuotationListSkeleton />
      ) : quotationQuery.isError ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Quotations unavailable"
          description={
            quotationQuery.error instanceof Error
              ? quotationQuery.error.message
              : "Quotations could not be loaded."
          }
        />
      ) : result ? (
        <>
          <section
            className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Quotation summary"
          >
            <WorkspaceMetricCard
              icon={FileText}
              tone="green"
              label="Total received"
              value={result.summary.total}
              hint="Across all statuses"
              href="/client/quotations"
              action="View quotations"
            />
            <WorkspaceMetricCard
              icon={CircleAlert}
              tone="orange"
              label="Awaiting decision"
              value={result.summary.awaitingDecision}
              hint={
                result.summary.awaitingDecision
                  ? "Your response is needed"
                  : "Nothing needs a decision"
              }
              hintTone={result.summary.awaitingDecision ? "danger" : "muted"}
              href="/client/quotations?bucket=awaiting-decision"
              action="Review now"
            />
            <WorkspaceMetricCard
              icon={CheckCircle2}
              tone="blue"
              label="Accepted"
              value={result.summary.accepted}
              hint="Preserved agreements"
              href="/client/quotations?bucket=accepted"
              action="View accepted"
            />
            <WorkspaceMetricCard
              icon={Clock3}
              tone="purple"
              label="Expiring soon"
              value={result.summary.expiringSoon}
              hint={
                result.summary.expiringSoon
                  ? "Within the next 7 days"
                  : "No urgent expiries"
              }
              hintTone={result.summary.expiringSoon ? "danger" : "muted"}
              href="/client/quotations?validity=expiring"
              action="Review validity"
            />
          </section>

          <nav
            className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6"
            aria-label="Quotation status views"
          >
            {tabs.map((tab) => {
              const active = queryState.bucket === tab.value;
              const count = tab.count ? result.summary[tab.count] : null;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateParams({ bucket: tab.value, status: "" })}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition",
                    active
                      ? "border-[#83b72c] text-[#426d08]"
                      : "border-transparent text-[#536170] hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                  {count !== null ? (
                    <span className="rounded-full bg-[#edf1f3] px-2 py-0.5 text-[0.64rem] font-semibold text-[#536170]">
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <section
            className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]"
            aria-label="Client quotations"
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search quotations</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder="Search quotations..."
                />
              </label>
              <FilterSelect
                label="Category"
                value={queryState.category}
                onChange={(category) => updateParams({ category })}
              >
                <option value="">Category</option>
                {result.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Status"
                value={queryState.status}
                onChange={(status) => updateParams({ status, bucket: "all" })}
              >
                <option value="">Status</option>
                {Object.entries(statusMeta)
                  .filter(([status]) => status !== "DRAFT")
                  .map(([status, meta]) => (
                    <option key={status} value={status}>
                      {meta.label}
                    </option>
                  ))}
              </FilterSelect>
              <FilterSelect
                label="Validity"
                value={queryState.validity}
                onChange={(validity) =>
                  updateParams({
                    validity: validity as "" | ClientQuotationValidity,
                  })
                }
              >
                <option value="">Validity</option>
                <option value="valid">Currently valid</option>
                <option value="expiring">Expiring soon</option>
                <option value="expired">Expired</option>
              </FilterSelect>
              {showProgress ? (
                <span
                  className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]"
                  role="status"
                  aria-live="polite"
                >
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating quotations…
                </span>
              ) : null}
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto min-h-10 rounded-[10px] border border-black/8 px-4 text-[0.7rem] font-medium text-[#536170] transition hover:bg-muted"
              >
                Clear filters
              </button>
            </div>

            <div className="relative" aria-busy={showProgress}>
              <DataTable
                columns={columns}
                data={visibleItems}
                getRowId={(row) => row.id}
                getRowLabel={(row) =>
                  `View quotation for ${row.requestCategory} from ${row.providerName}`
                }
                onRowClick={openQuotation}
                mobileRow={(row) => <QuotationMobileCard quotation={row} />}
                empty={
                  <StatePanel
                    className="m-4 border-dashed shadow-none"
                    title={
                      result.summary.total === 0
                        ? "No quotations yet"
                        : "No quotations match these filters"
                    }
                    description={
                      result.summary.total === 0
                        ? "Submitted quotations from professionals will appear here."
                        : "Clear a filter or try a different search."
                    }
                  >
                    {result.summary.total > 0 ? (
                      <Button size="sm" variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null}
                  </StatePanel>
                }
              />
            </div>
            <QuotationPagination
              page={result.page}
              pageSize={result.pageSize}
              totalItems={result.totalItems}
              totalPages={result.totalPages}
              onPage={(page) => updateParams({ page }, false)}
              onPageSize={(pageSize) =>
                updateParams({ pageSize, page: 1 }, false)
              }
            />
          </section>

          {selected ? (
            <QuotationSummaryDrawer
              selected={selected}
              onOpenChange={(open) => {
                if (!open) closeQuotation();
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ProfessionalQuotationList() {
  const [result, setResult] = useState<QuotationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listQuotations("professional")
      .then(setResult)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Quotations could not be loaded.",
        ),
      );
  }, []);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Professional workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            Quotations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Prepare versioned commercial terms and track client decisions.
          </p>
        </div>
        <Link
          href="/professional/enquiries"
          className={buttonVariants({ variant: "primary" })}
        >
          Select an enquiry
        </Link>
      </div>
      {error ? (
        <InlineAlert
          className="mt-6"
          variant="error"
          title="Quotations unavailable"
          description={error}
        />
      ) : !result ? (
        <div className="mt-6 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <StatePanel
          className="mt-6"
          variant="empty"
          icon={<FileText className="size-5" />}
          title="No quotations yet"
          description="Open an eligible enquiry to prepare the first quotation."
        />
      ) : (
        <Surface className="mt-6 overflow-hidden p-0 shadow-none">
          {result.items.map((quotation) => (
            <Link
              key={quotation.id}
              href={`/professional/quotations/${quotation.id}`}
              className="group grid gap-4 border-b border-black/8 p-5 last:border-0 hover:bg-[#fbfcf9] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <QuotationStatusBadge status={quotation.status} />
                  <span className="text-xs text-[#7a838c]">
                    Version {quotation.currentVersionNumber}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">
                  {quotation.requestCategory}
                </h2>
                <p className="mt-1 text-sm text-[#68717b]">
                  {quotation.clientName}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-semibold">
                  {formatQuotationMoney(
                    quotation.currentTotalMinor,
                    quotation.currency,
                  )}
                </p>
                <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                  Open
                  <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </Surface>
      )}
    </div>
  );
}

function QuotationSummaryDrawer({
  selected,
  onOpenChange,
}: {
  selected: SelectedQuotation;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["client-quotation", selected.id],
    queryFn: ({ signal }) => getQuotation("client", selected.id, signal),
  });
  const detail = detailQuery.data;
  const summary = detail ?? selected.placeholder;
  const currentVersion = detail?.versions.find(
    (version) => version.versionNumber === detail.currentVersionNumber,
  );
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full w-[min(31rem,94vw)] flex-col overflow-hidden p-0"
        aria-describedby="quotation-drawer-description"
      >
        <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6">
          <div className="flex items-center gap-3 pr-10">
            <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[#edf7dd] text-[#6d9f16]">
              <FileCheck2 className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg font-semibold">
                {summary?.requestCategory ?? "Quotation details"}
              </SheetTitle>
              <SheetDescription
                id="quotation-drawer-description"
                className="mt-0.5 text-xs text-muted-foreground"
              >
                {summary
                  ? `QUO-${summary.id.slice(-6).toUpperCase()} · Version ${summary.currentVersionNumber}`
                  : "Retrieving the latest quotation."}
              </SheetDescription>
            </div>
          </div>
          {detailQuery.isFetching ? (
            <span
              className="mt-4 inline-flex items-center gap-2 text-[0.68rem] text-muted-foreground"
              role="status"
            >
              <Spinner className="size-3.5 text-[#6b9f16]" />
              Refreshing quotation…
            </span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {detailQuery.isError ? (
            <InlineAlert
              variant="error"
              title="Quotation unavailable"
              description={
                detailQuery.error instanceof Error
                  ? detailQuery.error.message
                  : "The quotation could not be loaded."
              }
            />
          ) : summary ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-muted-foreground">
                  Status
                </span>
                <QuotationStatusBadge quotation={summary} />
              </div>
              <dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-xs">
                <DrawerDetail label="Professional" value={summary.providerName} />
                <DrawerDetail
                  label="Current total"
                  value={formatQuotationMoney(
                    summary.currentTotalMinor,
                    summary.currency,
                  )}
                />
                <DrawerDetail
                  label="Valid until"
                  value={formatDateTime(summary.validUntil)}
                />
                <DrawerDetail
                  label="Updated"
                  value={formatDateTime(summary.updatedAt)}
                />
                {currentVersion ? (
                  <>
                    <DrawerDetail
                      label="Deposit"
                      value={formatQuotationMoney(
                        currentVersion.depositMinor,
                        currentVersion.currency,
                      )}
                    />
                    <DrawerDetail
                      label="Expected duration"
                      value={formatDuration(
                        currentVersion.expectedDurationMinutes,
                      )}
                    />
                    <DrawerDetail
                      label="Proposed start"
                      value={formatDateTime(currentVersion.proposedStartAt)}
                    />
                  </>
                ) : null}
              </dl>
              {currentVersion ? (
                <>
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Price breakdown
                    </h3>
                    <dl className="mt-3 space-y-2">
                      {currentVersion.lineItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <dt className="min-w-0">
                            <span className="block font-medium">
                              {item.description}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Qty {item.quantity}
                            </span>
                          </dt>
                          <dd className="shrink-0 font-semibold">
                            {formatQuotationMoney(
                              item.totalMinor,
                              currentVersion.currency,
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <DrawerSection label="Scope" value={currentVersion.scope} />
                  <DrawerSection
                    label="Warranty"
                    value={currentVersion.warrantyTerms}
                  />
                  <DrawerSection
                    label="Payment terms"
                    value={currentVersion.paymentTerms}
                  />
                </>
              ) : null}
            </div>
          ) : (
            <QuotationDrawerSkeleton />
          )}
        </div>
        {summary ? (
          <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4">
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              <a
                href={`/api/v1/client/quotations/${summary.id}/download`}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                <Download className="size-4" />
                Download
              </a>
              <Link
                href={
                  detail?.status === "ACCEPTED" && detail.bookingId
                    ? `/client/bookings/${detail.bookingId}`
                    : `/client/quotations/${summary.id}`
                }
                className={buttonVariants({
                  variant: "primary",
                  className: "w-full",
                })}
              >
                {detail?.status === "ACCEPTED" && detail.bookingId
                  ? "View booking"
                  : isDecisionEligible(summary)
                    ? "Review and decide"
                    : "Open quotation"}
              </Link>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {children}
      </select>
    </label>
  );
}

function QuotationIdentity({ quotation }: { quotation: QuotationSummary }) {
  return (
    <span className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#edf7dd] text-[#6d9f16]">
        <FileText className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-48 truncate font-semibold text-foreground">
          {quotation.requestCategory}
        </span>
        <span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">
          QUO-{quotation.id.slice(-6).toUpperCase()} · v
          {quotation.currentVersionNumber}
        </span>
      </span>
    </span>
  );
}

function ProfessionalCell({ quotation }: { quotation: QuotationSummary }) {
  const initials = quotation.providerName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex min-w-[135px] items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">
        {initials}
      </span>
      <span className="max-w-32 truncate font-semibold">
        {quotation.providerName}
      </span>
    </span>
  );
}

function QuotationStatusBadge({
  status,
  quotation,
}: {
  status?: QuotationStatus;
  quotation?: QuotationSummary;
}) {
  const effectiveStatus = quotation
    ? effectiveQuotationStatus(quotation)
    : status ?? "DRAFT";
  const meta = statusMeta[effectiveStatus];
  return (
    <Badge
      variant={meta.variant}
      className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium"
    >
      {meta.label}
    </Badge>
  );
}

function MoneyCell({ quotation }: { quotation: QuotationSummary }) {
  return (
    <span>
      <span className="block whitespace-nowrap font-semibold">
        {formatQuotationMoney(
          quotation.currentTotalMinor,
          quotation.currency,
        )}
      </span>
      <span className="text-[0.62rem] text-muted-foreground">
        Current total
      </span>
    </span>
  );
}

function ValidityCell({ quotation }: { quotation: QuotationSummary }) {
  const validity = quotationValidity(quotation);
  return (
    <span className="flex min-w-28 items-start gap-2">
      <CalendarClock
        className={cn("mt-0.5 size-3.5 shrink-0", validity.tone)}
        aria-hidden="true"
      />
      <span>
        <span className="block whitespace-nowrap font-medium">
          {formatDate(quotation.validUntil)}
        </span>
        <span className={cn("text-[0.62rem]", validity.tone)}>
          {validity.label}
        </span>
      </span>
    </span>
  );
}

function UpdatedCell({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <span className="whitespace-nowrap">
      <span className="block font-medium">
        {date.toLocaleDateString("en-KE", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </span>
      <span className="text-[0.62rem] text-muted-foreground">
        {date.toLocaleTimeString("en-KE", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </span>
    </span>
  );
}

function QuotationAction({
  quotation,
  onOpen,
}: {
  quotation: QuotationSummary;
  onOpen: (quotation: QuotationSummary) => void;
}) {
  return (
    <span className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[9px] border border-black/8 hover:bg-muted"
            aria-label={`More actions for ${quotation.requestCategory}`}
          >
            <EllipsisVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onOpen(quotation)}>
            View summary
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/client/quotations/${quotation.id}`}>
              {isDecisionEligible(quotation)
                ? "Review and decide"
                : "Open quotation"}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function QuotationMobileCard({
  quotation,
}: {
  quotation: QuotationSummary;
}) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <QuotationIdentity quotation={quotation} />
        <QuotationStatusBadge quotation={quotation} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-black/6 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Professional</p>
          <p className="mt-1 truncate font-semibold">
            {quotation.providerName}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="mt-1 font-semibold">
            {formatQuotationMoney(
              quotation.currentTotalMinor,
              quotation.currency,
            )}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Valid until</p>
          <p className="mt-1 font-medium">{formatDate(quotation.validUntil)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Updated</p>
          <p className="mt-1 font-medium">{formatDate(quotation.updatedAt)}</p>
        </div>
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
  column: "updated" | "total" | "valid_until";
  sort: ClientQuotationSort;
  onSort: (column: "updated" | "total" | "valid_until") => void;
}) {
  const direction =
    sort === `${column}_asc`
      ? "asc"
      : sort === `${column}_desc`
        ? "desc"
        : null;
  const Icon =
    direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className="size-3" aria-hidden="true" />
    </button>
  );
}

function QuotationPagination({
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
  const pages = Array.from(
    new Set(
      [1, page - 1, page, page + 1, totalPages].filter(
        (item) => item >= 1 && item <= totalPages,
      ),
    ),
  ).sort((a, b) => a - b);
  return (
    <nav
      aria-label="Quotation pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3"
    >
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} quotations
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="quotation-page-size">
          Quotations per page
        </label>
        <select
          id="quotation-page-size"
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className={cn(selectClass, "h-9")}
        >
          <option value="10">10 per page</option>
          <option value="20">20 per page</option>
          <option value="50">50 per page</option>
        </select>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="grid size-9 place-items-center rounded-lg disabled:opacity-35"
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((item, index) => (
          <span key={item} className="contents">
            {index > 0 && item - pages[index - 1] > 1 ? (
              <span className="px-1 text-muted-foreground">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPage(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "grid size-9 place-items-center rounded-lg text-[0.7rem] font-medium",
                item === page &&
                  "border border-[#83b72c] text-[#5f8d11]",
              )}
            >
              {item}
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="grid size-9 place-items-center rounded-lg disabled:opacity-35"
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </nav>
  );
}

function DrawerDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold leading-5 text-foreground">{value}</dd>
    </div>
  );
}

function DrawerSection({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
        {value}
      </p>
    </section>
  );
}

function QuotationListSkeleton() {
  return (
    <div className="mt-4 space-y-3" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-32 rounded-[16px]" />
        ))}
      </div>
      <Skeleton className="h-11 rounded-none" />
      <Skeleton className="h-[430px] rounded-[15px]" />
    </div>
  );
}

function QuotationDrawerSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-28 rounded-full" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-[12px]" />
      <Skeleton className="h-24 rounded-[12px]" />
    </div>
  );
}

function queryFromParams(searchParams: URLSearchParams): ClientQuotationQuery {
  const pageSize = Number(searchParams.get("pageSize"));
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
    bucket: (searchParams.get("bucket") ?? "all") as
      | "all"
      | ClientQuotationBucket,
    category: searchParams.get("category") ?? "",
    status: searchParams.get("status") ?? "",
    validity: (searchParams.get("validity") ?? "") as
      | ""
      | ClientQuotationValidity,
    search: searchParams.get("search") ?? "",
    sort: (searchParams.get("sort") ?? "updated_desc") as ClientQuotationSort,
  };
}

function queryString(state: ClientQuotationQuery, quotationId?: string) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.category) params.set("category", state.category);
  if (state.status) params.set("status", state.status);
  if (state.validity) params.set("validity", state.validity);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  if (quotationId) params.set("quotationId", quotationId);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(
    window.history.state,
    "",
    query ? `${pathname}?${query}` : pathname,
  );
}

function filterCachedQuotations(
  items: QuotationSummary[],
  query: ClientQuotationQuery,
) {
  const search = query.search.toLocaleLowerCase();
  const now = Date.now();
  return items.filter((quotation) => {
    if (query.bucket === "awaiting-decision" && !isDecisionEligible(quotation, now)) {
      return false;
    }
    if (query.bucket === "closed") {
      const closed = bucketStatuses.closed.includes(quotation.status);
      const effectivelyExpired = effectiveQuotationStatus(quotation, now) === "EXPIRED";
      if (!closed && !effectivelyExpired) return false;
    }
    if (
      query.bucket !== "all" &&
      query.bucket !== "awaiting-decision" &&
      query.bucket !== "closed" &&
      !bucketStatuses[query.bucket].includes(quotation.status)
    ) {
      return false;
    }
    if (query.status && quotation.status !== query.status) return false;
    if (query.category && quotation.requestCategory !== query.category) {
      return false;
    }
    const validUntil = quotation.validUntil
      ? new Date(quotation.validUntil).getTime()
      : 0;
    if (query.validity === "valid" && validUntil <= now) return false;
    if (
      query.validity === "expiring" &&
      (!bucketStatuses["awaiting-decision"].includes(quotation.status) ||
        validUntil <= now ||
        validUntil > now + 7 * DAY_MS)
    ) {
      return false;
    }
    if (
      query.validity === "expired" &&
      quotation.status !== "EXPIRED" &&
      validUntil >= now
    ) {
      return false;
    }
    return (
      !search ||
      quotation.requestCategory.toLocaleLowerCase().includes(search) ||
      quotation.providerName.toLocaleLowerCase().includes(search)
    );
  });
}

function quotationValidity(quotation: QuotationSummary) {
  if (!quotation.validUntil) {
    return { label: "No expiry set", tone: "text-muted-foreground" };
  }
  const remaining = new Date(quotation.validUntil).getTime() - Date.now();
  if (quotation.status === "EXPIRED" || remaining <= 0) {
    return { label: "Expired", tone: "text-danger" };
  }
  if (
    bucketStatuses["awaiting-decision"].includes(quotation.status) &&
    remaining <= 7 * DAY_MS
  ) {
    return { label: "Expiring soon", tone: "text-[#d16b16]" };
  }
  return { label: "Currently valid", tone: "text-[#5f8d11]" };
}

function isDecisionEligible(quotation: QuotationSummary, now = Date.now()) {
  return (
    bucketStatuses["awaiting-decision"].includes(quotation.status) &&
    Boolean(quotation.validUntil) &&
    new Date(quotation.validUntil!).getTime() > now
  );
}

function effectiveQuotationStatus(
  quotation: QuotationSummary,
  now = Date.now(),
): QuotationStatus {
  if (
    bucketStatuses["awaiting-decision"].includes(quotation.status) &&
    quotation.validUntil &&
    new Date(quotation.validUntil).getTime() <= now
  ) {
    return "EXPIRED";
  }
  return quotation.status;
}

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-KE", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";
}

function formatDateTime(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not set";
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours
    ? `${hours} hr${hours === 1 ? "" : "s"}${remaining ? ` ${remaining} min` : ""}`
    : `${minutes} min`;
}
