"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  EllipsisVertical,
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
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type { BookingBucket, BookingSort, BookingStatus, ClientBookingStage } from "@/modules/bookings/types";
import type { JobStatus } from "@/modules/jobs/types";
import { bookingAction, getBooking, listBookingsPage, type BookingListQuery, type BookingPage } from "./booking-api";
import type { BookingDetail, BookingSummary } from "@/modules/bookings/types";

type StatusVariant = "neutral" | "trust" | "info" | "success" | "warning" | "danger";
type SelectedBooking = { id: string; placeholder?: BookingSummary };

const SEARCH_DEBOUNCE_MS = 160;

const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const defaultQuery: BookingListQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  stage: "all",
  status: "",
  origin: "",
  search: "",
  sort: "updated_desc",
};

const statusMeta: Record<BookingStatus, { label: string; variant: StatusVariant }> = {
  PENDING_CONFIRMATION: { label: "Pending confirmation", variant: "warning" },
  PENDING_DEPOSIT: { label: "Pending deposit", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "trust" },
  RESCHEDULE_REQUESTED: { label: "Reschedule requested", variant: "warning" },
  RESCHEDULED: { label: "Rescheduled", variant: "info" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  COMPLETED: { label: "Completed", variant: "success" },
  NO_SHOW: { label: "No show", variant: "danger" },
};

const jobStatusMeta: Record<JobStatus, { label: string; variant: StatusVariant }> = {
  CREATED: { label: "Preparing service", variant: "neutral" },
  SCHEDULED: { label: "Scheduled", variant: "info" },
  TEAM_ASSIGNED: { label: "Professional assigned", variant: "trust" },
  EN_ROUTE: { label: "Professional en route", variant: "info" },
  IN_PROGRESS: { label: "Service in progress", variant: "warning" },
  ON_HOLD: { label: "Service on hold", variant: "warning" },
  AWAITING_CLIENT_CONFIRMATION: { label: "Confirm completion", variant: "warning" },
  COMPLETED: { label: "Completed", variant: "success" },
  RETURN_VISIT_REQUIRED: { label: "Return visit required", variant: "warning" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  DISPUTED: { label: "Under review", variant: "danger" },
};

const bucketStatuses: Record<BookingBucket, BookingStatus[]> = {
  pending: ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"],
  scheduled: ["CONFIRMED", "RESCHEDULED"],
  "needs-action": ["RESCHEDULE_REQUESTED"],
  closed: ["CANCELLED", "COMPLETED", "NO_SHOW"],
};

const tabs: Array<{
  value: "all" | BookingBucket;
  label: string;
  count?: "pending" | "scheduled" | "needsAction" | "closed";
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", count: "pending" },
  { value: "scheduled", label: "Scheduled", count: "scheduled" },
  { value: "needs-action", label: "Needs action", count: "needsAction" },
  { value: "closed", label: "Closed", count: "closed" },
];

const clientTabs: Array<{
  value: ClientBookingStage;
  label: string;
  count?: "pending" | "upcoming" | "active" | "past";
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", count: "pending" },
  { value: "upcoming", label: "Upcoming", count: "upcoming" },
  { value: "active", label: "In service", count: "active" },
  { value: "past", label: "Past", count: "past" },
];

export function BookingList({ audience }: { audience: "client" | "professional" }) {
  return audience === "client" ? <ClientBookingList /> : <ProfessionalBookingList />;
}

function ClientBookingList() {
  return <BookingWorkspace audience="client" />;
}

function ProfessionalBookingList() {
  return <BookingWorkspace audience="professional" />;
}

function BookingWorkspace({ audience }: { audience: "client" | "professional" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [queryState, setQueryState] = useState<BookingListQuery>(() => queryFromParams(searchParams));
  const [search, setSearch] = useState(queryState.search);
  const [selected, setSelected] = useState<SelectedBooking | null>(() => {
    const bookingId = searchParams.get("bookingId");
    return bookingId ? { id: bookingId } : null;
  });

  const updateParams = useCallback(
    (changes: Partial<BookingListQuery>, resetPage = true) => {
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
    const timeout = window.setTimeout(() => updateParams({ search: normalized }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [queryState.search, search, updateParams]);

  const bookingQuery = useQuery({
    queryKey: ["bookings", audience, queryState],
    queryFn: ({ signal }) => listBookingsPage(audience, queryState, signal),
    placeholderData: keepPreviousData,
  });

  const result = bookingQuery.data;
  const normalizedSearch = search.trim();
  const searchPending = normalizedSearch !== queryState.search;
  const cachedUnsearched = queryClient.getQueryData<BookingPage>([
    "bookings",
    audience,
    { ...queryState, search: "" },
  ]);
  const filterCached = searchPending || bookingQuery.isPlaceholderData;
  const visibleItems = result
    ? filterCached
      ? filterCachedBookings(
          searchPending || queryState.search ? cachedUnsearched?.items ?? result.items : result.items,
          { ...queryState, search: normalizedSearch },
        )
      : result.items
    : [];
  const showProgress = searchPending || (bookingQuery.isFetching && bookingQuery.isPlaceholderData);
  useWorkspaceContentReady(!bookingQuery.isPending);

  const openBooking = useCallback(
    (booking: BookingSummary) => {
      setSelected({ id: booking.id, placeholder: booking });
      replaceUrl(pathname, queryString(queryState, booking.id));
    },
    [pathname, queryState],
  );
  const closeBooking = useCallback(() => {
    setSelected(null);
    replaceUrl(pathname, queryString(queryState));
  }, [pathname, queryState]);

  const setSort = useCallback(
    (column: "updated" | "total" | "starts") => {
      const sortMap: Record<string, BookingSort> = {
        updated: queryState.sort === "updated_asc" ? "updated_desc" : "updated_asc",
        total: queryState.sort === "total_asc" ? "total_desc" : "total_asc",
        starts: queryState.sort === "starts_asc" ? "starts_desc" : "starts_asc",
      };
      updateParams({ sort: sortMap[column] });
    },
    [queryState.sort, updateParams],
  );

  const columns = useMemo<DataTableColumnDef<BookingSummary, unknown>[]>(
    () => [
      {
        id: "booking",
        header: "Booking",
        cell: ({ row }) => <BookingIdentity booking={row.original} />,
      },
      {
        id: "counterparty",
        header: audience === "client" ? "Professional" : "Client",
        cell: ({ row }) => <CounterpartyCell booking={row.original} audience={audience} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <BookingStatusBadge status={row.original.status} jobStatus={row.original.jobStatus} />,
      },
      {
        id: "schedule",
        header: () => <SortHeader label="Schedule" column="starts" sort={queryState.sort} onSort={setSort} />,
        cell: ({ row }) => <ScheduleCell booking={row.original} />,
      },
      {
        id: "assignment",
        header: "Assignment",
        cell: ({ row }) => <AssignmentCell booking={row.original} />,
      },
      {
        id: "total",
        header: () => <SortHeader label="Total" column="total" sort={queryState.sort} onSort={setSort} />,
        cell: ({ row }) => <MoneyCell booking={row.original} />,
      },
      {
        id: "updated",
        header: () => <SortHeader label="Updated" column="updated" sort={queryState.sort} onSort={setSort} />,
        cell: ({ row }) => <UpdatedCell iso={row.original.updatedAt} />,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => <BookingAction booking={row.original} audience={audience} onOpen={openBooking} />,
      },
    ],
    [audience, openBooking, queryState.sort, setSort],
  );

  const clearFilters = () => {
    setSearch("");
    setQueryState(defaultQuery);
    replaceUrl(pathname, "");
  };

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#6b9f16]">
            {audience === "client" ? "Client bookings" : "Professional workspace"}
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">
            {audience === "client" ? "Your bookings" : "Bookings"}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
            {audience === "client"
              ? "Choose times, track active service work, and keep completion records together."
              : "Confirm eligible times, coordinate assignments, and preserve every schedule change."}
          </p>
        </div>
        {audience === "professional" ? (
          <div className="flex flex-wrap gap-2">
            <Link href="/professional/calendar" className={buttonVariants({ variant: "outline" })}>
              <CalendarDays className="size-4" /> Calendar
            </Link>
            <Link href="/professional/availability" className={buttonVariants()}>
              Set availability
            </Link>
          </div>
        ) : null}
      </header>

      {bookingQuery.isPending ? (
        <BookingsSkeleton />
      ) : bookingQuery.isError ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Bookings unavailable"
          description={bookingQuery.error instanceof Error ? bookingQuery.error.message : "Bookings could not be loaded."}
        />
      ) : result ? (
        <>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Booking summary">
            <WorkspaceMetricCard
              icon={CalendarDays}
              tone="green"
              label="Total bookings"
              value={result.summary.total}
              hint="Across all statuses"
              href={`/${audience}/bookings`}
              action="View bookings"
            />
            <WorkspaceMetricCard
              icon={Clock3}
              tone="orange"
              label="Pending"
              value={result.summary.pending}
              hint={result.summary.pending ? "Awaiting confirmation" : "No pending bookings"}
              hintTone={result.summary.pending ? "danger" : "muted"}
              href={`/${audience}/bookings?bucket=pending`}
              action="Review pending"
            />
            <WorkspaceMetricCard
              icon={CalendarCheck2}
              tone="blue"
              label={audience === "client" ? "Upcoming" : "Scheduled"}
              value={audience === "client" ? result.summary.upcoming : result.summary.scheduled}
              hint="Confirmed upcoming"
              href={`/${audience}/bookings?${audience === "client" ? "stage=upcoming" : "bucket=scheduled"}`}
              action="View upcoming"
            />
            <WorkspaceMetricCard
              icon={CheckCircle2}
              tone="purple"
              label={audience === "client" ? "In service" : "Closed"}
              value={audience === "client" ? result.summary.active : result.summary.closed}
              hint={audience === "client" ? "Track current work" : result.summary.closed ? "Completed or cancelled" : "No closed bookings"}
              href={`/${audience}/bookings?${audience === "client" ? "stage=active" : "bucket=closed"}`}
              action={audience === "client" ? "Track service" : "View closed"}
            />
          </section>

          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Booking status views">
            {(audience === "client" ? clientTabs : tabs).map((tab) => {
              const active = audience === "client" ? queryState.stage === tab.value : queryState.bucket === tab.value;
              const count = tab.count ? result.summary[tab.count] : null;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() =>
                    updateParams(
                      audience === "client"
                        ? { stage: tab.value as ClientBookingStage, bucket: "all", status: "" }
                        : { bucket: tab.value as BookingListQuery["bucket"], stage: "all", status: "" },
                    )
                  }
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition",
                    active ? "border-[#83b72c] text-[#426d08]" : "border-transparent text-[#536170] hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
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
            aria-label={audience === "client" ? "Client bookings" : "Professional bookings"}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[220px] flex-1 lg:max-w-[280px]">
                <span className="sr-only">Search bookings</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder="Search bookings..."
                />
              </label>
              <FilterSelect label="Status" value={queryState.status} onChange={(status) => updateParams({ status, bucket: "all", stage: "all" })}>
                <option value="">Status</option>
                {Object.entries(statusMeta).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Origin" value={queryState.origin} onChange={(origin) => updateParams({ origin })}>
                <option value="">Origin</option>
                {result.origins.map((origin) => (
                  <option key={origin} value={origin}>
                    {origin.replaceAll("_", " ").toLowerCase()}
                  </option>
                ))}
                {result.origins.length === 0
                  ? ["ACCEPTED_QUOTATION", "DIRECT_SERVICE", "PROFESSIONAL_CUSTOMER", "REPEAT_BOOKING", "APPROVED_ASSESSMENT"].map((origin) => (
                      <option key={origin} value={origin}>
                        {origin.replaceAll("_", " ").toLowerCase()}
                      </option>
                    ))
                  : null}
              </FilterSelect>
              {showProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating bookings…
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
                getRowLabel={(row) => `View booking for ${row.serviceName}`}
                onRowClick={openBooking}
                mobileRow={(row) => <BookingMobileCard booking={row} audience={audience} onOpen={openBooking} />}
                empty={
                  <StatePanel
                    className="m-4 border-dashed shadow-none"
                    title={result.summary.total === 0 ? "No bookings yet" : "No bookings match these filters"}
                    description={
                      result.summary.total === 0
                        ? "Eligible service arrangements will appear here when they become bookings."
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
            <BookingPagination
              page={result.page}
              pageSize={result.pageSize}
              totalItems={result.totalItems}
              totalPages={result.totalPages}
              onPage={(page) => updateParams({ page }, false)}
              onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)}
            />
          </section>

          {selected ? (
            <BookingDetailDrawer selected={selected} audience={audience} onOpenChange={(open) => { if (!open) closeBooking(); }} />
          ) : null}
        </>
      ) : null}
    </div>
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        {children}
      </select>
    </label>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: "updated" | "total" | "starts";
  sort: BookingSort;
  onSort: (column: "updated" | "total" | "starts") => void;
}) {
  const direction = sort === `${column}_asc` ? "asc" : sort === `${column}_desc` ? "desc" : null;
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 hover:text-foreground" aria-label={`Sort by ${label}`}>
      {label}
      <Icon className="size-3" aria-hidden="true" />
    </button>
  );
}

function BookingIdentity({ booking }: { booking: BookingSummary }) {
  return (
    <span className="flex min-w-[190px] items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#edf7dd] text-[#6d9f16]">
        <CalendarDays className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block max-w-48 truncate font-semibold text-foreground">{booking.serviceName}</span>
        <span className="mt-0.5 block text-[0.64rem] text-[#6f7d8b]">
          BK-{booking.id.slice(-6).toUpperCase()} · {booking.origin.replaceAll("_", " ").toLowerCase()}
        </span>
      </span>
    </span>
  );
}

function CounterpartyCell({ booking, audience }: { booking: BookingSummary; audience: "client" | "professional" }) {
  const name = audience === "client" ? booking.providerName : booking.clientName;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex min-w-[135px] items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">{initials}</span>
      <span className="max-w-32 truncate font-semibold">{name}</span>
    </span>
  );
}

function BookingStatusBadge({ status, jobStatus }: { status: BookingStatus; jobStatus?: JobStatus | null }) {
  const meta = jobStatus && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(status)
    ? jobStatusMeta[jobStatus]
    : statusMeta[status];
  return (
    <Badge variant={meta.variant} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium">
      {meta.label}
    </Badge>
  );
}

function ScheduleCell({ booking }: { booking: BookingSummary }) {
  const value = booking.startsAt ?? booking.requestedStartAt;
  const label = booking.startsAt ? "Confirmed" : booking.requestedStartAt ? "Requested" : "Not set";
  return (
    <span className="flex min-w-28 items-start gap-2">
      <CalendarCheck2 className="mt-0.5 size-3.5 shrink-0 text-[#6f7d8b]" aria-hidden="true" />
      <span>
        <span className="block whitespace-nowrap font-medium">{value ? formatDate(value) : "Not set"}</span>
        <span className="text-[0.62rem] text-muted-foreground">{value ? formatTime(value) : label}</span>
      </span>
    </span>
  );
}

function AssignmentCell({ booking }: { booking: BookingSummary }) {
  if (!booking.assignmentName) return <span className="text-muted-foreground">Assignment pending</span>;
  return <span className="font-medium">{booking.assignmentName}</span>;
}

function MoneyCell({ booking }: { booking: BookingSummary }) {
  return (
    <span>
      <span className="block whitespace-nowrap font-semibold">{formatMoney(booking.totalMinor, booking.currency)}</span>
      <span className="text-[0.62rem] text-muted-foreground">Total</span>
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

function BookingAction({
  booking,
  audience,
  onOpen,
}: {
  booking: BookingSummary;
  audience: "client" | "professional";
  onOpen: (booking: BookingSummary) => void;
}) {
  return (
    <span className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[9px] border border-black/8 hover:bg-muted"
            aria-label={`More actions for ${booking.serviceName}`}
          >
            <EllipsisVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onOpen(booking)}>View summary</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${audience}/bookings/${booking.id}`}>Open booking</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${audience}/bookings/${booking.id}`}>View details</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function BookingMobileCard({
  booking,
  audience,
  onOpen,
}: {
  booking: BookingSummary;
  audience: "client" | "professional";
  onOpen: (booking: BookingSummary) => void;
}) {
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <BookingIdentity booking={booking} />
        <BookingStatusBadge status={booking.status} jobStatus={booking.jobStatus} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-black/6 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">{audience === "client" ? "Professional" : "Client"}</p>
          <p className="mt-1 truncate font-semibold">{audience === "client" ? booking.providerName : booking.clientName}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Total</p>
          <p className="mt-1 font-semibold">{formatMoney(booking.totalMinor, booking.currency)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Schedule</p>
          <p className="mt-1 font-medium">
            {booking.startsAt ? formatDate(booking.startsAt) : booking.requestedStartAt ? `Requested ${formatDate(booking.requestedStartAt)}` : "Not set"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Assignment</p>
          <p className="mt-1 font-medium">{booking.assignmentName ?? "Pending"}</p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => onOpen(booking)}>
          View summary
        </Button>
      </div>
    </article>
  );
}

function bookingScheduleLabel(summary: BookingSummary, detail?: BookingDetail | null) {
  if (summary.status === "CANCELLED" && detail?.cancellationReason) return "Cancelled";
  if (summary.startsAt) return "Confirmed schedule";
  if (summary.requestedStartAt) return "Requested schedule";
  return "Schedule";
}

function bookingScheduleValue(summary: BookingSummary, detail?: BookingDetail | null) {
  if (summary.status === "CANCELLED" && detail?.cancellationReason) {
    return detail?.cancellationReason ?? "Cancelled";
  }
  if (summary.startsAt) return formatDateTime(summary.startsAt);
  if (summary.requestedStartAt) return `Requested ${formatDateTime(summary.requestedStartAt)}`;
  return "Not set";
}

function bookingDrawerPrimary(summary: BookingSummary, audience: "client" | "professional"): { label: string; href: string } {
  const closed = ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(summary.status);
  if (closed) {
    if (audience === "client") {
      if (summary.jobId) {
        return { label: "View service record", href: `/client/bookings/${summary.id}#service-progress` };
      }
      if (summary.serviceSlug) return { label: "Book again", href: `/services/${summary.serviceSlug}` };
      if (summary.providerSlug) return { label: "Book again", href: `/professionals/${summary.providerSlug}` };
      return { label: "Book again", href: `/client/bookings/new?sourceBookingId=${summary.id}` };
    }
    if (summary.jobId) return { label: "View job", href: `/${audience}/jobs/${summary.jobId}` };
    return { label: "View booking", href: `/${audience}/bookings/${summary.id}` };
  }
  if (summary.status === "PENDING_CONFIRMATION") {
    return audience === "professional"
      ? { label: "Review & confirm", href: `/${audience}/bookings/${summary.id}` }
      : { label: "Manage schedule", href: `/${audience}/bookings/${summary.id}` };
  }
  if (summary.status === "PENDING_DEPOSIT") {
    return { label: "View booking", href: `/${audience}/bookings/${summary.id}` };
  }
  if (summary.status === "RESCHEDULE_REQUESTED") {
    return audience === "professional"
      ? { label: "Accept new time", href: `/${audience}/bookings/${summary.id}` }
      : { label: "View booking", href: `/${audience}/bookings/${summary.id}` };
  }
  if (["CONFIRMED", "RESCHEDULED"].includes(summary.status)) {
    return audience === "client"
      ? summary.jobId && summary.jobStatus && !["CREATED", "SCHEDULED", "TEAM_ASSIGNED"].includes(summary.jobStatus)
        ? { label: "Track service", href: `/client/bookings/${summary.id}#service-progress` }
        : { label: "Request new time", href: `/${audience}/bookings/${summary.id}` }
      : summary.jobId
        ? { label: "View job", href: `/${audience}/jobs/${summary.jobId}` }
        : { label: "View booking", href: `/${audience}/bookings/${summary.id}` };
  }
  return { label: "View booking", href: `/${audience}/bookings/${summary.id}` };
}

function bookingDrawerSecondaryCancellable(status: BookingStatus) {
  return ["PENDING_CONFIRMATION", "PENDING_DEPOSIT", "CONFIRMED", "RESCHEDULE_REQUESTED", "RESCHEDULED"].includes(status);
}

function BookingDetailDrawer({
  selected,
  audience,
  onOpenChange,
}: {
  selected: SelectedBooking;
  audience: "client" | "professional";
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["booking-detail", audience, selected.id],
    queryFn: ({ signal }) => getBooking(audience, selected.id, signal),
  });
  const detail = detailQuery.data as BookingDetail | undefined;
  const summary = (detail as unknown as BookingSummary | undefined) ?? selected.placeholder;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const primary = summary ? bookingDrawerPrimary(summary, audience) : null;
  const isCancellable = summary ? bookingDrawerSecondaryCancellable(summary.status) : false;

  async function handleCancel() {
    if (!detail || reason.trim().length < 3 || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await bookingAction(audience, detail.id, "cancel", {
        lockVersion: detail.lockVersion,
        reason: reason.trim(),
        cancellationPolicyAcknowledged: true,
      });
      setCancelOpen(false);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["bookings", audience] });
      await queryClient.invalidateQueries({ queryKey: ["booking-detail", audience, selected.id] });
      onOpenChange(false);
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : "Cancellation failed.");
    } finally {
      setIsCancelling(false);
    }
  }

  const scheduleLabel = summary ? bookingScheduleLabel(summary, detail ?? null) : "Schedule";
  const scheduleValue = summary ? bookingScheduleValue(summary, detail ?? null) : "—";
  const showAssignment = summary ? ["CONFIRMED", "RESCHEDULED", "COMPLETED", "RESCHEDULE_REQUESTED"].includes(summary.status) || Boolean(summary.assignmentName) : false;
  const isPendingDeposit = summary?.status === "PENDING_DEPOSIT";
  const isRescheduleRequested = summary?.status === "RESCHEDULE_REQUESTED";

  return (
    <>
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent className="flex h-full w-[min(31rem,94vw)] flex-col overflow-hidden p-0" aria-describedby="booking-drawer-description">
          <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6">
            <div className="flex items-center gap-3 pr-10">
              <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-[#edf7dd] text-[#6d9f16]">
                <CalendarDays className="size-4.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg font-semibold">{summary?.serviceName ?? "Booking details"}</SheetTitle>
                <SheetDescription id="booking-drawer-description" className="mt-0.5 text-xs text-muted-foreground">
                  {summary ? `BK-${summary.id.slice(-6).toUpperCase()} · ${summary.origin.replaceAll("_", " ").toLowerCase()}` : "Retrieving the latest booking."}
                </SheetDescription>
              </div>
            </div>
            {detailQuery.isFetching ? (
              <span className="mt-4 inline-flex items-center gap-2 text-[0.68rem] text-muted-foreground" role="status">
                <Spinner className="size-3.5 text-[#6b9f16]" />
                Refreshing booking…
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {detailQuery.isError ? (
              <InlineAlert
                variant="error"
                title="Booking unavailable"
                description={detailQuery.error instanceof Error ? detailQuery.error.message : "The booking could not be loaded."}
              />
            ) : summary ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <BookingStatusBadge status={summary.status} jobStatus={summary.jobStatus} />
                </div>
                {isPendingDeposit ? (
                  <InlineAlert variant="warning" title="Deposit required before confirmation" description="The booking can collect a requested time, but confirmation remains blocked until the deposit is satisfied or waived." />
                ) : null}
                {isRescheduleRequested && detail?.history.find((h) => h.toStatus === "RESCHEDULE_REQUESTED")?.note ? (
                  <InlineAlert variant="info" title="Reschedule requested" description={detail.history.find((h) => h.toStatus === "RESCHEDULE_REQUESTED")?.note ?? "A new time has been requested."} />
                ) : isRescheduleRequested ? (
                  <InlineAlert variant="info" title="Reschedule requested" description="The requested schedule change is awaiting confirmation." />
                ) : null}
                <dl className="grid grid-cols-2 gap-x-5 gap-y-5 text-xs">
                  <DrawerDetail label={audience === "client" ? "Professional" : "Client"} value={audience === "client" ? summary.providerName : summary.clientName} />
                  <DrawerDetail label="Current total" value={formatMoney(summary.totalMinor, summary.currency)} />
                  <DrawerDetail label={scheduleLabel} value={scheduleValue} />
                  {showAssignment ? <DrawerDetail label="Assignment" value={summary.assignmentName ?? "Assignment pending"} /> : null}
                  <DrawerDetail label="Origin" value={summary.origin.replaceAll("_", " ").toLowerCase()} />
                  <DrawerDetail label="Updated" value={formatDateTime(summary.updatedAt)} />
                </dl>
                {detail && summary.status === "CANCELLED" && detail.cancellationReason ? (
                  <DrawerSection label="Cancellation reason" value={detail.cancellationReason} />
                ) : detail && ["CONFIRMED", "RESCHEDULED", "COMPLETED"].includes(summary.status) ? (
                  <>
                    <DrawerSection label="Scope" value={detail.scope} />
                    <DrawerSection label="Payment terms" value={detail.paymentTerms} />
                  </>
                ) : null}
              </div>
            ) : (
              <BookingDrawerSkeleton />
            )}
          </div>
          {summary && primary ? (
            <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4">
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                {isCancellable ? (
                  <Button variant="outline" className="w-full border-danger/20 text-danger hover:bg-danger/5" onClick={() => setCancelOpen(true)}>
                    Cancel booking
                  </Button>
                ) : (
                  <Link href={`/${audience}/bookings/${summary.id}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                    View booking
                  </Link>
                )}
                <Link href={primary.href} className={buttonVariants({ className: "w-full" })}>
                  {primary.label}
                </Link>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={cancelOpen} onOpenChange={setCancelOpen}>
        <SheetContent className="flex h-full w-[min(28rem,92vw)] flex-col p-0" aria-describedby="booking-cancel-description">
          <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6 pr-10">
            <SheetTitle className="text-lg font-semibold">Cancel booking</SheetTitle>
            <SheetDescription id="booking-cancel-description" className="mt-1 text-xs text-muted-foreground">
              Share a brief reason. This will be recorded in schedule history and visible to the other party.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label htmlFor="booking-cancel-reason" className="text-xs font-medium text-muted-foreground">
                Reason for cancellation
              </label>
              <textarea
                id="booking-cancel-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason for cancellation"
                className="mt-2 min-h-24 w-full rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-ring"
                aria-label="Cancellation reason"
              />
              <p className="mt-2 text-[0.68rem] text-muted-foreground">Minimum 3 characters.</p>
            </div>
            {cancelError ? <InlineAlert variant="error" title="Cancellation failed" description={cancelError} /> : null}
            <InlineAlert variant="info" title="Policy" description={detail?.cancellationPolicy ?? "Cancellation is subject to the agreed policy."} />
          </div>
          <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)} disabled={isCancelling}>
              Keep booking
            </Button>
            <Button className="flex-1" disabled={reason.trim().length < 3 || isCancelling} onClick={() => { void handleCancel(); }}>
              {isCancelling ? <><Spinner className="size-4" /> Cancelling…</> : "Confirm cancellation"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function BookingPagination({
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
    <nav aria-label="Booking pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} bookings
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="booking-page-size">
          Bookings per page
        </label>
        <select id="booking-page-size" value={pageSize} onChange={(event) => onPageSize(Number(event.target.value))} className={cn(selectClass, "h-9")}>
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

function BookingsSkeleton() {
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

function BookingDrawerSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <Skeleton className="h-8 w-28 rounded-full" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-[10px]" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-[12px]" />
    </div>
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
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{value}</p>
    </section>
  );
}

function queryFromParams(searchParams: URLSearchParams): BookingListQuery {
  const pageSize = Number(searchParams.get("pageSize"));
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
    bucket: (searchParams.get("bucket") ?? "all") as BookingListQuery["bucket"],
    stage: (searchParams.get("stage") ?? "all") as ClientBookingStage,
    status: searchParams.get("status") ?? "",
    origin: searchParams.get("origin") ?? "",
    search: searchParams.get("search") ?? "",
    sort: (searchParams.get("sort") ?? "updated_desc") as BookingSort,
  };
}

function queryString(state: BookingListQuery, bookingId?: string) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.stage !== "all") params.set("stage", state.stage);
  if (state.status) params.set("status", state.status);
  if (state.origin) params.set("origin", state.origin);
  if (state.search) params.set("search", state.search);
  if (state.sort !== "updated_desc") params.set("sort", state.sort);
  if (bookingId) params.set("bookingId", bookingId);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

function filterCachedBookings(items: BookingSummary[], query: BookingListQuery) {
  const search = query.search.toLocaleLowerCase();
  return items.filter((booking) => {
    if (query.bucket !== "all" && !bucketStatuses[query.bucket].includes(booking.status)) return false;
    if (query.stage !== "all" && !bookingMatchesStage(booking, query.stage)) return false;
    if (query.status && booking.status !== query.status) return false;
    if (query.origin && booking.origin !== query.origin) return false;
    if (!search) return true;
    return (
      booking.serviceName.toLocaleLowerCase().includes(search) ||
      booking.providerName.toLocaleLowerCase().includes(search) ||
      booking.clientName.toLocaleLowerCase().includes(search) ||
      booking.origin.toLocaleLowerCase().includes(search)
    );
  });
}

function bookingMatchesStage(booking: BookingSummary, stage: Exclude<ClientBookingStage, "all">) {
  if (stage === "pending") return ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(booking.status);
  if (stage === "upcoming") {
    return ["CONFIRMED", "RESCHEDULED"].includes(booking.status) &&
      (!booking.jobStatus || ["CREATED", "SCHEDULED", "TEAM_ASSIGNED"].includes(booking.jobStatus));
  }
  if (stage === "active") {
    return Boolean(booking.jobStatus && ["EN_ROUTE", "IN_PROGRESS", "ON_HOLD", "AWAITING_CLIENT_CONFIRMATION", "RETURN_VISIT_REQUIRED", "DISPUTED"].includes(booking.jobStatus));
  }
  return ["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status);
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 })
    .format(amountMinor / 100)
    .replace("KES", "KSh");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}
