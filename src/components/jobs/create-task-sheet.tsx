"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import {
  SheetDescription,
  SheetTitle,
  WorkspaceDrawer,
} from "@/components/ui/sheet";
import { CalendarClock, MapPin, UsersRound, Wrench } from "lucide-react";
import { bookingApi } from "@/components/bookings/booking-api";
import { catalogueApi } from "@/components/professional-services/catalogue-api";
import { listCustomers } from "@/components/customers/customer-api";
import type { ProfessionalServiceSummary } from "@/modules/professional-services/types";
import type { CustomerPage } from "@/modules/customers/types";

interface TeamMember {
  id: string;
  name: string;
  status: string;
}

export function CreateTaskSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [customers, setCustomers] = useState<CustomerPage | null>(null);
  const [services, setServices] = useState<ProfessionalServiceSummary[] | null>(
    null,
  );
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [customerAccountId, setCustomerAccountId] = useState<string | null>(
    null,
  );
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [location, setLocation] = useState("");
  const [scope, setScope] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState("90");
  const [primaryId, setPrimaryId] = useState("");
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [internalNote, setInternalNote] = useState("");
  const [checklist, setChecklist] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    void Promise.all([
      listCustomers("page=1&pageSize=50").catch(() => null),
      catalogueApi<ProfessionalServiceSummary[]>(
        "/api/v1/professional/services",
      ).catch(() => []),
      bookingApi<{ members: TeamMember[] }>("/api/v1/professional/team").catch(
        () => ({ members: [] }),
      ),
    ])
      .then(([cust, serv, teamData]) => {
        if (cust) setCustomers(cust);
        const eligible = (serv as ProfessionalServiceSummary[]).filter(
          (s) => s.status === "published" && s.directBookingEnabled,
        );
        setServices(eligible);
        const active = (teamData as { members: TeamMember[] }).members.filter(
          (m) => m.status === "active",
        );
        setTeam(active);
        if (!serviceId && eligible[0]) setServiceId(eligible[0].id);
        if (!primaryId && active[0]) setPrimaryId(active[0].id);
        if (!startsAt) {
          const d = new Date();
          d.setHours(d.getHours() + 2, 0, 0, 0);
          const pad = (n: number) => String(n).padStart(2, "0");
          setStartsAt(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
          );
        }
      })
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "Could not load task context",
        ),
      )
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!customerId) {
      setCustomerAccountId(null);
      return;
    }
    setCustomerDetailLoading(true);
    void import("@/components/customers/customer-api")
      .then(({ getCustomer }) => getCustomer(customerId))
      .then((detail) => setCustomerAccountId(detail.accountProfileId))
      .catch(() => setCustomerAccountId(null))
      .finally(() => setCustomerDetailLoading(false));
  }, [customerId]);

  const locationValid = location.trim().length >= 3;
  const scopeValid = scope.trim().length >= 20;
  const startsValid = Boolean(
    startsAt &&
    !Number.isNaN(new Date(startsAt).getTime()) &&
    new Date(startsAt).getTime() > Date.now(),
  );
  const primaryValid = Boolean(primaryId);
  const canSubmit = Boolean(
    customerAccountId &&
    serviceId &&
    locationValid &&
    scopeValid &&
    startsValid &&
    primaryValid &&
    !busy,
  );

  const toggleCrew = (id: string) => {
    setCrewIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (!customerAccountId) {
      setSubmitError(
        "Selected customer has no linked account. Invite and reconcile first.",
      );
      return;
    }
    const accountId = customerAccountId;
    setBusy(true);
    setSubmitError(null);
    try {
      const filteredChecklist = checklist
        .map((s) => s.trim())
        .filter((s) => s.length >= 3);
      const res = await bookingApi<{ id: string }>(
        "/api/v1/professional/tasks",
        {
          method: "POST",
          body: JSON.stringify({
            clientAccountId: accountId,
            serviceId,
            membershipId: primaryId,
            additionalMembershipIds: crewIds,
            startsAt: new Date(startsAt).toISOString(),
            expectedDurationMinutes: Number(duration),
            location: location.trim(),
            scope: scope.trim(),
            priority: "normal",
            internalNote: internalNote.trim() || undefined,
            checklist: filteredChecklist.length ? filteredChecklist : undefined,
          }),
        },
      );
      toast.success("Task created", {
        description: `Assigned to ${1 + crewIds.length} member(s).`,
      });
      onOpenChange(false);
      // reset
      setLocation("");
      setScope("");
      setInternalNote("");
      setChecklist([""]);
      setCrewIds([]);
      // immediate calendar refresh — invalidate React Query caches
      void queryClient.invalidateQueries({ queryKey: ["availability-calendar"] });
      void queryClient.invalidateQueries({ queryKey: ["availability-schedule-config"] });
      void queryClient.invalidateQueries({ queryKey: ["booking"] });
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Task could not be created.";
      setSubmitError(msg);
      toast.error("Task creation failed", { description: msg });
    } finally {
      setBusy(false);
    }
  };

  const customerOptions = customers?.items ?? [];

  if (!open) return null;
  return (
    <WorkspaceDrawer
      onClose={() => onOpenChange(false)}
      aria-describedby="create-task-desc"
    >
      <div className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]">
            <Wrench className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <SheetTitle className="truncate text-xl font-semibold tracking-title">
                  Create client task
                </SheetTitle>
                <SheetDescription
                  id="create-task-desc"
                  className="mt-1 text-[0.68rem] text-muted-foreground"
                >
                  Linked to the real client booking — your team sees a clear
                  assignment with location, scope and crew.
                </SheetDescription>
              </div>
              <Badge variant="success">Task</Badge>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-[#68717b]">
              Loading customers, services and team…
            </p>
          ) : null}
          {error ? (
            <InlineAlert
              variant="error"
              title="Context unavailable"
              description={error}
            />
          ) : null}

          <DrawerSection number="1" title="Client & service">
            <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Client *
                </span>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white px-3 text-[0.72rem] font-medium text-[#536170]"
                >
                  <option value="">Select customer</option>
                  {customerOptions.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName ?? c.id}{" "}
                      {c.status === "REGISTERED" ? "" : `· ${c.status}`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Must be a registered customer.
                </p>
                {customerDetailLoading ? (
                  <p className="mt-1 text-[11px] text-[#68717b]">
                    Checking account…
                  </p>
                ) : null}
                {customerId && !customerDetailLoading && !customerAccountId ? (
                  <p className="mt-1 text-[11px] text-danger">
                    No linked account — invite and reconcile first.
                  </p>
                ) : null}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Service *
                </span>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white px-3 text-[0.72rem] font-medium"
                >
                  {services?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </DrawerSection>

          <DrawerSection number="2" title="Location & scope">
            <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Location *
                </span>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Westlands, 14 Riverside, Apt 3B"
                  className="h-10 rounded-[11px] text-[0.72rem]"
                />
                <span
                  className={`mt-1 block text-[11px] ${locationValid ? "text-[#5f8d11]" : "text-muted-foreground"}`}
                >
                  {location.trim().length}/3 — exact site for the crew.
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  Scope *
                </span>
                <textarea
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="What needs doing, access, constraints (min 20 chars)…"
                  className="min-h-20 w-full rounded-[11px] border border-black/8 p-3 text-[0.72rem] outline-none focus:border-ring"
                />
                <span
                  className={`mt-1 block text-[11px] ${scopeValid ? "text-[#5f8d11]" : "text-muted-foreground"}`}
                >
                  {scope.trim().length}/20 — clear scope anchors the client job.
                </span>
              </label>
            </div>
          </DrawerSection>

          <DrawerSection number="3" title="Schedule">
            <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    Starts *
                  </span>
                  <Input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="h-10 rounded-[11px] text-[0.72rem]"
                  />
                  {!startsValid && startsAt ? (
                    <span className="mt-1 block text-[11px] text-danger">
                      Choose a future time.
                    </span>
                  ) : null}
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold">
                    Duration *
                  </span>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="h-10 w-full rounded-[11px] border border-black/8 bg-white px-3 text-[0.72rem]"
                  >
                    <option value="30">30 min</option>
                    <option value="60">60 min</option>
                    <option value="90">90 min</option>
                    <option value="120">120 min</option>
                    <option value="180">180 min</option>
                  </select>
                </label>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection number="4" title="Assignment — multiple assignees">
            <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                  Primary assignee * (holds the booking lock)
                </span>
                <select
                  value={primaryId}
                  onChange={(e) => setPrimaryId(e.target.value)}
                  className="h-10 w-full rounded-[11px] border border-black/8 bg-white px-3 text-[0.72rem]"
                >
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3">
                <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                  Additional crew (up to 8)
                </span>
                <div className="grid gap-2">
                  {team
                    .filter((m) => m.id !== primaryId)
                    .map((m) => (
                      <label
                        key={m.id}
                        className="flex items-center gap-2 rounded-[11px] border border-black/8 bg-[#fbfcfd] px-3 py-2 text-[0.72rem] has-[:checked]:border-[#5f8d11] has-[:checked]:bg-[#edf7dd]"
                      >
                        <input
                          type="checkbox"
                          checked={crewIds.includes(m.id)}
                          onChange={() => toggleCrew(m.id)}
                          className="rounded border-black/20"
                        />
                        <span className="flex-1 font-medium">{m.name}</span>
                        <UsersRound className="size-3.5 text-muted-foreground" />
                      </label>
                    ))}
                  {team.filter((m) => m.id !== primaryId).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No additional active members.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </DrawerSection>

          <DrawerSection number="5" title="Additional details">
            <div className="overflow-hidden rounded-[12px] border border-black/8 bg-white shadow-[0_3px_12px_rgba(15,31,43,0.035)] p-3 space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold">
                  Internal note for crew (optional)
                </span>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Access code, client preference…"
                  className="min-h-16 w-full rounded-[11px] border border-black/8 p-3 text-[0.72rem] outline-none focus:border-ring"
                />
              </label>
              <div>
                <span className="mb-1.5 block text-xs font-semibold">
                  Checklist (optional)
                </span>
                {checklist.map((item, idx) => (
                  <div key={idx} className="mt-2 flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((v, i) => (i === idx ? e.target.value : v)),
                        )
                      }
                      placeholder={`Step ${idx + 1}`}
                      className="h-9 rounded-[11px] text-[0.72rem]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setChecklist((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-full"
                  onClick={() =>
                    setChecklist((prev) =>
                      prev.length < 10 ? [...prev, ""] : prev,
                    )
                  }
                >
                  Add step
                </Button>
              </div>
            </div>
          </DrawerSection>
          {submitError ? (
            <InlineAlert
              variant="error"
              title="Task not created"
              description={submitError}
            />
          ) : null}
        </div>
      </div>
      <div className="shrink-0 border-t border-black/8 bg-white px-4 py-3 sm:px-5">
        <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="w-full"
            loading={busy}
            disabled={!canSubmit}
            onClick={submit}
          >
            Create with {1 + crewIds.length}
          </Button>
        </div>
      </div>
    </WorkspaceDrawer>
  );
}

function DrawerSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[0.68rem] font-semibold text-foreground">
        {number}. {title}
      </h3>
      {children}
    </section>
  );
}
