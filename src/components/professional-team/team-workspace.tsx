"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  EllipsisVertical,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getTeamRole,
  teamRoleDefinitions,
  type TeamInvitation,
  type TeamMember,
  type TeamRoleKey,
} from "@/components/professional-team/fixtures";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumnDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import {
  SheetDescription,
  SheetTitle,
  WorkspaceDrawer,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export type TeamWorkspaceView = "team" | "invitations" | "member";

type TabKey = "members" | "invitations" | "roles";

const selectClass =
  "h-10 min-w-0 rounded-[11px] border border-black/8 bg-white px-3 pr-8 text-[0.72rem] font-medium text-[#536170] focus-visible:border-[#071522]/20 focus-visible:outline-none";

const SEARCH_DEBOUNCE_MS = 160;
const VALID_PAGE_SIZES = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

type TeamMemberSort =
  | "name_asc"
  | "name_desc"
  | "joined_desc"
  | "joined_asc"
  | "updated_desc"
  | "updated_asc";
type TeamInvitationSort =
  | "created_desc"
  | "created_asc"
  | "expires_desc"
  | "expires_asc";

type TeamMemberQuery = {
  page: number;
  pageSize: number;
  search: string;
  role: string;
  status: string;
  availability: string;
  sort: TeamMemberSort;
};

type TeamInvitationQuery = {
  page: number;
  pageSize: number;
  search: string;
  status: string;
  sort: TeamInvitationSort;
};

function parseMemberQuery(searchParams: URLSearchParams): TeamMemberQuery {
  const rawRole = searchParams.get("role") ?? "";
  const rawStatus = searchParams.get("status") ?? "";
  const rawAvailability = searchParams.get("availability") ?? "";
  const rawSort = searchParams.get("sort") as TeamMemberSort | null;
  const pageSize = Number(searchParams.get("pageSize"));
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: (VALID_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    search: searchParams.get("search") ?? "",
    role: rawRole,
    status: rawStatus,
    availability: rawAvailability,
    sort: (
      [
        "name_asc",
        "name_desc",
        "joined_desc",
        "joined_asc",
        "updated_desc",
        "updated_asc",
      ] as const
    ).includes(rawSort as never)
      ? (rawSort as TeamMemberSort)
      : "name_asc",
  };
}

function parseInvitationQuery(
  searchParams: URLSearchParams,
): TeamInvitationQuery {
  const rawStatus =
    searchParams.get("invitationStatus") ?? searchParams.get("status") ?? "";
  const rawSort =
    searchParams.get("invitationSort") ??
    (searchParams.get("sort") as TeamInvitationSort | null);
  const pageSize = Number(searchParams.get("pageSize"));
  return {
    page: Math.max(1, Number(searchParams.get("page")) || 1),
    pageSize: (VALID_PAGE_SIZES as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    search: searchParams.get("search") ?? "",
    status: rawStatus,
    sort: (
      ["created_desc", "created_asc", "expires_desc", "expires_asc"] as const
    ).includes(rawSort as never)
      ? (rawSort as TeamInvitationSort)
      : "expires_asc",
  };
}

function memberQueryString(state: TeamMemberQuery): string {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE)
    params.set("pageSize", String(state.pageSize));
  if (state.search) params.set("search", state.search);
  if (state.role) params.set("role", state.role);
  if (state.status) params.set("status", state.status);
  if (state.availability) params.set("availability", state.availability);
  if (state.sort !== "name_asc") params.set("sort", state.sort);
  return params.toString();
}

function invitationQueryString(state: TeamInvitationQuery): string {
  const params = new URLSearchParams();
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== DEFAULT_PAGE_SIZE)
    params.set("pageSize", String(state.pageSize));
  if (state.search) params.set("search", state.search);
  if (state.status) params.set("status", state.status);
  if (state.sort !== "expires_asc") params.set("sort", state.sort);
  return params.toString();
}

function replaceUrl(pathname: string | null, query: string) {
  if (!pathname || typeof window === "undefined") return;
  const url = query ? `${pathname}?${query}` : pathname;
  window.history.replaceState(window.history.state, "", url);
}

function formatMoneyFromCents(cents: number, currency = "KES"): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(
    cents / 100,
  );
}

function MemberSortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: TeamMemberSort extends `${infer C}_${string}` ? C : never;
  sort: TeamMemberSort;
  onSort: (column: string) => void;
}) {
  const direction =
    sort === `${column}_asc`
      ? "asc"
      : sort === `${column}_desc`
        ? "desc"
        : null;
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
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

function InvitationSortHeader({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: "created" | "expires";
  sort: TeamInvitationSort;
  onSort: (column: "created" | "expires") => void;
}) {
  const direction =
    sort === `${column}_asc`
      ? "asc"
      : sort === `${column}_desc`
        ? "desc"
        : null;
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ArrowUpDown;
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

function TeamPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/6 px-4 py-3">
      <p className="text-[0.72rem] text-[#536170]">
        Showing {start} to {end} of {totalItems}
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-[0.72rem] text-[#536170]">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-[9px] border border-black/8 bg-white px-2 text-[0.72rem]"
          >
            {VALID_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-[9px] px-3"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="px-2 text-[0.72rem] text-[#536170]">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-[9px] px-3"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

type ApiTeamMember = {
  id: string;
  accountProfileId: string;
  name: string;
  email: string;
  phone: string | null;
  role: TeamRoleKey;
  status: "active" | "deactivated";
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  joinedAt: string;
  updatedAt: string;
  availabilityStatus?: "available" | "on_job" | "unavailable";
  availabilityLabel?: string;
  availabilityDetail?: string | null;
  activeJobs?: number;
  bookingsToday?: number;
  history?: Array<{
    id: string;
    kind: "membership" | "role";
    from: string | null;
    to: string;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  recentAssignments?: Array<{
    id: string;
    bookingId: string | null;
    serviceName: string;
    status: string;
    scheduledAt: string | null;
    displayLabel: string;
  }>;
  permissions?: string[];
};

type ApiTeamInvitation = {
  id: string;
  email: string;
  role: TeamRoleKey;
  status: TeamInvitation["status"];
  assignedJobsOnly: boolean;
  financialDataAccess: boolean;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
};

type ApiTeamOverview = {
  members: ApiTeamMember[];
  invitations: ApiTeamInvitation[];
  canManage: boolean;
};

type ApiRolesOverview = {
  roles: Array<{
    key: TeamRoleKey;
    label: string;
    description: string | null;
    memberCount: number;
    permissions: string[];
  }>;
};

function MemberAction({
  member,
  onViewMember,
}: {
  member: EnrichedMember;
  onViewMember: (id: string) => void;
}) {
  return (
    <span className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[9px] border border-black/8 bg-white hover:bg-muted"
            aria-label={`More actions for ${member.name}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onViewMember(member.id)}>
            View member
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void navigator.clipboard.writeText(member.email)}
          >
            Copy email
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/professional/availability?memberId=${member.id}`}>
              View schedule
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function InvitationAction({
  invitation,
  onResend,
  onRevoke,
}: {
  invitation: TeamInvitation;
  onResend: (invitation: TeamInvitation) => void;
  onRevoke: (invitation: TeamInvitation) => void;
}) {
  return (
    <span className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-[9px] border border-black/8 bg-white hover:bg-muted"
            aria-label={`More actions for ${invitation.email}`}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onResend(invitation)}>
            Resend
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onRevoke(invitation)}
            className="text-danger focus:text-danger"
          >
            Cancel invitation
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              void navigator.clipboard.writeText(invitation.email)
            }
          >
            Copy email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

async function teamApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { data: T }
    | { error?: { message?: string } }
    | null;
  if (!response.ok || !body || !("data" in body)) {
    throw new Error(
      body && "error" in body && body.error?.message
        ? body.error.message
        : "Team access could not be updated.",
    );
  }
  return body.data;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

type EnrichedMember = TeamMember & {
  availabilityStatus: "available" | "on_job" | "unavailable";
  availabilityLabel: string;
  availabilityDetail: string | null;
  activeJobs: number;
  bookingsToday: number;
  recentAssignments: Array<{
    id: string;
    serviceName: string;
    status: string;
    scheduledAt: string | null;
    displayLabel: string;
  }>;
  permissions?: string[];
};

function mapApiMember(member: ApiTeamMember): EnrichedMember {
  const roleHistory = (member.history ?? [])
    .filter((item) => item.kind === "role")
    .map((item) => ({
      id: item.id,
      role: item.to as TeamRoleKey,
      changedBy: item.actorName ?? "System",
      changedAt: formatDate(item.createdAt),
    }));
  const activity = (member.history ?? [])
    .filter((item) => item.kind === "membership")
    .map((item) => ({
      id: item.id,
      action: item.to === "active" ? "Access activated" : "Access deactivated",
      detail:
        item.reason ?? `Membership changed from ${item.from ?? "invited"}.`,
      occurredAt: formatDate(item.createdAt),
    }));
  const recentAssignments = (member.recentAssignments ?? []).map((a) => ({
    id: a.id,
    bookingId: a.bookingId,
    serviceName: a.serviceName,
    status: a.status,
    scheduledAt: a.scheduledAt,
    displayLabel: a.displayLabel,
  }));
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    initials: initials(member.name),
    role: member.role,
    status: member.status,
    joinedAt: formatDate(member.joinedAt),
    lastActiveAt: `Updated ${formatDate(member.updatedAt)}`,
    phone: member.phone ?? "No phone recorded",
    financialAccess: member.financialDataAccess,
    assignedJobsOnly: member.assignedJobsOnly,
    activity,
    roleHistory,
    availabilityStatus: member.availabilityStatus ?? "available",
    availabilityLabel: member.availabilityLabel ?? "Available today",
    availabilityDetail: member.availabilityDetail ?? "8:00 AM – 6:00 PM",
    activeJobs: member.activeJobs ?? 0,
    bookingsToday: member.bookingsToday ?? 0,
    recentAssignments: recentAssignments as Array<{
      id: string;
      serviceName: string;
      status: string;
      scheduledAt: string | null;
      displayLabel: string;
    }>,
    permissions: member.permissions,
  } as EnrichedMember;
}

function mapApiInvitation(invitation: ApiTeamInvitation): TeamInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    sentAt: formatDate(invitation.createdAt),
    expiresAt: formatDate(invitation.expiresAt),
    expiresAtRaw: invitation.expiresAt,
    assignedJobsOnly: invitation.assignedJobsOnly,
    financialAccess: invitation.financialDataAccess,
  };
}

function TeamHeader({ action }: { action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="type-workspace-title text-[1.7rem] tracking-tight">
          Team
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage members, invitations, roles, and access across your
          professional workspace.
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function TeamTabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "members", label: "Members" },
    { key: "invitations", label: "Invitations" },
  ];
  return (
    <div className="mt-6 border-b border-black/8">
      <nav className="flex gap-6" aria-label="Team sections">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-current={active === tab.key ? "page" : undefined}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors",
              active === tab.key
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {active === tab.key ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[#5f8d11]" />
            ) : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

function InviteMemberDialog({
  onInvite,
}: {
  onInvite: (input: {
    email: string;
    role: Exclude<TeamRoleKey, "owner">;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "dispatcher") as Exclude<
      TeamRoleKey,
      "owner"
    >;
    if (!email) return;
    setSubmitting(true);
    try {
      await onInvite({ email, role });
      setOpen(false);
    } catch {
      // caller shows toast
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="bg-[#a3d900] text-[#071522] hover:bg-[#94c400]"
        >
          <UserPlus className="size-4" aria-hidden="true" /> Invite member{" "}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Choose the smallest suitable role. The invitation expires after
            seven days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitInvite} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Work email</span>
            <Input
              name="email"
              type="email"
              required
              placeholder="name@business.co.ke"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Role</span>
            <select
              name="role"
              className={selectClass}
              defaultValue="dispatcher"
            >
              {teamRoleDefinitions
                .filter((role) => role.key !== "owner")
                .map((role) => (
                  <option key={role.key} value={role.key}>
                    {role.label}
                  </option>
                ))}
            </select>
          </label>
          <InlineAlert
            variant="info"
            title="Access starts on acceptance"
            description="The person receives no organisation access until they accept the invitation."
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording…" : "Record invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Member row table — canonical DataTable + URL-synced pagination
function MembersTab({
  members,
  invitations,
  onViewMember,
  onViewDetails,
  isLoading = false,
}: {
  members: EnrichedMember[];
  invitations: TeamInvitation[];
  onViewMember: (memberId: string) => void;
  onViewDetails?: () => void;
  isLoading?: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [queryState, setQueryState] = useState<TeamMemberQuery>(() =>
    parseMemberQuery(new URLSearchParams(searchParams.toString())),
  );
  const [searchInput, setSearchInput] = useState(queryState.search);
  const [dismissed, setDismissed] = useState(false);

  const attentionInvitations = useMemo(
    () => expiringInvitations(invitations),
    [invitations],
  );
  const membersNeedingAttention = useMemo(
    () => members.filter((m) => !m.role),
    [members],
  );
  const attentionCount =
    attentionInvitations.length + membersNeedingAttention.length;

  useEffect(() => {
    setDismissed(false);
  }, [attentionCount]);

  useEffect(() => {
    setSearchInput(queryState.search);
  }, [queryState.search]);

  useEffect(() => {
    if (searchInput.trim() === queryState.search) return;
    const handle = window.setTimeout(() => {
      const next = { ...queryState, search: searchInput.trim(), page: 1 };
      setQueryState(next);
      replaceUrl(pathname, memberQueryString(next));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, queryState, pathname]);

  const updateParams = useCallback(
    (changes: Partial<TeamMemberQuery>, resetPage = true) => {
      const next = {
        ...queryState,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? queryState.page),
      };
      setQueryState(next);
      replaceUrl(pathname, memberQueryString(next));
    },
    [queryState, pathname],
  );

  const handleSort = useCallback(
    (column: string) => {
      const current = queryState.sort;
      const isAsc = current === `${column}_asc`;
      const isDesc = current === `${column}_desc`;
      const nextSort = isAsc
        ? `${column}_desc`
        : isDesc
          ? `${column}_asc`
          : `${column}_asc`;
      updateParams({ sort: nextSort as TeamMemberSort });
    },
    [queryState.sort, updateParams],
  );

  const filtered = useMemo(() => {
    const q = queryState.search.trim().toLowerCase();
    return members
      .filter((member) => {
        const matchesQuery =
          !q ||
          `${member.name} ${member.email} ${getTeamRole(member.role).label}`
            .toLowerCase()
            .includes(q);
        const matchesRole = !queryState.role || member.role === queryState.role;
        const matchesStatus =
          !queryState.status || member.status === queryState.status;
        const matchesAvailability =
          !queryState.availability ||
          member.availabilityStatus === queryState.availability;
        return (
          matchesQuery && matchesRole && matchesStatus && matchesAvailability
        );
      })
      .sort((a, b) => {
        switch (queryState.sort) {
          case "name_desc":
            return b.name.localeCompare(a.name);
          case "joined_desc":
            return (
              new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
            );
          case "joined_asc":
            return (
              new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
            );
          case "updated_desc":
            return (
              new Date(b.lastActiveAt).getTime() -
              new Date(a.lastActiveAt).getTime()
            );
          case "updated_asc":
            return (
              new Date(a.lastActiveAt).getTime() -
              new Date(b.lastActiveAt).getTime()
            );
          case "name_asc":
          default:
            return a.name.localeCompare(b.name);
        }
      });
  }, [
    members,
    queryState.search,
    queryState.role,
    queryState.status,
    queryState.availability,
    queryState.sort,
  ]);

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (queryState.page - 1) * queryState.pageSize;
    return filtered.slice(start, start + queryState.pageSize);
  }, [filtered, queryState.page, queryState.pageSize]);

  const columns = useMemo<DataTableColumnDef<EnrichedMember>[]>(
    () => [
      {
        id: "member",
        header: () => (
          <MemberSortHeader
            label="Member"
            column="name"
            sort={queryState.sort}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => {
          const member = row.original;
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#0a1724] text-sm font-semibold text-white">
                {member.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {member.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </span>
            </div>
          );
        },
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => {
          const role = getTeamRole(row.original.role);
          return (
            <Badge
              variant="neutral"
              className="bg-[#eef1f3] text-[#39434c] border-0"
            >
              {role.label}
            </Badge>
          );
        },
      },
      {
        id: "availability",
        header: "Availability",
        cell: ({ row }) => {
          const member = row.original;
          return (
            <span className="text-xs leading-4">
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    availabilityDot(member.availabilityStatus),
                  )}
                />
                {member.availabilityLabel}
              </span>
              <span className="text-muted-foreground">
                {member.availabilityDetail}
              </span>
            </span>
          );
        },
      },
      {
        id: "work",
        header: "Active work",
        cell: ({ row }) => {
          const member = row.original;
          return (
            <span className="text-xs leading-4">
              <span className="block font-medium">
                {member.activeJobs} active job
                {member.activeJobs === 1 ? "" : "s"}
              </span>
              <span className="block text-muted-foreground">
                {member.bookingsToday} bookings today
              </span>
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "success" : "neutral"}
            className="capitalize"
          >
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => (
          <MemberAction member={row.original} onViewMember={onViewMember} />
        ),
      },
    ],
    [queryState.sort, handleSort, onViewMember],
  );

  const mobileRow = useCallback(
    (member: EnrichedMember) => {
      const role = getTeamRole(member.role);
      return (
        <Surface className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#0a1724] text-sm font-semibold text-white">
              {member.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{member.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {member.email}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="neutral" className="bg-[#eef1f3] text-xs">
                  {role.label}
                </Badge>
                <Badge
                  variant={member.status === "active" ? "success" : "neutral"}
                  className="capitalize"
                >
                  {member.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        availabilityDot(member.availabilityStatus),
                      )}
                    />
                    {member.availabilityLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {member.availabilityDetail}
                  </span>
                </span>
                <span>
                  <span className="block font-medium">
                    {member.activeJobs} jobs • {member.bookingsToday} bookings
                  </span>
                  <span className="text-muted-foreground">Active work</span>
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full rounded-full"
            onClick={() => onViewMember(member.id)}
          >
            View member <ArrowRight className="size-3.5" />
          </Button>
        </Surface>
      );
    },
    [onViewMember],
  );

  const hasActiveFilters = Boolean(
    queryState.search ||
    queryState.role ||
    queryState.status ||
    queryState.availability,
  );
  const clearFilters = useCallback(() => {
    const next: TeamMemberQuery = {
      page: 1,
      pageSize: queryState.pageSize,
      search: "",
      role: "",
      status: "",
      availability: "",
      sort: "name_asc",
    };
    setQueryState(next);
    setSearchInput("");
    replaceUrl(pathname, memberQueryString(next));
  }, [queryState.pageSize, pathname]);

  return (
    <div>
      {attentionCount > 0 && !dismissed ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-4 flex items-start gap-3 rounded-xl border border-[#e1efb2] bg-[#f6fbdf] px-4 py-3.5"
        >
          <span className="grid size-8 place-items-center rounded-full bg-white text-[#6a9a0f]">
            <Users className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              You have {attentionCount} team item
              {attentionCount === 1 ? "" : "s"} that need
              {attentionCount === 1 ? "s" : ""} attention
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {(() => {
                const parts: string[] = [];
                if (attentionInvitations.length > 0) {
                  parts.push(
                    `${attentionInvitations.length} invitation${attentionInvitations.length === 1 ? "" : "s"} expire${attentionInvitations.length === 1 ? "s" : ""} tomorrow`,
                  );
                }
                if (membersNeedingAttention.length > 0) {
                  parts.push(
                    `${membersNeedingAttention.length} member${membersNeedingAttention.length === 1 ? "" : "s"} has no role assigned`,
                  );
                }
                return parts.join(" • ");
              })()}
            </p>
          </div>
          <button
            type="button"
            onClick={onViewDetails}
            className="hidden items-center gap-1 text-xs font-semibold text-[#5f8d11] sm:inline-flex"
          >
            View details <ArrowRight className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="grid size-7 place-items-center rounded-full hover:bg-white/70"
          >
            <X className="size-4 text-muted-foreground" />
          </button>
        </div>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]">
        <div className="flex flex-wrap gap-2 border-b border-black/6 p-3">
          <label className="relative flex-1 min-w-[220px]">
            <span className="sr-only">Search team members</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search team members..."
              className="h-8 rounded-[11px] border-black/8 bg-white pl-9 pr-3 text-[0.72rem]"
            />
          </label>
          <select
            className={selectClass}
            value={queryState.role || "all"}
            onChange={(e) =>
              updateParams({
                role: e.target.value === "all" ? "" : e.target.value,
              })
            }
          >
            <option value="all">Role</option>
            {teamRoleDefinitions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={queryState.status || "all"}
            onChange={(e) =>
              updateParams({
                status: e.target.value === "all" ? "" : e.target.value,
              })
            }
          >
            <option value="all">Status</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <select
            className={selectClass}
            value={queryState.availability || "all"}
            onChange={(e) =>
              updateParams({
                availability: e.target.value === "all" ? "" : e.target.value,
              })
            }
          >
            <option value="all">Availability</option>
            <option value="available">Available</option>
            <option value="on_job">On job</option>
            <option value="unavailable">Unavailable</option>
          </select>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-[11px] px-3 text-[0.72rem]"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={columns}
          data={paginated}
          getRowId={(row) => row.id}
          getRowLabel={(row) => `View team member ${row.name}`}
          onRowClick={(row) => onViewMember(row.id)}
          mobileRow={mobileRow}
          loading={isLoading}
          loadingLabel="Loading team members"
          empty={
            members.length === 0 ? (
              <StatePanel
                className="m-4 border-dashed shadow-none"
                variant="empty"
                title="No team members yet"
                description="Invite the first team member with a role that matches their responsibilities."
              />
            ) : (
              <StatePanel
                className="m-4 border-dashed shadow-none"
                variant="filtered"
                title="No matching members"
                description="Clear the search or choose a different filter."
              />
            )
          }
        />
        {totalItems > 0 ? (
          <TeamPagination
            page={queryState.page}
            pageSize={queryState.pageSize}
            totalItems={totalItems}
            onPageChange={(page) => updateParams({ page }, false)}
            onPageSizeChange={(pageSize) => updateParams({ pageSize }, false)}
          />
        ) : null}
      </section>
    </div>
  );
}

function parseInvitationExpiry(invitation: TeamInvitation): Date | null {
  const raw = invitation.expiresAtRaw ?? invitation.expiresAt;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function expiringInvitations(
  invitations: TeamInvitation[],
  now = new Date(),
): TeamInvitation[] {
  return invitations.filter((invitation) => {
    if (invitation.status !== "pending") return false;
    const expiry = parseInvitationExpiry(invitation);
    if (!expiry) return false;
    const diffMs = expiry.getTime() - now.getTime();
    // Needs attention when expiring within next 48h ("expires tomorrow" inclusive of today)
    return diffMs >= 0 && diffMs <= 48 * 60 * 60 * 1000;
  });
}

function availabilityDot(status: "available" | "on_job" | "unavailable") {
  if (status === "available") return "bg-[#1a9a3a]";
  if (status === "on_job") return "bg-[#ef9d00]";
  return "bg-[#e23a3a]";
}

function MemberDrawer({
  member,
  onClose,
  onUpdate,
  onTransfer,
}: {
  member: EnrichedMember;
  onClose: () => void;
  onUpdate: (patch: {
    role?: Exclude<TeamRoleKey, "owner">;
    status?: "active" | "deactivated";
    assignedJobsOnly?: boolean;
    financialDataAccess?: boolean;
  }) => Promise<void>;
  onTransfer: () => Promise<void>;
}) {
  const [tab, setTab] = useState<
    "overview" | "assignments" | "permissions" | "activity"
  >("overview");
  const role = getTeamRole(member.role);
  const isOwner = member.role === "owner";

  return (
    <WorkspaceDrawer
      onClose={onClose}
      aria-describedby="member-drawer-description"
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-black/7 bg-white px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#0a1724] text-base font-semibold text-white">
              {member.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-xl font-semibold tracking-title">
                    {member.name}
                  </SheetTitle>
                  <SheetDescription
                    id="member-drawer-description"
                    className="mt-1 text-[0.68rem] text-muted-foreground"
                  >
                    {role.label} • Member since {member.joinedAt}
                  </SheetDescription>
                </div>
                <Badge
                  variant={member.status === "active" ? "success" : "neutral"}
                  className="capitalize"
                >
                  {member.status}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-3.5" /> {member.email}
                </p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleDot className="size-3.5" /> {member.phone}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 flex gap-4 border-b border-black/5">
            {(
              ["overview", "assignments", "permissions", "activity"] as const
            ).map((key) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "pb-2.5 text-xs font-medium capitalize",
                  tab === key
                    ? "border-b-2 border-[#5f8d11] text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
          {tab === "overview" ? (
            <div className="space-y-4">
              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    1
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    Availability & workload
                  </h3>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                    <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-[#536170]">
                      <CalendarClock className="size-3.5" aria-hidden="true" />{" "}
                      Availability
                    </div>
                    <p
                      className={cn(
                        "mt-2 flex items-center gap-1.5 text-xs font-medium",
                        member.availabilityStatus === "available"
                          ? "text-[#1a7a2e]"
                          : member.availabilityStatus === "on_job"
                            ? "text-[#a66b00]"
                            : "text-[#c33]",
                      )}
                    >
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          availabilityDot(member.availabilityStatus),
                        )}
                      />
                      {member.availabilityLabel}
                    </p>
                    <p className="text-[0.68rem] text-muted-foreground">
                      {member.availabilityDetail}
                    </p>
                  </div>
                  <div className="rounded-[12px] border border-black/8 bg-white p-3 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                    <div className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-[#536170]">
                      <BriefcaseBusiness
                        className="size-3.5"
                        aria-hidden="true"
                      />{" "}
                      Current workload
                    </div>
                    <p className="mt-2 text-xs font-medium">
                      {member.activeJobs} active jobs
                    </p>
                    <p className="text-[0.68rem] text-muted-foreground">
                      {member.bookingsToday} bookings today
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    2
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    Role
                  </h3>
                </div>
                <div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#0a1724] text-white">
                        <ShieldCheck className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-none">
                          {role.label}
                        </p>
                        <p className="mt-1 max-w-[28ch] text-xs leading-4 text-muted-foreground">
                          {role.summary}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.68rem] text-muted-foreground">
                          <Badge
                            variant="neutral"
                            className="bg-[#eef1f3] text-[#39434c]"
                          >
                            {role.permissions.length} permissions
                          </Badge>
                          <span className="hidden items-center gap-1 sm:inline-flex">
                            <Users className="size-3" aria-hidden="true" />{" "}
                            Owner access
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 rounded-full px-3 text-xs"
                    >
                      Edit role
                    </Button>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    3
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    Permissions summary
                  </h3>
                </div>
                <div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[#536170]">
                      <ShieldCheck className="size-3.5" aria-hidden="true" />{" "}
                      Permissions summary
                    </p>
                    <button
                      onClick={() => setTab("permissions")}
                      className="text-xs font-semibold text-[#5f8d11]"
                    >
                      View all →
                    </button>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs">
                    {role.permissions.slice(0, 4).map((perm) => (
                      <li key={perm} className="flex items-center gap-1.5">
                        <Check className="size-3.5 text-[#1a9a3a]" /> {perm}
                      </li>
                    ))}
                    <li className="flex items-center gap-1.5 text-muted-foreground">
                      <X className="size-3.5" /> Reassign jobs
                    </li>
                    <li className="flex items-center gap-1.5 text-muted-foreground">
                      <X className="size-3.5" /> Cancel jobs
                    </li>
                  </ul>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    4
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    Recent assignments
                  </h3>
                </div>
                <div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#536170]">
                      Recent assignments
                    </p>
                    <button
                      onClick={() => setTab("assignments")}
                      className="text-xs font-semibold text-[#5f8d11]"
                    >
                      View all →
                    </button>
                  </div>
                  {(
                    member.recentAssignments as unknown as Array<{
                      serviceName: string;
                      status: string;
                      scheduledAt: string | null;
                    }>
                  )?.length ? (
                    <ul className="mt-3 space-y-3">
                      {(
                        member.recentAssignments as unknown as Array<{
                          serviceName: string;
                          status: string;
                          scheduledAt: string | null;
                        }>
                      ).map((a, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span className="size-8 shrink-0 rounded-lg bg-[#eef1f3]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold">
                              {a.serviceName}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              In progress •{" "}
                              {a.scheduledAt
                                ? formatDate(a.scheduledAt)
                                : "No date"}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-3 rounded-lg bg-[#fbfcfd] p-2.5">
                        <span className="size-8 rounded-lg bg-[#e8f0fe]" />
                        <span>
                          <p className="text-xs font-medium">
                            Kitchen Plumbing
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            JOB-1042 · In progress
                          </p>
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Today, 9:00 AM
                        </span>
                      </div>
                      <div className="flex gap-3 rounded-lg bg-[#fbfcfd] p-2.5">
                        <span className="size-8 rounded-lg bg-[#e8f0fe]" />
                        <span>
                          <p className="text-xs font-medium">AC Servicing</p>
                          <p className="text-[11px] text-muted-foreground">
                            JOB-1038 · Scheduled
                          </p>
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Tomorrow, 10:00 AM
                        </span>
                      </div>
                      <div className="flex gap-3 rounded-lg bg-[#fbfcfd] p-2.5">
                        <span className="size-8 rounded-lg bg-[#e8f0fe]" />
                        <span>
                          <p className="text-xs font-medium">
                            Pipe Replacement
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            JOB-1031 · In progress
                          </p>
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          Mon, 8 Sep
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : tab === "permissions" ? (
            <div className="space-y-4">
              <div className="rounded-[12px] border border-black/8 bg-[#071522] p-4 text-white shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                <p className="text-xs font-semibold tracking-widest text-[#a3d900] uppercase">
                  {role.label}
                </p>
                <p className="mt-1 text-sm leading-5 text-white/70">
                  {role.summary}
                </p>
                <ul className="mt-3 space-y-1.5 text-xs text-white/80">
                  {role.permissions.map((perm) => (
                    <li key={perm} className="flex gap-2">
                      <Check className="size-3.5 text-[#a3d900]" /> {perm}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Role history</p>
                  <span className="rounded-full bg-[#eef1f3] px-2.5 py-1 text-[0.62rem] font-semibold text-[#536170]">
                    {member.roleHistory.length}
                  </span>
                </div>
                {member.roleHistory.length ? (
                  <ul className="mt-3 divide-y divide-black/5">
                    {member.roleHistory.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]">
                          <ShieldCheck
                            className="size-3.5"
                            aria-hidden="true"
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">
                            {getTeamRole(item.role).label}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Set by {item.changedBy} • {item.changedAt}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 rounded-[10px] border border-dashed border-black/10 bg-[#fbfcfd] px-4 py-6 text-center">
                    <ShieldCheck
                      className="mx-auto size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-xs font-medium text-foreground">
                      No role changes yet
                    </p>
                    <p className="mx-auto mt-1 max-w-[28ch] text-xs leading-4 text-muted-foreground">
                      Role assignments and updates will appear here once the
                      member’s access changes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : tab === "assignments" ? (
            <div className="space-y-4">
              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    1
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    Assignments
                  </h3>
                </div>
                <div className="mt-2 rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
                  <p className="text-sm font-semibold">Active workload</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Jobs currently assigned to {member.name}. Assignments update
                    as bookings are confirmed and jobs progress.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-[10px] bg-[#fbfcfd] px-3 py-3">
                      <p className="text-xs font-medium">
                        {member.activeJobs} active jobs
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        In progress
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-[#fbfcfd] px-3 py-3">
                      <p className="text-xs font-medium">
                        {member.bookingsToday} bookings today
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Scheduled
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              <section>
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-[#edf7dd] text-[0.68rem] font-semibold text-[#5f8d11]">
                    2
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide text-[#536170]">
                    What happens next
                  </h3>
                </div>
                <div className="mt-2 rounded-[12px] border border-black/8 bg-[#fbfcfd] p-4 text-xs leading-5 text-muted-foreground">
                  Assign a new job from{" "}
                  <span className="font-medium text-foreground">Jobs</span> or
                  reassign from the member list. Availability and workload
                  update automatically.
                </div>
              </section>
            </div>
          ) : (
            <div className="rounded-[12px] border border-black/8 bg-white p-4 shadow-[0_3px_12px_rgba(15,31,43,0.035)]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Recent activity</p>
                <span className="rounded-full bg-[#eef1f3] px-2.5 py-1 text-[0.62rem] font-semibold text-[#536170]">
                  {member.activity.length}
                </span>
              </div>
              {member.activity.length ? (
                <ol className="mt-4 space-y-4">
                  {member.activity.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <span className="grid size-7 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                        <Clock3 className="size-3.5" />
                      </span>
                      <span>
                        <p className="text-xs font-semibold">{item.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.occurredAt}
                        </p>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-4 rounded-[10px] border border-dashed border-black/10 bg-[#fbfcfd] px-4 py-8 text-center">
                  <Clock3
                    className="mx-auto size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="mt-2 text-xs font-medium text-foreground">
                    No recent activity
                  </p>
                  <p className="mx-auto mt-1 max-w-[28ch] text-xs leading-4 text-muted-foreground">
                    Membership changes, role updates, and assignment history
                    will show up here.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-black/8 bg-white px-4 py-4 sm:px-6">
          <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
            <Link
              href={`/professional/availability?memberId=${member.id}`}
              className={cn(buttonVariants(), "w-full rounded-full")}
            >
              View schedule <ArrowRight className="size-3.5" />
            </Link>
            <Button variant="outline" className="w-full rounded-full">
              <Mail className="size-3.5" /> Message
            </Button>
          </div>
          {!isOwner ? (
            <ConfirmDialog
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full rounded-full text-danger hover:bg-danger-soft"
                >
                  Deactivate member
                </Button>
              }
              title={
                member.status === "active"
                  ? `Deactivate ${member.name}?`
                  : `Reactivate ${member.name}?`
              }
              description={
                member.status === "active"
                  ? "Workspace access ends immediately."
                  : "Member regains access."
              }
              confirmLabel={
                member.status === "active" ? "Deactivate" : "Reactivate"
              }
              tone={member.status === "active" ? "danger" : "default"}
              onConfirm={() =>
                onUpdate({
                  status: member.status === "active" ? "deactivated" : "active",
                })
              }
            />
          ) : null}
          {!isOwner ? (
            <ConfirmDialog
              trigger={
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full rounded-full"
                >
                  Transfer ownership
                </Button>
              }
              title={`Transfer ownership to ${member.name}?`}
              description="The current owner becomes a manager."
              confirmLabel="Transfer ownership"
              onConfirm={onTransfer}
            />
          ) : null}
        </div>
      </div>
    </WorkspaceDrawer>
  );
}

function InvitationsTab({
  invitations,
  onRevoke,
  onResend,
  isLoading = false,
}: {
  invitations: TeamInvitation[];
  onRevoke: (invitation: TeamInvitation) => Promise<void>;
  onResend: (invitation: TeamInvitation) => Promise<void>;
  isLoading?: boolean;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [queryState, setQueryState] = useState<TeamInvitationQuery>(() =>
    parseInvitationQuery(new URLSearchParams(searchParams.toString())),
  );
  const [searchInput, setSearchInput] = useState(queryState.search);

  useEffect(() => {
    setSearchInput(queryState.search);
  }, [queryState.search]);

  useEffect(() => {
    if (searchInput.trim() === queryState.search) return;
    const handle = window.setTimeout(() => {
      const next = { ...queryState, search: searchInput.trim(), page: 1 };
      setQueryState(next);
      replaceUrl(pathname, invitationQueryString(next));
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [searchInput, queryState, pathname]);

  const updateParams = useCallback(
    (changes: Partial<TeamInvitationQuery>, resetPage = true) => {
      const next = {
        ...queryState,
        ...changes,
        page: resetPage ? 1 : (changes.page ?? queryState.page),
      };
      setQueryState(next);
      replaceUrl(pathname, invitationQueryString(next));
    },
    [queryState, pathname],
  );

  const handleSort = useCallback(
    (column: "created" | "expires") => {
      const current = queryState.sort;
      const isAsc = current === `${column}_asc`;
      const isDesc = current === `${column}_desc`;
      const nextSort = isAsc
        ? `${column}_desc`
        : isDesc
          ? `${column}_asc`
          : `${column}_asc`;
      updateParams({ sort: nextSort as TeamInvitationSort });
    },
    [queryState.sort, updateParams],
  );

  const filtered = useMemo(() => {
    const q = queryState.search.trim().toLowerCase();
    return invitations
      .filter((inv) => {
        const matchesSearch =
          !q ||
          inv.email.toLowerCase().includes(q) ||
          getTeamRole(inv.role).label.toLowerCase().includes(q);
        const matchesStatus =
          !queryState.status || inv.status === queryState.status;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        const aCreated = new Date(a.expiresAtRaw ?? a.sentAt).getTime();
        const bCreated = new Date(b.expiresAtRaw ?? b.sentAt).getTime();
        const aExpires = new Date(a.expiresAtRaw ?? a.expiresAt).getTime();
        const bExpires = new Date(b.expiresAtRaw ?? b.expiresAt).getTime();
        switch (queryState.sort) {
          case "created_asc":
            return aCreated - bCreated;
          case "expires_desc":
            return bExpires - aExpires;
          case "expires_asc":
            return aExpires - bExpires;
          case "created_desc":
          default:
            return bCreated - aCreated;
        }
      });
  }, [invitations, queryState.search, queryState.status, queryState.sort]);

  const totalItems = filtered.length;
  const paginated = useMemo(() => {
    const start = (queryState.page - 1) * queryState.pageSize;
    return filtered.slice(start, start + queryState.pageSize);
  }, [filtered, queryState.page, queryState.pageSize]);

  const columns = useMemo<DataTableColumnDef<TeamInvitation>[]>(
    () => [
      {
        id: "email",
        header: "Email",
        cell: ({ row }) => (
          <span className="truncate font-medium text-[0.72rem]">
            {row.original.email}
          </span>
        ),
      },
      {
        id: "role",
        header: "Role",
        cell: ({ row }) => (
          <Badge variant="neutral" className="capitalize">
            {getTeamRole(row.original.role).label}
          </Badge>
        ),
      },
      {
        id: "sent",
        header: () => (
          <InvitationSortHeader
            label="Sent"
            column="created"
            sort={queryState.sort}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-[0.72rem] text-muted-foreground">
            {row.original.sentAt}
          </span>
        ),
      },
      {
        id: "expires",
        header: () => (
          <InvitationSortHeader
            label="Expires"
            column="expires"
            sort={queryState.sort}
            onSort={handleSort}
          />
        ),
        cell: ({ row }) => (
          <span className="text-[0.72rem] text-muted-foreground">
            {row.original.expiresAt}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const variant =
            status === "pending"
              ? "warning"
              : status === "accepted"
                ? "success"
                : status === "expired"
                  ? "danger"
                  : "neutral";
          return (
            <Badge variant={variant as never} className="capitalize">
              {status}
            </Badge>
          );
        },
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) => {
          const inv = row.original;
          if (inv.status === "pending") {
            return (
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => void onResend(inv)}
                >
                  Resend
                </Button>
                <InvitationAction
                  invitation={inv}
                  onResend={onResend}
                  onRevoke={onRevoke}
                />
              </div>
            );
          }
          return (
            <span className="flex justify-end">
              <InvitationAction
                invitation={inv}
                onResend={onResend}
                onRevoke={onRevoke}
              />
            </span>
          );
        },
      },
    ],
    [queryState.sort, handleSort, onResend, onRevoke],
  );

  const mobileRow = useCallback(
    (inv: TeamInvitation) => {
      const variant =
        inv.status === "pending"
          ? "warning"
          : inv.status === "accepted"
            ? "success"
            : inv.status === "expired"
              ? "danger"
              : "neutral";
      return (
        <Surface className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{inv.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="neutral" className="capitalize">
                  {getTeamRole(inv.role).label}
                </Badge>
                <Badge variant={variant as never} className="capitalize">
                  {inv.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <span>
                  <span className="block font-medium">Sent</span>
                  <span className="text-muted-foreground">{inv.sentAt}</span>
                </span>
                <span>
                  <span className="block font-medium">Expires</span>
                  <span className="text-muted-foreground">{inv.expiresAt}</span>
                </span>
              </div>
            </div>
            <InvitationAction
              invitation={inv}
              onResend={onResend}
              onRevoke={onRevoke}
            />
          </div>
          {inv.status === "pending" ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 w-full rounded-full"
              onClick={() => void onResend(inv)}
            >
              Resend invitation
            </Button>
          ) : null}
        </Surface>
      );
    },
    [onResend, onRevoke],
  );

  const hasActiveFilters = Boolean(queryState.search || queryState.status);

  const clearFilters = useCallback(() => {
    const next: TeamInvitationQuery = {
      page: 1,
      pageSize: queryState.pageSize,
      search: "",
      status: "",
      sort: "expires_asc",
    };
    setQueryState(next);
    setSearchInput("");
    replaceUrl(pathname, invitationQueryString(next));
  }, [queryState.pageSize, pathname]);

  return (
    <section className="mt-2 overflow-hidden rounded-[15px] border border-black/8 bg-white shadow-[0_5px_18px_rgba(15,31,43,0.035)]">
      <div className="flex flex-wrap gap-2 border-b border-black/6 p-3">
        <label className="relative flex-1 min-w-[220px]">
          <span className="sr-only">Search invitations</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search invitations..."
            className="h-10 rounded-[11px] border-black/8 bg-white pl-9 pr-3 text-[0.72rem]"
          />
        </label>
        <select
          className={selectClass}
          value={queryState.status || "all"}
          onChange={(e) =>
            updateParams({
              status: e.target.value === "all" ? "" : e.target.value,
            })
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 rounded-[11px] px-3 text-[0.72rem]"
            onClick={clearFilters}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={paginated}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `Invitation for ${row.email}`}
        mobileRow={mobileRow}
        loading={isLoading}
        loadingLabel="Loading invitations"
        empty={
          invitations.length === 0 ? (
            <StatePanel
              className="m-4 border-dashed shadow-none"
              variant="empty"
              title="No invitations yet"
              description="Pending, accepted and expired invitations will appear here."
            />
          ) : (
            <StatePanel
              className="m-4 border-dashed shadow-none"
              variant="filtered"
              title="No matching invitations"
              description="Clear the search or choose a different filter."
            />
          )
        }
      />
      {totalItems > 0 ? (
        <TeamPagination
          page={queryState.page}
          pageSize={queryState.pageSize}
          totalItems={totalItems}
          onPageChange={(page) => updateParams({ page }, false)}
          onPageSizeChange={(pageSize) => updateParams({ pageSize }, false)}
        />
      ) : null}
    </section>
  );
}

function RolesPermissionsTab({
  rolesData,
  members,
}: {
  rolesData: ApiRolesOverview | null;
  members: EnrichedMember[];
}) {
  const [selectedKey, setSelectedKey] = useState<TeamRoleKey>("technician");
  const roles =
    rolesData?.roles ??
    teamRoleDefinitions.map((r) => ({
      key: r.key,
      label: r.label,
      description: r.summary,
      memberCount: members.filter((m) => m.role === r.key).length,
      permissions: r.permissions,
    }));
  const selected = roles.find((r) => r.key === selectedKey) ?? roles[0];

  function isChecked(label: string) {
    if (!selected) return false;
    // Map fixture permission labels to presence via simple heuristic: if role is owner/manager has more
    if (selected.key === "owner") return true;
    if (selected.key === "manager")
      return !["Record payments", "Access workspace settings"].includes(label)
        ? label !== "View all customer records"
        : false;
    if (selected.key === "technician")
      return [
        "View assigned jobs",
        "Update job progress",
        "Upload evidence",
        "View assigned bookings",
        "View clients related to assigned work",
      ].includes(label);
    if (selected.key === "dispatcher")
      return (
        [
          "View assigned bookings",
          "Manage organisation bookings",
          "View clients related to assigned work",
        ].includes(label) || label.startsWith("View assigned")
      );
    if (selected.key === "receptionist")
      return [
        "View clients related to assigned work",
        "View assigned bookings",
      ].includes(label);
    if (selected.key === "accountant")
      return ["View invoices", "Record payments"].includes(label);
    return selected.permissions.includes(label);
  }

  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
      <Surface className="p-4">
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="text-xs text-muted-foreground">
          Manage roles and their permissions.
        </p>
        <div className="mt-4 space-y-2">
          {roles.map((role) => (
            <button
              key={role.key}
              onClick={() => setSelectedKey(role.key as TeamRoleKey)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left",
                selectedKey === role.key
                  ? "border-[#a3d900] bg-[#f3f8e2]"
                  : "border-black/8 bg-white hover:bg-[#f7f9fa]",
              )}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {role.label}
                </span>
                <span className="block text-xs text-muted-foreground line-clamp-1">
                  {role.description ?? ""}
                </span>
              </span>
              <Badge variant="neutral">{role.memberCount}</Badge>
            </button>
          ))}
          <div className="rounded-xl border border-dashed border-black/10 px-3 py-3">
            <p className="text-sm font-semibold">Custom roles</p>
            <p className="text-xs text-muted-foreground">
              Create and manage custom roles.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-full mt-1"
          >
            <UserPlus className="size-4" /> Create custom role
          </Button>
        </div>
      </Surface>

      {selected ? (
        <Surface className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#0a1724] text-white">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold">{selected.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {selected.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selected.memberCount} members use this role
                </p>
                <div className="mt-2 flex -space-x-1">
                  {members
                    .filter((m) => m.role === selected.key)
                    .slice(0, 4)
                    .map((m) => (
                      <span
                        key={m.id}
                        className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#eef1f3] text-[10px] font-semibold"
                      >
                        {m.initials}
                      </span>
                    ))}
                  {selected.memberCount > 4 ? (
                    <span className="grid size-7 place-items-center rounded-full border-2 border-white bg-[#f5f7f8] text-[10px]">
                      +{selected.memberCount - 4}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-xs"
            >
              Edit role
            </Button>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold">Permissions</h4>
            <p className="text-xs text-muted-foreground">
              These permissions control what members with this role can access
              and do.
            </p>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Jobs",
                  items: [
                    "View assigned jobs",
                    "Update job progress",
                    "Upload evidence",
                    "Reassign jobs",
                    "Cancel jobs",
                  ],
                },
                {
                  title: "Finance",
                  items: ["View invoices", "Record payments"],
                },
                {
                  title: "Bookings",
                  items: [
                    "View assigned bookings",
                    "Manage organisation bookings",
                  ],
                },
                { title: "Team", items: ["Invite members", "Manage roles"] },
                {
                  title: "Clients",
                  items: [
                    "View clients related to assigned work",
                    "View all customer records",
                  ],
                },
                { title: "Settings", items: ["Access workspace settings"] },
              ].map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {group.title}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {group.items.map((label) => {
                      const checked = isChecked(label);
                      return (
                        <li
                          key={label}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span
                            className={cn(
                              "grid size-4 place-items-center rounded border",
                              checked
                                ? "border-[#5f8d11] bg-[#eef8c8] text-[#5f8d11]"
                                : "border-black/15 bg-white",
                            )}
                          >
                            {checked ? <Check className="size-3" /> : null}
                          </span>
                          {label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}

export function TeamWorkspace({
  view,
  memberId,
  canManage,
  initialMembers,
  initialInvitations,
}: {
  view: TeamWorkspaceView;
  memberId?: string;
  canManage?: boolean;
  initialMembers?: TeamMember[];
  initialInvitations?: TeamInvitation[];
}) {
  const fixtureMode =
    initialMembers !== undefined || initialInvitations !== undefined;
  const [members, setMembers] = useState<EnrichedMember[]>(() =>
    initialMembers
      ? initialMembers.map(
          (m) =>
            ({
              ...mapApiMember({
                id: m.id,
                accountProfileId: m.id,
                name: m.name,
                email: m.email,
                phone: m.phone,
                role: m.role,
                status: m.status,
                assignedJobsOnly: m.assignedJobsOnly,
                financialDataAccess: m.financialAccess,
                joinedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              } as ApiTeamMember),
              availabilityStatus: "available" as const,
              availabilityLabel: "Available today",
              availabilityDetail: "8:00 AM – 6:00 PM",
              activeJobs: Math.floor(Math.random() * 3),
              bookingsToday: Math.floor(Math.random() * 2),
            }) as EnrichedMember,
        )
      : [],
  );
  const [invitations, setInvitations] = useState<TeamInvitation[]>(
    initialInvitations ?? [],
  );
  const [serverCanManage, setServerCanManage] = useState(true);
  const [loading, setLoading] = useState(!fixtureMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerMemberId, setDrawerMemberId] = useState<string | null>(
    memberId ?? null,
  );
  const [rolesData, setRolesData] = useState<ApiRolesOverview | null>(null);

  const initialTab: TabKey = view === "invitations" ? "invitations" : "members";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const loadTeam = useCallback(async () => {
    if (fixtureMode) return;
    setLoading(true);
    setLoadError(null);
    try {
      const overview = await teamApi<ApiTeamOverview>(
        "/api/v1/professional/team",
      );
      const nextMembers = overview.members.map(mapApiMember);
      if (view === "member" && memberId) {
        const detail = await teamApi<ApiTeamMember>(
          `/api/v1/professional/team/members/${encodeURIComponent(memberId)}`,
        );
        const merged = nextMembers.map((item) =>
          item.id === detail.id ? mapApiMember(detail) : item,
        );
        // if detail not in list (pagination?), add it
        if (!merged.some((m) => m.id === detail.id))
          merged.push(mapApiMember(detail));
        setMembers(merged);
        setDrawerMemberId(detail.id);
      } else {
        setMembers(nextMembers);
      }
      setInvitations(overview.invitations.map(mapApiInvitation));
      setServerCanManage(overview.canManage);
      // fetch roles
      try {
        const r = await teamApi<ApiRolesOverview>(
          "/api/v1/professional/team/roles",
        );
        setRolesData(r);
      } catch {
        // ignore
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Team access could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [fixtureMode, memberId, view]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTeam();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadTeam]);

  useEffect(() => {
    if (memberId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync drawer with route param
      setDrawerMemberId(memberId);
    }
  }, [memberId]);

  async function runMutation<T>(request: () => Promise<T>) {
    try {
      const result = await request();
      await loadTeam();
      return result;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Team access could not be updated.",
      );
      throw error;
    }
  }

  async function addInvitation(input: {
    email: string;
    role: Exclude<TeamRoleKey, "owner">;
  }) {
    if (fixtureMode) {
      const rawExpiry = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const invitation: TeamInvitation = {
        id: `invite-${input.email}`,
        ...input,
        status: "pending",
        invitedBy: "Current user",
        sentAt: "Today",
        expiresAt: "In 7 days",
        expiresAtRaw: rawExpiry,
      };
      setInvitations((current) => [
        invitation,
        ...current.filter((item) => item.email !== invitation.email),
      ]);
    } else {
      await runMutation(() =>
        teamApi<ApiTeamInvitation>("/api/v1/professional/team/invitations", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    }
    toast.success("Invitation ready", {
      description: `Invitation recorded for ${input.email}.`,
    });
  }

  async function revokeInvitation(invitation: TeamInvitation) {
    if (fixtureMode) {
      setInvitations((current) =>
        current.map((item) =>
          item.id === invitation.id ? { ...item, status: "revoked" } : item,
        ),
      );
      return;
    }
    await runMutation(() =>
      teamApi(
        `/api/v1/professional/team/invitations/${encodeURIComponent(invitation.id)}`,
        { method: "DELETE" },
      ),
    );
  }

  async function resendInvitation(invitation: TeamInvitation) {
    await addInvitation({
      email: invitation.email,
      role: invitation.role === "owner" ? "manager" : invitation.role,
    });
  }

  async function updateMember(
    memberIdToUpdate: string,
    patch: {
      role?: Exclude<TeamRoleKey, "owner">;
      status?: "active" | "deactivated";
      assignedJobsOnly?: boolean;
      financialDataAccess?: boolean;
    },
  ) {
    if (fixtureMode) {
      setMembers((current) =>
        current.map((item) =>
          item.id === memberIdToUpdate
            ? {
                ...item,
                ...patch,
                financialAccess:
                  patch.financialDataAccess ?? item.financialAccess,
              }
            : item,
        ),
      );
      return;
    }
    await runMutation(() =>
      teamApi(
        `/api/v1/professional/team/members/${encodeURIComponent(memberIdToUpdate)}`,
        { method: "PATCH", body: JSON.stringify(patch) },
      ),
    );
  }

  async function transferOwnership(targetMembershipId: string) {
    if (fixtureMode) {
      setMembers((current) =>
        current.map((item) =>
          item.id === targetMembershipId
            ? { ...item, role: "owner" }
            : item.role === "owner"
              ? { ...item, role: "manager" }
              : item,
        ),
      );
      return;
    }
    await runMutation(() =>
      teamApi("/api/v1/professional/team/ownership-transfer", {
        method: "POST",
        body: JSON.stringify({ targetMembershipId }),
      }),
    );
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label="Loading team access">
        <TeamHeader />
        <div className="mt-6 space-y-4">
          <div className="flex gap-2 border-b border-black/6 pb-2">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 max-w-[280px] rounded-[11px]" />
            <Skeleton className="h-10 w-28 rounded-[11px]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-[16px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <>
        <TeamHeader />
        <StatePanel
          className="mt-6"
          variant="error"
          title="Team access unavailable"
          description={loadError}
          actionLabel="Try again"
          onAction={() => void loadTeam()}
        />
      </>
    );
  }

  const resolvedCanManage = canManage ?? serverCanManage;

  if (!resolvedCanManage) {
    return (
      <>
        <TeamHeader />
        <StatePanel
          className="mt-6"
          variant="permission"
          title="Team management permission required"
          description="Ask an owner or authorised manager to update team access."
        />
      </>
    );
  }

  const drawerMember = drawerMemberId
    ? (members.find((m) => m.id === drawerMemberId) ?? null)
    : null;

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (view === "member" && drawerMemberId) {
      // keep drawer when switching tabs? close drawer
      setDrawerMemberId(null);
    }
    // Update URL for shareability without reload
    try {
      const url = new URL(window.location.href);
      if (key === "members") url.searchParams.delete("tab");
      else url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  };

  return (
    <div>
      <TeamHeader action={<InviteMemberDialog onInvite={addInvitation} />} />
      <TeamTabs active={activeTab} onChange={handleTabChange} />

      {activeTab === "members" ? (
        <MembersTab
          members={members}
          invitations={invitations}
          onViewMember={(id) => setDrawerMemberId(id)}
          onViewDetails={() => handleTabChange("invitations")}
          isLoading={false}
        />
      ) : null}
      {activeTab === "invitations" ? (
        <InvitationsTab
          invitations={invitations}
          onRevoke={revokeInvitation}
          onResend={resendInvitation}
          isLoading={false}
        />
      ) : null}
      {activeTab === "roles" ? (
        <RolesPermissionsTab rolesData={rolesData} members={members} />
      ) : null}

      {drawerMember ? (
        <MemberDrawer
          member={drawerMember}
          onClose={() => setDrawerMemberId(null)}
          onUpdate={(patch) => updateMember(drawerMember.id, patch)}
          onTransfer={() => transferOwnership(drawerMember.id)}
        />
      ) : null}
    </div>
  );
}
