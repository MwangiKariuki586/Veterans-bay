"use client";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  CircleDollarSign,
  Clock3,
  Mail,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
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
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export type TeamWorkspaceView = "team" | "invitations" | "member";

const selectClass =
  "min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";

const statusVariant = {
  active: "success",
  deactivated: "neutral",
  pending: "warning",
  expired: "danger",
  accepted: "success",
  revoked: "neutral",
} as const;

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
  history?: Array<{
    id: string;
    kind: "membership" | "role";
    from: string | null;
    to: string;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
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

function mapApiMember(member: ApiTeamMember): TeamMember {
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
      detail: item.reason ?? `Membership changed from ${item.from ?? "invited"}.`,
      occurredAt: formatDate(item.createdAt),
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
  };
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
    assignedJobsOnly: invitation.assignedJobsOnly,
    financialAccess: invitation.financialDataAccess,
  };
}

function TeamHeader({ view }: { view: TeamWorkspaceView }) {
  const title =
    view === "team"
      ? "Team access"
      : view === "invitations"
        ? "Team invitations"
        : "Member access";
  const description =
    view === "team"
      ? "Keep responsibilities clear and organisation access appropriately limited."
      : view === "invitations"
        ? "Invite staff into a defined role and track every invitation through expiry."
        : "Review role, restrictions, status, and traceable activity for this member.";

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-[#68717b]">
          <Link href="/professional" className="hover:text-foreground">Dashboard</Link>
          <span className="mx-2" aria-hidden="true">›</span>
          <Link href="/professional/team" className="hover:text-foreground">Team</Link>
          {view !== "team" ? (
            <>
              <span className="mx-2" aria-hidden="true">›</span>
              <span className="text-foreground">{view === "invitations" ? "Invitations" : "Member"}</span>
            </>
          ) : null}
        </nav>
        <p className="mt-5 text-xs font-semibold tracking-[0.18em] text-[#5f8d11] uppercase">
          Organisation administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-title sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68717b]">{description}</p>
      </div>
      {view === "member" ? (
        <Link href="/professional/team" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to team
        </Link>
      ) : null}
    </div>
  );
}

function TeamTabs({ active }: { active: "team" | "invitations" }) {
  return (
    <nav className="mt-6 flex flex-wrap gap-2 border-b border-black/8 pb-3" aria-label="Team management">
      <Link
        href="/professional/team"
        className={cn(buttonVariants({ variant: active === "team" ? "secondary" : "ghost", size: "sm" }), "rounded-full")}
        aria-current={active === "team" ? "page" : undefined}
      >
        <Users className="size-4" aria-hidden="true" /> Members
      </Link>
      <Link
        href="/professional/team/invitations"
        className={cn(buttonVariants({ variant: active === "invitations" ? "secondary" : "ghost", size: "sm" }), "rounded-full")}
        aria-current={active === "invitations" ? "page" : undefined}
      >
        <Mail className="size-4" aria-hidden="true" /> Invitations
      </Link>
    </nav>
  );
}

function InviteMemberDialog({ onInvite }: { onInvite: (input: { email: string; role: Exclude<TeamRoleKey, "owner"> }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "dispatcher") as Exclude<TeamRoleKey, "owner">;
    if (!email) return;
    setSubmitting(true);
    try {
      await onInvite({ email, role });
      setOpen(false);
    } catch {
      // The caller presents the safe API error and the dialog remains open.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button"><UserPlus className="size-4" aria-hidden="true" /> Invite member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Choose the smallest suitable role. The invitation expires after seven days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitInvite} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Work email</span>
            <Input name="email" type="email" required placeholder="name@business.co.ke" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Role</span>
            <select name="role" className={selectClass} defaultValue="dispatcher">
              {teamRoleDefinitions.filter((role) => role.key !== "owner").map((role) => (
                <option key={role.key} value={role.key}>{role.label}</option>
              ))}
            </select>
          </label>
          <InlineAlert
            variant="info"
            title="Access starts on acceptance"
            description="The person receives no organisation access until they accept the invitation."
          />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" disabled={submitting}>{submitting ? "Recordingâ€¦" : "Record invitation"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamSummary({ members, invitations }: { members: TeamMember[]; invitations: TeamInvitation[] }) {
  const metrics = [
    { label: "Active members", value: members.filter((member) => member.status === "active").length, icon: Users },
    { label: "Pending invitations", value: invitations.filter((invite) => invite.status === "pending").length, icon: CalendarClock },
    { label: "Assigned-job access", value: members.filter((member) => member.assignedJobsOnly).length, icon: BriefcaseBusiness },
    { label: "Financial access", value: members.filter((member) => member.financialAccess).length, icon: CircleDollarSign },
  ];
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => (
        <Surface key={label} className="p-4 shadow-none">
          <span className="grid size-10 place-items-center rounded-2xl bg-[#eef8c8] text-[#5f8d11]">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-4 text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-[#68717b]">{label}</p>
        </Surface>
      ))}
    </div>
  );
}

function TeamList({ members, invitations, onInvite }: { members: TeamMember[]; invitations: TeamInvitation[]; onInvite: (input: { email: string; role: Exclude<TeamRoleKey, "owner"> }) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "deactivated">("all");
  const filteredMembers = useMemo(() => members.filter((member) => {
    const matchesQuery = `${member.name} ${member.email} ${getTeamRole(member.role).label}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || member.status === status);
  }), [members, query, status]);

  return (
    <>
      <TeamHeader view="team" />
      <TeamTabs active="team" />
      <TeamSummary members={members} invitations={invitations} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Organisation members</h2>
          <p className="mt-1 text-sm text-[#68717b]">Role changes should match each person&apos;s real responsibilities.</p>
        </div>
        <InviteMemberDialog onInvite={onInvite} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
        <label className="relative block">
          <span className="sr-only">Search team members</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#68717b]" aria-hidden="true" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email, or role" className="pl-11" />
        </label>
        <label>
          <span className="sr-only">Filter by member status</span>
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </select>
        </label>
      </div>

      {members.length === 0 ? (
        <StatePanel className="mt-5" variant="empty" title="No team members yet" description="Invite the first team member with a role that matches their responsibilities." />
      ) : filteredMembers.length === 0 ? (
        <StatePanel className="mt-5" variant="filtered" title="No matching members" description="Clear the search or choose a different status." />
      ) : (
        <ul className="mt-5 grid gap-3 xl:grid-cols-2">
          {filteredMembers.map((member) => {
            const role = getTeamRole(member.role);
            return (
              <li key={member.id}>
                <Link href={`/professional/team/${member.id}`} className="flex h-full items-start gap-4 rounded-[22px] border border-black/8 bg-white p-4 transition-colors hover:bg-[#f7f9fa]">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#071522] text-sm font-semibold text-white">{member.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{member.name}</span>
                      <Badge variant={statusVariant[member.status]} className="capitalize">{member.status}</Badge>
                    </span>
                    <span className="mt-1 block truncate text-sm text-[#68717b]">{member.email}</span>
                    <span className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="info">{role.label}</Badge>
                      {member.assignedJobsOnly ? <span className="text-[#68717b]">Assigned jobs only</span> : null}
                      {member.financialAccess ? <span className="text-[#68717b]">Financial access</span> : null}
                    </span>
                    <span className="mt-3 block text-xs text-[#68717b]">{member.lastActiveAt}</span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-[#68717b]" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function InvitationsList({ invitations, onInvite, onRevoke, onResend }: { invitations: TeamInvitation[]; onInvite: (input: { email: string; role: Exclude<TeamRoleKey, "owner"> }) => Promise<void>; onRevoke: (invitation: TeamInvitation) => Promise<void>; onResend: (invitation: TeamInvitation) => Promise<void> }) {
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <TeamHeader view="invitations" />
      <TeamTabs active="invitations" />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Invitation activity</h2>
          <p className="mt-1 text-sm text-[#68717b]">Pending access and expired invitations remain traceable.</p>
        </div>
        <InviteMemberDialog onInvite={onInvite} />
      </div>
      {notice ? <InlineAlert className="mt-4" variant="success" title="Invitation updated" description={notice} /> : null}
      {invitations.length === 0 ? (
        <StatePanel className="mt-5" variant="empty" title="No invitations" description="Invitations you send will appear here with their expiry status." />
      ) : (
        <ul className="mt-5 space-y-3">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="rounded-[22px] border border-black/8 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-semibold">{invitation.email}</p>
                    <Badge variant={statusVariant[invitation.status]} className="capitalize">{invitation.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[#68717b]">
                    {getTeamRole(invitation.role).label} · Invited by {invitation.invitedBy}
                  </p>
                  <p className="mt-2 text-xs text-[#68717b]">Sent {invitation.sentAt} · Expires {invitation.expiresAt}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={invitation.status === "accepted" || invitation.status === "revoked"} onClick={async () => { try { await onResend(invitation); setNotice(`A fresh invitation was recorded for ${invitation.email}.`); } catch {} }}>
                    {invitation.status === "expired" ? "Send again" : "Resend"}
                  </Button>
                  <ConfirmDialog
                    trigger={<Button type="button" size="sm" variant="ghost">Cancel invitation</Button>}
                    title="Cancel this invitation?"
                    description={`${invitation.email} will no longer be able to accept this invitation.`}
                    confirmLabel="Cancel invitation"
                    tone="danger"
                    onConfirm={async () => { try { await onRevoke(invitation); setNotice(`The invitation for ${invitation.email} was revoked.`); } catch {} }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Surface className="mt-6 bg-[#071522] p-6 text-white shadow-none">
        <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold">Invitation safeguards</h2>
        <ul className="mt-3 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
          <li>• Access begins only after acceptance.</li>
          <li>• Expired links cannot create membership.</li>
          <li>• Repeated sends retain one traceable invitation.</li>
          <li>• Role permissions are checked on the server.</li>
        </ul>
      </Surface>
    </>
  );
}

function ToggleSetting({ checked, label, description, onChange, disabled = false }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-black/8 p-4">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#68717b]">{description}</span>
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 size-5" />
    </label>
  );
}

function MemberDetail({ memberId, members, onUpdate, onTransfer }: { memberId: string; members: TeamMember[]; onUpdate: (memberId: string, patch: { role?: Exclude<TeamRoleKey, "owner">; status?: "active" | "deactivated"; assignedJobsOnly?: boolean; financialDataAccess?: boolean }) => Promise<void>; onTransfer: (memberId: string) => Promise<void> }) {
  const member = members.find((item) => item.id === memberId);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!member) {
    return <><TeamHeader view="member" /><StatePanel className="mt-6" variant="error" title="Member not found" description="This member is unavailable in the current organisation." /></>;
  }

  const selectedMember = member;
  const role = getTeamRole(member.role);
  const isOwner = member.role === "owner";
  async function persist(patch: Parameters<typeof onUpdate>[1], message: string) {
    setSaving(true);
    try {
      await onUpdate(selectedMember.id, patch);
      setNotice(message);
    } catch {
      // The caller presents the safe API error.
    } finally {
      setSaving(false);
    }
  }

  async function transferOwnership() {
    setSaving(true);
    try {
      await onTransfer(selectedMember.id);
      setNotice(`Ownership transferred to ${selectedMember.name}.`);
    } catch {
      // The caller presents the safe API error.
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TeamHeader view="member" />
      {notice ? <InlineAlert className="mt-5" variant="success" title="Access updated" description={notice} /> : null}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="space-y-5">
          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-[#071522] text-lg font-semibold text-white">{member.initials}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-semibold">{member.name}</h2>
                  <Badge variant={statusVariant[member.status]} className="capitalize">{member.status}</Badge>
                </div>
                <p className="mt-2 break-all text-sm text-[#68717b]">{member.email}</p>
                <p className="mt-1 text-sm text-[#68717b]">{member.phone}</p>
                <p className="mt-3 text-xs text-[#68717b]">Joined {member.joinedAt} · {member.lastActiveAt}</p>
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="More member actions"><MoreHorizontal className="size-5" /></Button>
            </div>
          </Surface>

          <Surface className="p-5 shadow-none sm:p-6">
            <h2 className="text-lg font-semibold">Role and restrictions</h2>
            <p className="mt-2 text-sm text-[#68717b]">Changes here alter the member&apos;s effective workspace access.</p>
            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-semibold">Standard role</span>
              <select
                className={selectClass}
                value={member.role}
                disabled={isOwner || saving}
                onChange={(event) => { void persist({ role: event.target.value as Exclude<TeamRoleKey, "owner"> }, `${member.name}'s role changed.`); }}
              >
                {teamRoleDefinitions.filter((item) => item.key !== "owner" || isOwner).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              {isOwner ? <span className="mt-2 block text-xs text-[#68717b]">Transfer ownership before changing the final owner&apos;s role.</span> : null}
            </label>
            <div className="mt-4 space-y-3">
              <ToggleSetting
                checked={member.assignedJobsOnly}
                label="Restrict to assigned jobs"
                description="This member can see only work explicitly assigned to them."
                disabled={isOwner || saving}
                onChange={(assignedJobsOnly) => { void persist({ assignedJobsOnly }, `${member.name}'s assignment restriction changed.`); }}
              />
              <ToggleSetting
                checked={member.financialAccess}
                label="Allow financial data"
                description="Grants access to payment records and financial reporting permitted by the role."
                disabled={isOwner || saving}
                onChange={(financialAccess) => { void persist({ financialDataAccess: financialAccess }, `${member.name}'s financial access changed.`); }}
              />
            </div>
          </Surface>

          <Surface className="p-5 shadow-none sm:p-6">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <ol className="mt-5 space-y-4">
              {member.activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]"><Clock3 className="size-4" /></span>
                  <div>
                    <p className="text-sm font-semibold">{item.action}</p>
                    <p className="mt-1 text-sm text-[#68717b]">{item.detail}</p>
                    <p className="mt-1 text-xs text-[#68717b]">{item.occurredAt}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Surface>
        </div>

        <aside className="space-y-5">
          <Surface className="bg-[#071522] p-5 text-white shadow-none">
            <ShieldCheck className="size-6 text-primary" />
            <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-primary uppercase">{role.label}</p>
            <h2 className="mt-2 text-xl font-semibold">Effective access</h2>
            <p className="mt-2 text-sm leading-6 text-white/65">{role.summary}</p>
            <ul className="mt-5 space-y-2 text-sm text-white/75">
              {role.permissions.map((permission) => <li key={permission} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{permission}</li>)}
            </ul>
          </Surface>

          <Surface className="p-5 shadow-none">
            <h2 className="font-semibold">Role history</h2>
            <ol className="mt-4 space-y-3">
              {member.roleHistory.map((item) => (
                <li key={item.id} className="text-sm">
                  <p className="font-semibold">{getTeamRole(item.role).label}</p>
                  <p className="mt-1 text-xs text-[#68717b]">Set by {item.changedBy}</p>
                  <p className="mt-1 text-xs text-[#68717b]">{item.changedAt}</p>
                </li>
              ))}
            </ol>
          </Surface>

          {!isOwner ? (
            <Surface className="p-5 shadow-none">
              <h2 className="font-semibold">Ownership</h2>
              <p className="mt-2 text-sm leading-6 text-[#68717b]">Ownership transfer keeps one accountable owner and records the change.</p>
              <ConfirmDialog
                trigger={<Button type="button" variant="outline" className="mt-4 w-full">Transfer ownership</Button>}
                title={`Transfer ownership to ${member.name}?`}
                description="The current owner becomes a manager. This changes the highest level of organisation control."
                confirmLabel="Transfer ownership"
                onConfirm={transferOwnership}
              />
            </Surface>
          ) : null}

          {!isOwner ? (
            <ConfirmDialog
              trigger={<Button type="button" variant={member.status === "active" ? "danger" : "outline"} className="w-full">{member.status === "active" ? "Deactivate access" : "Reactivate member"}</Button>}
              title={member.status === "active" ? `Deactivate ${member.name}?` : `Reactivate ${member.name}?`}
              description={member.status === "active" ? "Workspace access ends immediately. Membership history is preserved." : "The member regains access according to the role and restrictions shown above."}
              confirmLabel={member.status === "active" ? "Deactivate access" : "Reactivate member"}
              tone={member.status === "active" ? "danger" : "default"}
              onConfirm={() => { const status = member.status === "active" ? "deactivated" : "active"; void persist({ status }, `${member.name} is now ${status}.`); }}
            />
          ) : null}
        </aside>
      </div>
    </>
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
  const fixtureMode = initialMembers !== undefined || initialInvitations !== undefined;
  const [members, setMembers] = useState(initialMembers ?? []);
  const [invitations, setInvitations] = useState(initialInvitations ?? []);
  const [serverCanManage, setServerCanManage] = useState(true);
  const [loading, setLoading] = useState(!fixtureMode);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (fixtureMode) return;
    setLoading(true);
    setLoadError(null);
    try {
      const overview = await teamApi<ApiTeamOverview>("/api/v1/professional/team");
      let nextMembers = overview.members.map(mapApiMember);
      if (view === "member" && memberId) {
        const detail = await teamApi<ApiTeamMember>(
          `/api/v1/professional/team/members/${encodeURIComponent(memberId)}`,
        );
        nextMembers = nextMembers.map((item) =>
          item.id === detail.id ? mapApiMember(detail) : item,
        );
      }
      setMembers(nextMembers);
      setInvitations(overview.invitations.map(mapApiInvitation));
      setServerCanManage(overview.canManage);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Team access could not be loaded.");
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

  async function runMutation<T>(request: () => Promise<T>) {
    try {
      const result = await request();
      await loadTeam();
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Team access could not be updated.");
      throw error;
    }
  }

  async function addInvitation(input: { email: string; role: Exclude<TeamRoleKey, "owner"> }) {
    if (fixtureMode) {
      const invitation: TeamInvitation = { id: `invite-${input.email}`, ...input, status: "pending", invitedBy: "Current user", sentAt: "Today", expiresAt: "In 7 days" };
      setInvitations((current) => [invitation, ...current.filter((item) => item.email !== invitation.email)]);
    } else {
      await runMutation(() => teamApi<ApiTeamInvitation>("/api/v1/professional/team/invitations", { method: "POST", body: JSON.stringify(input) }));
    }
    setInviteNotice(`Invitation recorded for ${input.email}. Delivery will begin when notifications are configured.`);
  }

  async function revokeInvitation(invitation: TeamInvitation) {
    if (fixtureMode) {
      setInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, status: "revoked" } : item));
      return;
    }
    await runMutation(() => teamApi(`/api/v1/professional/team/invitations/${encodeURIComponent(invitation.id)}`, { method: "DELETE" }));
  }

  async function resendInvitation(invitation: TeamInvitation) {
    await addInvitation({ email: invitation.email, role: invitation.role === "owner" ? "manager" : invitation.role });
  }

  async function updateMember(memberIdToUpdate: string, patch: { role?: Exclude<TeamRoleKey, "owner">; status?: "active" | "deactivated"; assignedJobsOnly?: boolean; financialDataAccess?: boolean }) {
    if (fixtureMode) {
      setMembers((current) => current.map((item) => item.id === memberIdToUpdate ? { ...item, ...patch, financialAccess: patch.financialDataAccess ?? item.financialAccess } : item));
      return;
    }
    await runMutation(() => teamApi(`/api/v1/professional/team/members/${encodeURIComponent(memberIdToUpdate)}`, { method: "PATCH", body: JSON.stringify(patch) }));
  }

  async function transferOwnership(targetMembershipId: string) {
    if (fixtureMode) {
      setMembers((current) => current.map((item) => item.id === targetMembershipId ? { ...item, role: "owner" } : item.role === "owner" ? { ...item, role: "manager" } : item));
      return;
    }
    await runMutation(() => teamApi("/api/v1/professional/team/ownership-transfer", { method: "POST", body: JSON.stringify({ targetMembershipId }) }));
  }

  if (loading) {
    return <><TeamHeader view={view} /><StatePanel className="mt-6" variant="loading" title="Loading team access" description="Checking current membership, permissions, and invitations." /></>;
  }

  if (loadError) {
    return <><TeamHeader view={view} /><StatePanel className="mt-6" variant="error" title="Team access unavailable" description={loadError} actionLabel="Try again" onAction={() => { void loadTeam(); }} /></>;
  }

  const resolvedCanManage = canManage ?? serverCanManage;

  if (!resolvedCanManage) {
    return (
      <>
        <TeamHeader view={view} />
        <StatePanel className="mt-6" variant="permission" title="Team management permission required" description="Ask an owner or authorised manager to update team access." />
      </>
    );
  }

  return (
    <div>
      {inviteNotice ? <InlineAlert className="mb-5" variant="success" title="Invitation ready" description={inviteNotice} /> : null}
      {view === "team" ? <TeamList members={members} invitations={invitations} onInvite={addInvitation} /> : null}
      {view === "invitations" ? <InvitationsList invitations={invitations} onInvite={addInvitation} onRevoke={revokeInvitation} onResend={resendInvitation} /> : null}
      {view === "member" && memberId ? <MemberDetail memberId={memberId} members={members} onUpdate={updateMember} onTransfer={transferOwnership} /> : null}
    </div>
  );
}
