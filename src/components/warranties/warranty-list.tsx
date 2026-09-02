"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

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
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StatePanel } from "@/components/ui/state-panel";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";
import type { WarrantyClaimStatus, WarrantyPage, WarrantyStatus } from "@/modules/warranties/types";
import {
  escalateWarrantyClaim,
  getWarranty,
  listWarranties,
  professionalClaimAction,
  submitWarrantyClaim,
  uploadWarrantyEvidence,
  warrantyApi,
  type WarrantyListQuery,
} from "./warranty-api";
import type { WarrantyDetail, WarrantySummary } from "@/modules/warranties/types";

type SelectedWarranty = { id: string; placeholder?: WarrantySummary };
type StatusVariant = "neutral" | "trust" | "info" | "success" | "warning" | "danger";

const SEARCH_DEBOUNCE_MS = 160;
const DAY_MS = 86_400_000;
const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] outline-none transition hover:border-black/15 focus:border-ring";

const textareaClass =
  "min-h-28 w-full resize-y rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";

const defaultQuery: WarrantyListQuery = {
  page: 1,
  pageSize: 10,
  bucket: "all",
  service: "",
  search: "",
  sort: "expiry_asc",
  status: undefined,
  dateFrom: undefined,
  dateTo: undefined,
};

const warrantyStatusMeta: Record<WarrantyStatus, { label: string; variant: StatusVariant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  EXPIRED: { label: "Expired", variant: "warning" },
  VOID: { label: "Void", variant: "neutral" },
};

const claimStatusMeta: Record<WarrantyClaimStatus, { label: string; variant: StatusVariant }> = {
  SUBMITTED: { label: "Submitted", variant: "info" },
  UNDER_REVIEW: { label: "Under review", variant: "info" },
  ACCEPTED: { label: "Accepted", variant: "trust" },
  RETURN_VISIT_SCHEDULED: { label: "Return visit scheduled", variant: "trust" },
  RESOLVED: { label: "Resolved", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  ESCALATED: { label: "Escalated", variant: "warning" },
};

const tabs: Array<{ value: NonNullable<WarrantyListQuery["bucket"]>; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiring-soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "voided", label: "Voided" },
];

export function WarrantyList({ audience }: { audience: "client" | "professional" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [queryState, setQueryState] = useState<WarrantyListQuery>(() => queryFromParams(searchParams));
  const [search, setSearch] = useState(queryState.search ?? "");
  const [selected, setSelected] = useState<SelectedWarranty | null>(() => {
    const warrantyId = searchParams.get("warrantyId");
    return warrantyId ? { id: warrantyId } : null;
  });

  const updateParams = useCallback(
    (changes: Partial<WarrantyListQuery>, resetPage = true) => {
      const next: WarrantyListQuery = {
        ...queryState,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? queryState.page ?? 1),
      };
      if (next.service === "") next.service = undefined;
      if (next.search === "") next.search = undefined;
      if (next.dateFrom === "") next.dateFrom = undefined;
      if (next.dateTo === "") next.dateTo = undefined;
      if (next.status === "" as unknown as WarrantyStatus) next.status = undefined;
      setQueryState(next);
      replaceUrl(pathname, queryString(next, selected?.id));
    },
    [pathname, queryState, selected?.id],
  );

  useEffect(() => {
    const normalized = search.trim();
    if (normalized === (queryState.search ?? "")) return;
    const timeout = window.setTimeout(() => updateParams({ search: normalized || undefined }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [queryState.search, search, updateParams]);

  const warrantyQuery = useQuery({
    queryKey: ["warranties", audience, queryState],
    queryFn: ({ signal }) => listWarranties(audience, queryState, signal as unknown as AbortSignal),
    placeholderData: keepPreviousData,
  });

  const result = warrantyQuery.data as WarrantyPage | undefined;
  const normalizedSearch = search.trim();
  const searchPending = normalizedSearch !== (queryState.search ?? "");
  const visibleItems: WarrantySummary[] = result?.items ?? [];
  const showProgress = searchPending || (warrantyQuery.isFetching && warrantyQuery.isPlaceholderData);
  useWorkspaceContentReady(!warrantyQuery.isPending);

  const openWarranty = useCallback(
    (warranty: WarrantySummary) => {
      setSelected({ id: warranty.id, placeholder: warranty });
      replaceUrl(pathname, queryString(queryState, warranty.id));
    },
    [pathname, queryState],
  );
  const closeWarranty = useCallback(() => {
    setSelected(null);
    replaceUrl(pathname, queryString(queryState));
  }, [pathname, queryState]);

  const columns = useMemo<DataTableColumnDef<WarrantySummary, unknown>[]>(
    () => [
      {
        id: "service",
        header: "Service & Warranty ID",
        cell: ({ row }) => <ServiceWarrantyCell warranty={row.original} audience={audience} />,
      },
      {
        id: "professional",
        header: "Professional",
        cell: ({ row }) => <ProfessionalCell warranty={row.original} audience={audience} />,
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <WarrantyStatusBadge status={row.original.status} endsAt={row.original.endsAt} />,
      },
      {
        id: "coverage",
        header: "Coverage",
        cell: ({ row }) => <CoverageCell warranty={row.original} />,
      },
      {
        id: "claims",
        header: "Claims",
        cell: ({ row }) => <ClaimsCell warranty={row.original} />,
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => <WarrantyAction warranty={row.original} audience={audience} onOpen={openWarranty} />,
      },
    ],
    [audience, openWarranty],
  );

  const clearFilters = () => {
    setSearch("");
    const next: WarrantyListQuery = { ...defaultQuery };
    setQueryState(next);
    replaceUrl(pathname, queryString(next, selected?.id));
  };

  const isClient = audience === "client";

  return (
    <div className="mx-auto w-full max-w-[1370px] pb-3">
      <header>
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-title sm:text-[2rem]">Warranties</h1>
        <p className="mt-1.5 max-w-2xl text-[0.78rem] text-muted-foreground">
          Keep track of your service protection, coverage periods, and warranty claims.
        </p>
      </header>

      {warrantyQuery.isPending ? (
        <WarrantyListSkeleton />
      ) : warrantyQuery.isError ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Warranties unavailable"
          description={warrantyQuery.error instanceof Error ? warrantyQuery.error.message : "Warranties could not be loaded."}
        />
      ) : result ? (
        <>
          <WarrantyMetrics summary={result.summary} audience={audience} />

          {(() => {
            const banner = getAttentionBanner(visibleItems);
            if (!banner) return null;
            return (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[0.74rem]">
                <span className="font-medium text-[#7a4a00]">{banner.message}</span>
                <button
                  type="button"
                  onClick={() => {
                    const target = visibleItems.find((w) => w.id === banner.warrantyId);
                    if (target) openWarranty(target);
                  }}
                  className="inline-flex items-center gap-1 font-semibold text-[#7a4a00] underline-offset-4 hover:underline"
                >
                  {banner.cta} <span aria-hidden="true">→</span>
                </button>
              </div>
            );
          })()}

          <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-black/6" aria-label="Warranty status views">
            {tabs.map((tab) => {
              const active = (queryState.bucket ?? "all") === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => updateParams({ bucket: tab.value })}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-4 text-[0.72rem] font-medium transition",
                    active ? "border-[#83b72c] text-[#426d08]" : "border-transparent text-[#536170] hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <section
            className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]"
            aria-label={isClient ? "Client warranties" : "Professional warranties"}
          >
            <div className="flex flex-wrap items-center gap-2 border-b border-black/6 p-3">
              <label className="relative min-w-[200px] flex-1 lg:max-w-[260px]">
                <span className="sr-only">Search warranties</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6f7d8b]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white pl-9 pr-3 text-[0.72rem] outline-none placeholder:text-[#83909c] focus:border-ring"
                  placeholder="Search warranties..."
                />
              </label>

              <FilterSelect label="Service" value={queryState.service ?? ""} onChange={(service) => updateParams({ service: service || undefined })}>
                <option value="">All services</option>
                {result.services?.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                label="Status"
                value={(queryState.status as string) ?? ""}
                onChange={(value) => updateParams({ status: (value as WarrantyStatus) || undefined, bucket: "all" })}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="VOID">Void</option>
              </FilterSelect>

              <label className="flex items-center gap-1">
                <span className="sr-only">Coverage from</span>
                <input
                  type="date"
                  value={queryState.dateFrom ? queryState.dateFrom.slice(0, 10) : ""}
                  onChange={(event) => updateParams({ dateFrom: event.target.value ? new Date(event.target.value).toISOString() : undefined })}
                  className={cn(selectClass, "h-10")}
                  aria-label="Coverage from"
                />
              </label>
              <label className="flex items-center gap-1">
                <span className="sr-only">Coverage to</span>
                <input
                  type="date"
                  value={queryState.dateTo ? queryState.dateTo.slice(0, 10) : ""}
                  onChange={(event) => updateParams({ dateTo: event.target.value ? new Date(event.target.value).toISOString() : undefined })}
                  className={cn(selectClass, "h-10")}
                  aria-label="Coverage to"
                />
              </label>

              <FilterSelect label="Sort" value={queryState.sort ?? "expiry_asc"} onChange={(sort) => updateParams({ sort: sort as WarrantyListQuery["sort"] })}>
                <option value="expiry_asc">Expiry: soonest</option>
                <option value="expiry_desc">Expiry: latest</option>
                <option value="created_desc">Recently created</option>
                <option value="created_asc">Oldest</option>
              </FilterSelect>

              {showProgress ? (
                <span className="inline-flex min-h-10 items-center gap-2 px-2 text-[0.68rem] font-medium text-[#64717d]" role="status" aria-live="polite">
                  <Spinner className="size-3.5 text-[#6b9f16]" />
                  Updating warranties…
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
                getRowLabel={(row) => `View warranty for ${row.serviceName}`}
                onRowClick={openWarranty}
                mobileRow={(row) => <WarrantyMobileCard warranty={row} audience={audience} onOpen={openWarranty} />}
                empty={
                  <StatePanel
                    className="m-4 border-dashed shadow-none"
                    title={
                      result.totalItems === 0 ||
                      (result.summary.activeWarranties === 0 &&
                        result.summary.openClaims === 0 &&
                        result.summary.resolvedClaims === 0 &&
                        visibleItems.length === 0 &&
                        !queryState.search &&
                        !queryState.service &&
                        !queryState.status)
                        ? "No warranties yet"
                        : "No warranties match these filters"
                    }
                    description={
                      result.totalItems === 0
                        ? "Eligible warranties will appear here after supported services are completed."
                        : "Clear a filter or try a different search."
                    }
                  >
                    {result.totalItems === 0 ? (
                      <Link href="/services" className={buttonVariants({ size: "sm" })}>
                        Browse services
                      </Link>
                    ) : (
                      <Button size="sm" variant="outline" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </StatePanel>
                }
              />
            </div>
            <WarrantyPagination
              page={result.page}
              pageSize={result.pageSize}
              totalItems={result.totalItems}
              totalPages={result.totalPages}
              onPage={(page) => updateParams({ page }, false)}
              onPageSize={(pageSize) => updateParams({ pageSize, page: 1 }, false)}
            />
          </section>

          {selected ? <WarrantyDrawer selected={selected} audience={audience} onClose={closeWarranty} /> : null}
        </>
      ) : null}
    </div>
  );
}

function WarrantyMetrics({
  summary,
  audience,
}: {
  summary: { activeWarranties: number; expiringSoon: number; openClaims: number; resolvedClaims: number };
  audience: "client" | "professional";
}) {
  const base = `/${audience}/warranties`;
  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Warranty summary">
      <WorkspaceMetricCard
        icon={ShieldCheck}
        tone="green"
        label="Active warranties"
        value={summary.activeWarranties}
        hint="Currently protected"
        href={`${base}?bucket=active`}
        action="View active"
      />
      <WorkspaceMetricCard
        icon={CalendarClock}
        tone="orange"
        label="Expiring soon"
        value={summary.expiringSoon}
        hint="Within 30 days"
        hintTone={summary.expiringSoon ? "danger" : "muted"}
        href={`${base}?bucket=expiring-soon`}
        action="Review soon"
      />
      <WorkspaceMetricCard
        icon={AlertTriangle}
        tone="orange"
        label="Open claims"
        value={summary.openClaims}
        hint="Needs your attention"
        hintTone={summary.openClaims ? "danger" : "muted"}
        href={base}
        action="View claims"
      />
      <WorkspaceMetricCard
        icon={CheckCircle2}
        tone="purple"
        label="Resolved claims"
        value={summary.resolvedClaims}
        hint="All closed"
        href={base}
        action="View resolved"
      />
    </section>
  );
}

function getAttentionBanner(
  items: WarrantySummary[],
): { message: string; cta: string; warrantyId: string } | null {
  if (!items.length) return null;
  const withOpenClaim = items.find((w) => w.openClaimCount > 0);
  if (withOpenClaim) {
    const status = withOpenClaim.latestClaimStatus ?? "SUBMITTED";
    const statusLabel = claimStatusMeta[status as WarrantyClaimStatus]?.label.toLowerCase() ?? "open";
    return {
      message: `Your ${withOpenClaim.serviceName} claim is currently ${statusLabel}.`,
      cta: "View claim",
      warrantyId: withOpenClaim.id,
    };
  }
  const now = Date.now();
  const expiring = items.find((w) => {
    if (w.status !== "ACTIVE") return false;
    const ends = new Date(w.endsAt).getTime();
    const diff = ends - now;
    return diff > 0 && diff <= 30 * DAY_MS;
  });
  if (expiring) {
    const days = Math.max(1, Math.ceil((new Date(expiring.endsAt).getTime() - now) / DAY_MS));
    return {
      message: `${expiring.serviceName} warranty expires in ${days} day${days === 1 ? "" : "s"}.`,
      cta: "View warranty",
      warrantyId: expiring.id,
    };
  }
  return null;
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

function ServiceWarrantyCell({ warranty, audience }: { warranty: WarrantySummary; audience: "client" | "professional" }) {
  const warRef = `WAR-${warranty.id.slice(-6).toUpperCase()}`;
  const jobRef = warranty.jobId ? `JOB-${warranty.jobId.slice(-6).toUpperCase()}` : null;
  const showJobRef = audience === "professional";
  return (
    <span className="block min-w-[190px]">
      <span className="block font-semibold text-foreground">{warranty.serviceName}</span>
      <span className="mt-0.5 block text-[0.64rem] text-muted-foreground">
        {warRef}
        {showJobRef && jobRef ? ` · ${jobRef}` : null}
      </span>
    </span>
  );
}

function ProfessionalCell({ warranty, audience }: { warranty: WarrantySummary; audience: "client" | "professional" }) {
  const name = audience === "client" ? warranty.providerName : warranty.clientName;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="flex min-w-[135px] items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">{initials}</span>
      <span className="min-w-0">
        <span className="block max-w-32 truncate font-semibold text-foreground">{name}</span>
      </span>
    </span>
  );
}

function WarrantyStatusBadge({ status }: { status: WarrantyStatus; endsAt?: string }) {
  const meta = warrantyStatusMeta[status];
  return (
    <Badge variant={meta.variant} className="min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium">
      {meta.label}
    </Badge>
  );
}

function CoverageCell({ warranty }: { warranty: WarrantySummary }) {
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const ends = new Date(warranty.endsAt);
  const range = `${formatShortDate(warranty.startsAt)} – ${formatShortDate(warranty.endsAt)}`;
  let secondary = "";
  let tone: string = "text-muted-foreground";
  if (warranty.status === "ACTIVE") {
    const diff = ends.getTime() - now;
    const days = Math.ceil(diff / DAY_MS);
    if (days <= 0) {
      secondary = `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
      tone = "text-danger";
    } else if (days <= 30) {
      secondary = `${days} day${days === 1 ? "" : "s"} remaining`;
      tone = days <= 7 ? "text-[#d16b16]" : "text-[#5f8d11]";
    } else {
      secondary = `${days} days remaining`;
      tone = "text-success";
    }
  } else if (warranty.status === "EXPIRED") {
    const days = Math.max(0, Math.floor((now - ends.getTime()) / DAY_MS));
    secondary = days === 0 ? "Expired today" : `Expired ${days} day${days === 1 ? "" : "s"} ago`;
    tone = "text-muted-foreground";
  } else if (warranty.status === "VOID") {
    secondary = `Voided on ${formatShortDate(warranty.endsAt)}`;
    tone = "text-muted-foreground";
  }
  return (
    <span className="block min-w-[150px]">
      <span className="block font-medium text-foreground">{range}</span>
      <span className={cn("mt-0.5 block text-[0.62rem]", tone)}>{secondary}</span>
    </span>
  );
}

function ClaimsCell({ warranty }: { warranty: WarrantySummary }) {
  const status = warranty.latestClaimStatus as WarrantyClaimStatus | null | undefined;
  if (!status) {
    if (warranty.openClaimCount > 0) {
      const count = warranty.openClaimCount;
      return (
        <span className="inline-flex items-center gap-2">
          <Badge variant="info" className="min-h-6 px-2.5 py-0.5 text-[0.62rem]">
            {count} open claim{count === 1 ? "" : "s"}
          </Badge>
        </span>
      );
    }
    return <span className="text-muted-foreground">No claims</span>;
  }
  const meta = claimStatusMeta[status];
  const isOpen = ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "RETURN_VISIT_SCHEDULED", "ESCALATED"].includes(status);
  return (
    <span className={cn("inline-flex", isOpen && "font-semibold")}>
      <Badge
        variant={meta.variant}
        className={cn("min-h-6 whitespace-nowrap px-2.5 py-0.5 text-[0.62rem] font-medium", isOpen && "shadow-sm")}
      >
        {meta.label}
      </Badge>
    </span>
  );
}

function WarrantyAction({
  warranty,
  audience,
  onOpen,
}: {
  warranty: WarrantySummary;
  audience: "client" | "professional";
  onOpen: (w: WarrantySummary) => void;
}) {
  const isActive = warranty.status === "ACTIVE";
  const hasOpenClaim = warranty.openClaimCount > 0;
  const primaryLabel =
    isActive && !hasOpenClaim && audience === "client" ? "File claim" : hasOpenClaim ? "View claim" : audience === "client" ? "View service record" : "View job";
  const handlePrimary = () => {
    if (!isActive && !hasOpenClaim) {
      // Expired/Void without claim → go to service record
      window.location.href = `/${audience}/jobs/${warranty.jobId}`;
      return;
    }
    onOpen(warranty);
  };

  const copyReference = async () => {
    const ref = `WAR-${warranty.id.slice(-6).toUpperCase()}`;
    try {
      await navigator.clipboard.writeText(ref);
      toast.success(`${ref} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <span className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={handlePrimary}
        className="font-semibold text-trust transition-colors hover:text-foreground text-[0.72rem]"
      >
        {primaryLabel}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[9px] border border-black/8 hover:bg-muted"
            aria-label={`More actions for ${warranty.serviceName}`}
          >
            <EllipsisVertical className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onOpen(warranty)}>View details</DropdownMenuItem>
          {isActive && !hasOpenClaim && audience === "client" ? (
            <DropdownMenuItem onSelect={() => onOpen(warranty)}>File claim</DropdownMenuItem>
          ) : null}
          {hasOpenClaim ? <DropdownMenuItem onSelect={() => onOpen(warranty)}>View claim</DropdownMenuItem> : null}
          <DropdownMenuItem onSelect={() => void copyReference()}>Copy reference</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/${audience}/jobs/${warranty.jobId}`}>{audience === "client" ? "View service record" : "View job"}</Link>
          </DropdownMenuItem>
          {warranty.providerSlug ? (
            <DropdownMenuItem asChild>
              <Link href={`/professionals/${warranty.providerSlug}`}>View professional</Link>
            </DropdownMenuItem>
          ) : null}
          {hasOpenClaim && audience === "client" && warranty.latestClaimStatus && ["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(warranty.latestClaimStatus) ? (
            <DropdownMenuItem onSelect={() => onOpen(warranty)}>Escalate claim</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function WarrantyMobileCard({
  warranty,
  audience,
  onOpen,
}: {
  warranty: WarrantySummary;
  audience: "client" | "professional";
  onOpen: (w: WarrantySummary) => void;
}) {
  const warRef = `WAR-${warranty.id.slice(-6).toUpperCase()}`;
  const jobRef = audience === "professional" && warranty.jobId ? `JOB-${warranty.jobId.slice(-6).toUpperCase()}` : null;
  // eslint-disable-next-line react-hooks/purity
  const daysRemainingMobile = Math.max(1, Math.ceil((new Date(warranty.endsAt).getTime() - Date.now()) / DAY_MS));
  return (
    <article className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{warranty.serviceName}</p>
          <p className="mt-0.5 text-[0.64rem] text-muted-foreground">
            {warRef}
            {jobRef ? ` · ${jobRef}` : null}
          </p>
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            {audience === "client" ? warranty.providerName : warranty.clientName}
          </p>
        </div>
        <WarrantyStatusBadge status={warranty.status} endsAt={warranty.endsAt} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-black/6 py-3 text-xs">
        <div>
          <p className="text-muted-foreground">Coverage</p>
          <p className="mt-1 font-medium">{formatShortDate(warranty.startsAt)} – {formatShortDate(warranty.endsAt)}</p>
          <p className="mt-0.5 text-[0.62rem] text-muted-foreground">
            {warranty.status === "ACTIVE"
              ? `${daysRemainingMobile} days remaining`
              : warranty.status === "EXPIRED"
                ? "Expired"
                : "Voided"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Claims</p>
          <p className="mt-1">
            <ClaimsCell warranty={warranty} />
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {warranty.status === "ACTIVE" && warranty.openClaimCount === 0 && audience === "client" ? (
          <Button size="sm" onClick={() => onOpen(warranty)}>
            File claim
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => onOpen(warranty)}>
            {warranty.openClaimCount > 0 ? "View claim" : "View details"}
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/${audience}/jobs/${warranty.jobId}`}>{audience === "client" ? "View service record" : "View job"}</Link>
        </Button>
      </div>
    </article>
  );
}

function WarrantyPagination({
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
    <nav aria-label="Warranty pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.68rem] text-muted-foreground">
        Showing {start} to {end} of {totalItems} warranties
      </p>
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="warranty-page-size">
          Warranties per page
        </label>
        <select
          id="warranty-page-size"
          value={pageSize}
          onChange={(event) => onPageSize(Number(event.target.value))}
          className={cn(selectClass, "h-9")}
        >
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

function WarrantyListSkeleton() {
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

function queryFromParams(searchParams: URLSearchParams): WarrantyListQuery {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const rawPageSize = Number(searchParams.get("pageSize"));
  const pageSize = [10, 20, 50].includes(rawPageSize) ? rawPageSize : 10;
  const bucket = (searchParams.get("bucket") ?? "all") as WarrantyListQuery["bucket"];
  const rawStatus = searchParams.get("status");
  const status = (["ACTIVE", "EXPIRED", "VOID"] as const).includes(rawStatus as WarrantyStatus) ? (rawStatus as WarrantyStatus) : undefined;
  const sort = (searchParams.get("sort") ?? "expiry_asc") as WarrantyListQuery["sort"];
  return {
    page,
    pageSize,
    bucket: ["all", "active", "expiring-soon", "expired", "voided"].includes(bucket ?? "") ? bucket : "all",
    service: searchParams.get("service") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    status,
    sort: (["expiry_asc", "expiry_desc", "created_desc", "created_asc"] as readonly string[]).includes(sort ?? "") ? (sort as WarrantyListQuery["sort"]) : "expiry_asc",
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  };
}

function queryString(state: WarrantyListQuery, warrantyId?: string) {
  const params = new URLSearchParams();
  if (state.page && state.page > 1) params.set("page", String(state.page));
  if (state.pageSize && state.pageSize !== 10) params.set("pageSize", String(state.pageSize));
  if (state.bucket && state.bucket !== "all") params.set("bucket", state.bucket);
  if (state.service) params.set("service", state.service);
  if (state.search) params.set("search", state.search);
  if (state.status) params.set("status", state.status);
  if (state.sort && state.sort !== "expiry_asc") params.set("sort", state.sort);
  if (state.dateFrom) params.set("dateFrom", state.dateFrom);
  if (state.dateTo) params.set("dateTo", state.dateTo);
  if (warrantyId) params.set("warrantyId", warrantyId);
  return params.toString();
}

function replaceUrl(pathname: string, query: string) {
  window.history.replaceState(window.history.state, "", query ? `${pathname}?${query}` : pathname);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

// ──────────────────────────────────────────────────────────────────────────────
// Drawer
// ──────────────────────────────────────────────────────────────────────────────

function WarrantyDrawer({
  selected,
  audience,
  onClose,
}: {
  selected: SelectedWarranty;
  audience: "client" | "professional";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ["warranty-detail", audience, selected.id],
    queryFn: ({ signal }) => getWarranty(audience, selected.id, signal),
  });
  const detail = detailQuery.data as WarrantyDetail | undefined;
  const summary = (detail as unknown as WarrantySummary | undefined) ?? selected.placeholder;
  const isActive = summary?.status === "ACTIVE";
  const isExpired = summary?.status === "EXPIRED";
  const openClaim = detail?.claims.find((c) => ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "RETURN_VISIT_SCHEDULED", "ESCALATED"].includes(c.status));
  const hasOpenClaim = Boolean(openClaim);
  const latestClaim = detail?.claims[0] as WarrantyDetail["claims"][number] | undefined;

  const coverageLabel = summary ? `${formatShortDate(summary.startsAt)} → ${formatShortDate(summary.endsAt)}` : "";
  // eslint-disable-next-line react-hooks/purity
  const daysRemaining = summary && isActive ? Math.ceil((new Date(summary.endsAt).getTime() - Date.now()) / DAY_MS) : 0;
  // eslint-disable-next-line react-hooks/purity
  const daysSinceExpired = summary && isExpired ? Math.floor((Date.now() - new Date(summary.endsAt).getTime()) / DAY_MS) : 0;

  const [showForm, setShowForm] = useState(false);
  const [claimForm, setClaimForm] = useState({ subject: "", description: "", preferredResolution: "" });
  const [evidenceAssetIds, setEvidenceAssetIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const claimFormRef = useRef<HTMLFormElement | null>(null);

  // Reset form when warranty changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setShowForm(false);
    setClaimForm({ subject: "", description: "", preferredResolution: "" });
    setEvidenceAssetIds([]);
    setError(null);
  }, [selected.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Analysis: Other drawers (booking cancel `src/components/bookings/booking-list.tsx:874` uses a second Sheet for immediate render;
  // public catalogue tabs `src/components/professional-services/public-catalogue-pages.tsx:235` use `scrollIntoView({behavior:"smooth"})`).
  // For warranty we keep single drawer context (preserve coverage/professional info) but ensure form is immediately visible:
  // scroll drawer content to form and focus first field when File claim is toggled (covers both Section 5 CTA and footer CTA).
  useEffect(() => {
    if (!showForm) return;
    const frame = window.requestAnimationFrame(() => {
      claimFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const first = claimFormRef.current?.querySelector<HTMLInputElement>("input");
      first?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showForm]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setBusy("submit");
    setError(null);
    try {
      const updated = await submitWarrantyClaim(detail.id, {
        subject: claimForm.subject.trim(),
        description: claimForm.description.trim(),
        preferredResolution: claimForm.preferredResolution.trim() || undefined,
        evidenceAssetIds,
      });
      queryClient.setQueryData(["warranty-detail", audience, selected.id], updated);
      toast.success("Warranty claim submitted");
      setShowForm(false);
      setClaimForm({ subject: "", description: "", preferredResolution: "" });
      setEvidenceAssetIds([]);
      await queryClient.invalidateQueries({ queryKey: ["warranties", audience] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Claim submission failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleEscalate() {
    if (!detail || !openClaim) return;
    const reason = window.prompt("Why does this claim need escalation?");
    if (!reason) return;
    setBusy(`escalate-${openClaim.id}`);
    setError(null);
    try {
      const updated = await escalateWarrantyClaim(detail.id, openClaim.id, {
        lockVersion: openClaim.lockVersion,
        reason,
      });
      queryClient.setQueryData(["warranty-detail", audience, selected.id], updated);
      toast.success("Claim escalated");
      await queryClient.invalidateQueries({ queryKey: ["warranties", audience] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Escalation failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleProfessionalAction(
    claimId: string,
    lockVersion: number,
    action: "START_REVIEW" | "ACCEPT" | "REJECT",
    reason?: string,
  ) {
    setBusy(`${action}-${claimId}`);
    setError(null);
    try {
      const updated = await professionalClaimAction(claimId, "action", { lockVersion, action, reason });
      queryClient.setQueryData(["warranty-detail", audience, selected.id], updated);
      toast.success("Claim updated");
      await queryClient.invalidateQueries({ queryKey: ["warranties", audience] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleScheduleVisit(claimId: string, lockVersion: number) {
    const startsAt = new Date(Date.now() + 86_400_000);
    startsAt.setHours(9, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
    setBusy(`schedule-${claimId}`);
    setError(null);
    try {
      const updated = await professionalClaimAction(claimId, "return-visit", {
        lockVersion,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: "Warranty follow-up visit.",
      });
      queryClient.setQueryData(["warranty-detail", audience, selected.id], updated);
      toast.success("Return visit scheduled");
      await queryClient.invalidateQueries({ queryKey: ["warranties", audience] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scheduling failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleResolve(claimId: string, lockVersion: number) {
    const notes = window.prompt("Resolution notes");
    if (!notes) return;
    setBusy(`resolve-${claimId}`);
    setError(null);
    try {
      const updated = await professionalClaimAction(claimId, "resolve", { lockVersion, resolutionNotes: notes, evidenceAssetIds: [] });
      queryClient.setQueryData(["warranty-detail", audience, selected.id], updated);
      toast.success("Claim resolved");
      await queryClient.invalidateQueries({ queryKey: ["warranties", audience] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Resolution failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleEvidenceUpload(file: File) {
    setBusy("upload");
    setError(null);
    try {
      const assetId = await uploadWarrantyEvidence(file);
      setEvidenceAssetIds((prev) => [...prev, assetId]);
      toast.success("Evidence ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function openEvidence(assetId: string) {
    try {
      const delivery = await warrantyApi<{ url: string }>(`/api/v1/storage/assets/${assetId}/delivery`);
      window.open(delivery.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evidence unavailable");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="flex h-full w-[min(36rem,94vw)] flex-col overflow-hidden p-0" aria-describedby="warranty-drawer-description">
        <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-semibold tracking-title">
                    {summary?.serviceName ?? "Warranty"}
                  </SheetTitle>
                  <SheetDescription id="warranty-drawer-description" className="mt-1 text-[0.68rem] text-muted-foreground">
                    {summary ? `Warranty #WAR-${summary.id.slice(-6).toUpperCase()}` : "Retrieving the latest warranty."}
                  </SheetDescription>
                </div>
                {summary ? <Badge variant={warrantyStatusMeta[summary.status].variant}>{warrantyStatusMeta[summary.status].label}</Badge> : null}
              </div>
            </div>
          </div>
          {detailQuery.isFetching ? (
            <span className="mt-3 inline-flex items-center gap-2 text-[0.68rem] text-muted-foreground" role="status">
              <Spinner className="size-3.5 text-[#6b9f16]" /> Refreshing warranty…
            </span>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {error ? <InlineAlert className="mb-4" variant="error" title="Action failed" description={error} /> : null}
          {detailQuery.isError ? (
            <InlineAlert
              variant="error"
              title="Warranty unavailable"
              description={detailQuery.error instanceof Error ? detailQuery.error.message : "The warranty could not be loaded."}
            />
          ) : detail && summary ? (
            <div className="space-y-4">
              <DrawerSection number="1" title="Protection status">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  {isActive ? (
                    <>
                      <p className="text-sm font-semibold text-[#2a7a00]">Protection active</p>
                      <p className={cn("mt-1 text-[0.72rem]", daysRemaining <= 7 ? "text-[#d16b16]" : "text-success")}>
                        {daysRemaining <= 0 ? "Expires today" : `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`}
                      </p>
                      <p className="mt-2 text-[0.68rem] text-muted-foreground">Coverage: {coverageLabel}</p>
                    </>
                  ) : isExpired ? (
                    <>
                      <p className="text-sm font-semibold text-muted-foreground">Protection expired</p>
                      <p className="mt-1 text-[0.72rem] text-muted-foreground">
                        {daysSinceExpired === 0 ? "Expired today" : `Expired ${daysSinceExpired} day${daysSinceExpired === 1 ? "" : "s"} ago`}
                      </p>
                      <p className="mt-2 text-[0.68rem] text-muted-foreground">Coverage: {coverageLabel}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-muted-foreground">Warranty void</p>
                      <p className="mt-1 text-[0.72rem] text-muted-foreground">Voided on {formatShortDate(summary.endsAt)}</p>
                      <p className="mt-2 text-[0.68rem] text-muted-foreground">Coverage: {coverageLabel}</p>
                    </>
                  )}
                </div>
              </DrawerSection>

              <DrawerSection number="2" title="Professional">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-full bg-[#0c1620] text-[0.62rem] font-semibold text-white">
                        {(detail.providerName ?? summary.providerName)
                          .split(/\s+/)
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{detail.providerName}</p>
                        <p className="text-[0.68rem] text-muted-foreground">Service provider</p>
                      </div>
                    </div>
                    {detail.providerSlug ? (
                      <Link href={`/professionals/${detail.providerSlug}`} className="text-[0.72rem] font-semibold text-trust hover:text-foreground">
                        View profile →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection number="3" title={audience === "client" ? "Related service" : "Related job"}>
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <p className="text-sm font-semibold text-foreground">
                    {audience === "client" ? detail.serviceName : `JOB-${detail.jobId.slice(-6).toUpperCase()} · ${detail.serviceName}`}
                  </p>
                  <Link href={`/${audience}/jobs/${detail.jobId}`} className="mt-2 inline-flex text-[0.72rem] font-semibold text-trust hover:text-foreground">
                    {audience === "client" ? "View service record →" : "View job →"}
                  </Link>
                </div>
              </DrawerSection>

              <DrawerSection number="4" title="Coverage">
                <div className="space-y-3 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div>
                    <h4 className="text-[0.72rem] font-semibold text-foreground">Coverage terms</h4>
                    <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground whitespace-pre-wrap">{detail.termsSnapshot}</p>
                  </div>
                  <div className="rounded-[10px] bg-[#f6f8f8] p-3">
                    <h4 className="text-[0.72rem] font-semibold text-foreground">Exclusions</h4>
                    <p className="mt-1 text-[0.68rem] leading-5 text-muted-foreground whitespace-pre-wrap">{detail.exclusionsSnapshot}</p>
                  </div>
                </div>
              </DrawerSection>

              <DrawerSection number="5" title="Warranty claims">
                <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  {!hasOpenClaim && detail.claims.length === 0 && isActive ? (
                    showForm ? (
                      <form ref={claimFormRef} onSubmit={handleSubmit} className="grid gap-4">
                        <h4 className="text-sm font-semibold">File warranty claim</h4>
                        <p className="text-[0.72rem] text-muted-foreground">Describe the issue and add supporting evidence. A claim does not promise financial compensation.</p>
                        <label className="grid gap-2 text-[0.72rem] font-semibold">
                          Issue
                          <Input
                            autoFocus
                            required
                            minLength={3}
                            value={claimForm.subject}
                            onChange={(e) => setClaimForm((c) => ({ ...c, subject: e.target.value }))}
                            placeholder="e.g. Leaking fitting"
                          />
                        </label>
                        <label className="grid gap-2 text-[0.72rem] font-semibold">
                          What happened?
                          <textarea required minLength={10} className={textareaClass} value={claimForm.description} onChange={(e) => setClaimForm((c) => ({ ...c, description: e.target.value }))} placeholder="Describe the issue in detail" />
                        </label>
                        <label className="grid gap-2 text-[0.72rem] font-semibold">
                          Preferred resolution
                          <Input value={claimForm.preferredResolution} onChange={(e) => setClaimForm((c) => ({ ...c, preferredResolution: e.target.value }))} placeholder="Optional" />
                        </label>
                        <label className="grid gap-2 text-[0.72rem] font-semibold">
                          Evidence (optional)
                          <Input
                            type="file"
                            accept="application/pdf,image/png,image/jpeg,image/webp"
                            disabled={busy === "upload"}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleEvidenceUpload(file);
                            }}
                          />
                          <span className="font-normal text-muted-foreground">{evidenceAssetIds.length ? `${evidenceAssetIds.length} file ready` : "PDF or image, up to 8 MB."}</span>
                        </label>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)} disabled={busy === "submit"}>
                            Cancel
                          </Button>
                          <Button type="submit" className="flex-1" loading={busy === "submit"}>
                            Submit claim
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="text-center py-2">
                        <p className="text-sm font-semibold text-foreground">No claims yet</p>
                        <p className="mt-1 text-[0.72rem] text-muted-foreground">You haven&apos;t filed any warranty claims for this service.</p>
                        <Button size="sm" className="mt-3" onClick={() => setShowForm(true)}>
                          File warranty claim
                        </Button>
                      </div>
                    )
                  ) : openClaim ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={claimStatusMeta[openClaim.status].variant}>{claimStatusMeta[openClaim.status].label}</Badge>
                        {openClaim.status === "RETURN_VISIT_SCHEDULED" ? (
                          <span className="text-[0.68rem] font-semibold text-trust">Return visit scheduled</span>
                        ) : null}
                      </div>
                      <h4 className="mt-3 text-sm font-semibold text-foreground">{openClaim.subject}</h4>
                      <p className="mt-1 text-[0.72rem] leading-5 text-muted-foreground line-clamp-3">{openClaim.description}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-[0.68rem]">
                        <div>
                          <dt className="text-muted-foreground">Claim reference</dt>
                          <dd className="mt-1 font-medium text-foreground">CLM-{openClaim.id.slice(-6).toUpperCase()}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Submitted</dt>
                          <dd className="mt-1 font-medium text-foreground">{formatShortDate(openClaim.submittedAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Evidence</dt>
                          <dd className="mt-1 font-medium text-foreground">{openClaim.evidence.length} file{openClaim.evidence.length === 1 ? "" : "s"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Status</dt>
                          <dd className="mt-1 font-medium text-foreground">{claimStatusMeta[openClaim.status].label}</dd>
                        </div>
                      </dl>
                      {openClaim.evidence.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {openClaim.evidence.map((ev) => (
                            <Button key={ev.id} size="sm" variant="outline" onClick={() => void openEvidence(ev.assetId)}>
                              View evidence
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      {openClaim.returnVisitStartsAt && openClaim.returnVisitEndsAt ? (
                        <div className="mt-3 rounded-[10px] bg-[#eff9c9] p-3">
                          <p className="text-[0.72rem] font-semibold text-[#536132]">Return visit scheduled</p>
                          <p className="mt-1 text-[0.72rem] text-[#536132]">
                            {formatSchedule(openClaim.returnVisitStartsAt)} – {formatTime(openClaim.returnVisitEndsAt)}
                          </p>
                        </div>
                      ) : null}
                      {audience === "client" ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(openClaim.status) ? (
                            <Button size="sm" variant="outline" loading={busy === `escalate-${openClaim.id}`} onClick={() => void handleEscalate()}>
                              Escalate claim
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/${audience}/jobs/${detail.jobId}`}>Message professional</Link>
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {openClaim.status === "SUBMITTED" ? (
                            <Button size="sm" loading={busy === `START_REVIEW-${openClaim.id}`} onClick={() => void handleProfessionalAction(openClaim.id, openClaim.lockVersion, "START_REVIEW")}>
                              Start review
                            </Button>
                          ) : null}
                          {["SUBMITTED", "UNDER_REVIEW"].includes(openClaim.status) ? (
                            <>
                              <Button size="sm" variant="secondary" loading={busy === `ACCEPT-${openClaim.id}`} onClick={() => void handleProfessionalAction(openClaim.id, openClaim.lockVersion, "ACCEPT")}>
                                Accept claim
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                loading={busy === `REJECT-${openClaim.id}`}
                                onClick={() => {
                                  const reason = window.prompt("Reason for rejection");
                                  if (reason) void handleProfessionalAction(openClaim.id, openClaim.lockVersion, "REJECT", reason);
                                }}
                              >
                                Reject with reason
                              </Button>
                            </>
                          ) : null}
                          {openClaim.status === "ACCEPTED" ? (
                            <Button size="sm" loading={busy === `schedule-${openClaim.id}`} onClick={() => void handleScheduleVisit(openClaim.id, openClaim.lockVersion)}>
                              Schedule next-day visit
                            </Button>
                          ) : null}
                          {["ACCEPTED", "RETURN_VISIT_SCHEDULED", "ESCALATED"].includes(openClaim.status) ? (
                            <Button size="sm" variant="secondary" loading={busy === `resolve-${openClaim.id}`} onClick={() => void handleResolve(openClaim.id, openClaim.lockVersion)}>
                              Record resolution
                            </Button>
                          ) : null}
                        </div>
                      )}
                      {openClaim.status === "ESCALATED" ? (
                        <p className="mt-2 text-[0.68rem] text-muted-foreground">This claim has been escalated for platform review and is no longer handled solely by the professional.</p>
                      ) : null}
                    </div>
                  ) : latestClaim ? (
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={claimStatusMeta[latestClaim.status].variant}>{claimStatusMeta[latestClaim.status].label}</Badge>
                      </div>
                      <h4 className="mt-3 text-sm font-semibold text-foreground">{latestClaim.subject}</h4>
                      {latestClaim.decisionReason ? (
                        <p className="mt-2 rounded-[10px] bg-[#fff7e8] p-3 text-[0.72rem] leading-5 text-[#7a4a00]">{latestClaim.decisionReason}</p>
                      ) : null}
                      {latestClaim.resolutionNotes ? (
                        <p className="mt-2 rounded-[10px] bg-[#eaf1ff] p-3 text-[0.72rem] leading-5 text-[#1d3a6e]">{latestClaim.resolutionNotes}</p>
                      ) : null}
                      {latestClaim.evidence.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {latestClaim.evidence.map((ev) => (
                            <Button key={ev.id} size="sm" variant="outline" onClick={() => void openEvidence(ev.assetId)}>
                              View evidence
                            </Button>
                          ))}
                        </div>
                      ) : null}
                      {latestClaim.returnVisitStartsAt && latestClaim.returnVisitEndsAt ? (
                        <div className="mt-3 rounded-[10px] bg-[#eff9c9] p-3 text-[0.72rem]">
                          <p className="font-semibold">Return visit scheduled</p>
                          <p className="mt-1">
                            {formatSchedule(latestClaim.returnVisitStartsAt)} – {formatTime(latestClaim.returnVisitEndsAt)}
                          </p>
                        </div>
                      ) : null}
                      {audience === "client" && isActive && !hasOpenClaim ? (
                        <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                          File another claim
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-[0.72rem] text-muted-foreground">No claims recorded.</p>
                  )}
                </div>
              </DrawerSection>
            </div>
          ) : (
            <WarrantyDrawerSkeleton />
          )}
        </div>

        {summary ? (
          <div className="shrink-0 border-t border-black/8 bg-white px-4 py-3 sm:px-5">
            <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
              <Link href={`/${audience}/jobs/${summary.jobId}`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                {audience === "client" ? "View service record" : "View job"}
              </Link>
              {detail?.providerSlug ? (
                <Link href={`/professionals/${detail.providerSlug}`} className={buttonVariants({ className: "w-full" })}>
                  View profile
                </Link>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const ref = `WAR-${summary.id.slice(-6).toUpperCase()}`;
                    try {
                      await navigator.clipboard.writeText(ref);
                      toast.success(`${ref} copied`);
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                >
                  Copy reference
                </Button>
              )}
            </div>
            {audience === "client" && isActive && !hasOpenClaim && !showForm ? (
              <Button className="mt-2 w-full" onClick={() => setShowForm(true)}>
                File warranty claim
              </Button>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[0.68rem] font-semibold text-foreground">
        {number}. {title}
      </h3>
      {children}
    </section>
  );
}

function WarrantyDrawerSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className={cn("rounded-[12px]", index === 2 ? "h-40" : "h-24")} />
      ))}
    </div>
  );
}

function formatSchedule(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString("en-KE", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) as string;
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}
