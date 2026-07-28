"use client";

import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileImage,
  History,
  MessageSquareText,
  Pause,
  Play,
  Route,
  Send,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EngagementConversation } from "@/components/conversations/engagement-conversation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { JobDetail as JobDetailRecord } from "@/modules/jobs/types";
import {
  clientJobAction,
  getJob,
  jobApi,
  professionalJobAction,
  uploadJobEvidence,
} from "./job-api";

const selectClass =
  "min-h-11 w-full rounded-2xl border border-black/8 bg-white px-4 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";
const textareaClass =
  "min-h-28 w-full resize-y rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";

type TeamMember = {
  id: string;
  name: string;
  status: "active" | "deactivated";
};

export function JobDetail({
  audience,
  jobId,
}: {
  audience: "client" | "professional";
  jobId: string;
}) {
  const [job, setJob] = useState<JobDetailRecord | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [updateText, setUpdateText] = useState("");
  const [updateVisibility, setUpdateVisibility] = useState<
    "CLIENT" | "PROFESSIONAL"
  >("CLIENT");
  const [assignmentId, setAssignmentId] = useState("");
  const [variation, setVariation] = useState({
    description: "",
    reason: "",
    amount: "",
    scheduleImpactMinutes: "",
  });

  const refresh = useCallback(async () => {
    try {
      setJob(await getJob(audience, jobId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job unavailable.");
    }
  }, [audience, jobId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    if (audience === "professional") {
      void jobApi<{ members: TeamMember[] }>("/api/v1/professional/team")
        .then((result) =>
          setTeam(result.members.filter((member) => member.status === "active")),
        )
        .catch(() => undefined);
    }
    return () => window.clearTimeout(initial);
  }, [audience, refresh]);

  async function run(key: string, action: () => Promise<JobDetailRecord>) {
    setBusy(key);
    setError(null);
    try {
      const next = await action();
      setJob(next);
      toast.success("Job updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Job action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!job && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading job"
        description="Retrieving scope, assignment, field evidence, and approval history."
      />
    );
  }
  if (!job) {
    return (
      <StatePanel
        variant="error"
        title="Job unavailable"
        description={error ?? "The job could not be loaded."}
      />
    );
  }

  const action = (path: string, reason?: string) =>
    run(path, () =>
      professionalJobAction(job.id, path, {
        lockVersion: job.lockVersion,
        ...(reason ? { reason } : {}),
      }),
    );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(job.status)}>
              {job.status.replaceAll("_", " ")}
            </Badge>
            <span className="text-xs text-[#7a838c]">
              Job {job.id.slice(0, 8)}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em]">
            {job.serviceName}
          </h1>
          <p className="mt-2 text-sm text-[#68717b]">
            {audience === "client" ? job.providerName : job.clientName}
          </p>
        </div>
        <Link
          href={`/${audience}/bookings/${job.bookingId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          <CalendarDays className="size-4" /> Booking
        </Link>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Job needs attention"
          description={error}
        />
      ) : null}

      {audience === "professional" ? (
        <ProfessionalActions
          job={job}
          busy={busy}
          onAction={action}
        />
      ) : (
        <ClientActions job={job} busy={busy} run={run} />
      )}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
        <div className="grid gap-5">
          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-[#5f8d11]" />
              <h2 className="text-lg font-bold">Scope and checklist</h2>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#46515b]">
              {job.scopeSnapshot}
            </p>
            {job.exclusionsSnapshot ? (
              <p className="mt-3 text-xs leading-5 text-[#7a838c]">
                Exclusions: {job.exclusionsSnapshot}
              </p>
            ) : null}
            <div className="mt-5 divide-y divide-black/6 border-y border-black/6">
              {job.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex min-h-14 items-start gap-3 py-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 accent-[#9ac62b]"
                    checked={item.completed}
                    disabled={
                      audience === "client" ||
                      busy === `checklist-${item.id}` ||
                      ["COMPLETED", "CANCELLED", "DISPUTED"].includes(job.status)
                    }
                    onChange={(event) =>
                      void run(`checklist-${item.id}`, () =>
                        jobApi<JobDetailRecord>(
                          `/api/v1/professional/jobs/${job.id}/checklist/${item.id}`,
                          {
                            method: "PUT",
                            body: JSON.stringify({
                              completed: event.target.checked,
                            }),
                          },
                        ),
                      )
                    }
                  />
                  <span>
                    <span className="font-semibold">{item.label}</span>
                    {item.required ? (
                      <span className="ml-2 text-xs text-[#7a838c]">
                        Required
                      </span>
                    ) : null}
                    {item.resultNote ? (
                      <span className="mt-1 block text-xs text-[#68717b]">
                        {item.resultNote}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </Surface>

          {audience === "professional" &&
          !["COMPLETED", "CANCELLED", "DISPUTED"].includes(job.status) ? (
            <Surface className="p-5 shadow-none sm:p-6">
              <div className="flex items-center gap-2">
                <MessageSquareText className="size-5 text-[#5f8d11]" />
                <h2 className="text-lg font-bold">Record field update</h2>
              </div>
              <form
                className="mt-4 grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!updateText.trim()) return;
                  void run("update", () =>
                    professionalJobAction(job.id, "updates", {
                      updateType: "PROGRESS",
                      visibility: updateVisibility,
                      content: updateText,
                    }),
                  ).then(() => setUpdateText(""));
                }}
              >
                <textarea
                  aria-label="Progress update"
                  className={textareaClass}
                  value={updateText}
                  onChange={(event) => setUpdateText(event.target.value)}
                  placeholder="What changed, what was completed, or what needs attention?"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <select
                    aria-label="Update visibility"
                    className="min-h-11 rounded-2xl border border-black/8 bg-white px-4 text-sm"
                    value={updateVisibility}
                    onChange={(event) =>
                      setUpdateVisibility(
                        event.target.value as "CLIENT" | "PROFESSIONAL",
                      )
                    }
                  >
                    <option value="CLIENT">Visible to client</option>
                    <option value="PROFESSIONAL">Professional only</option>
                  </select>
                  <Button type="submit" loading={busy === "update"}>
                    <Send className="size-4" /> Add update
                  </Button>
                </div>
              </form>
            </Surface>
          ) : null}

          <EvidenceSection
            job={job}
            audience={audience}
            busy={busy}
            run={run}
          />

          <EngagementConversation
            audience={audience}
            basePath={`/api/v1/${audience}/jobs/${job.id}/conversation`}
            contextLabel="job"
            allowAttachments={false}
          />

          <VariationSection
            job={job}
            audience={audience}
            busy={busy}
            variation={variation}
            setVariation={setVariation}
            run={run}
          />
        </div>

        <div className="grid content-start gap-5">
          <Surface className="p-5 shadow-none">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Commercial record</h2>
            </div>
            <p className="mt-4 text-2xl font-bold">
              {formatMoney(job.totalMinor, job.currency)}
            </p>
            <div className="mt-4 grid gap-2 text-sm text-[#68717b]">
              <div className="flex justify-between gap-4">
                <span>Accepted booking</span>
                <span>{formatMoney(job.baseTotalMinor, job.currency)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Approved variations</span>
                <span>
                  {formatMoney(
                    job.approvedVariationTotalMinor,
                    job.currency,
                  )}
                </span>
              </div>
            </div>
          </Surface>

          <Surface className="p-5 shadow-none">
            <div className="flex items-center gap-2">
              <UserRoundPlus className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Assigned team</h2>
            </div>
            <div className="mt-4 grid gap-2">
              {job.assignments.filter((item) => item.active).length ? (
                job.assignments
                  .filter((item) => item.active)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f8f8] px-4 py-3 text-sm"
                    >
                      <span className="font-semibold">{item.displayName}</span>
                      {audience === "professional" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700"
                          disabled={busy === `unassign-${item.id}`}
                          onClick={() =>
                            void run(`unassign-${item.id}`, () =>
                              jobApi<JobDetailRecord>(
                                `/api/v1/professional/jobs/${job.id}/assignments/${item.id}`,
                                {
                                  method: "DELETE",
                                  body: JSON.stringify({
                                    lockVersion: job.lockVersion,
                                    reason: "Assignment updated from job detail.",
                                  }),
                                },
                              ),
                            )
                          }
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))
              ) : (
                <p className="text-sm text-[#7a838c]">Assignment pending.</p>
              )}
            </div>
            {audience === "professional" && team.length ? (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!assignmentId) return;
                  void run("assign", () =>
                    professionalJobAction(job.id, "assignments", {
                      membershipId: assignmentId,
                      lockVersion: job.lockVersion,
                    }),
                  ).then(() => setAssignmentId(""));
                }}
              >
                <select
                  aria-label="Team member"
                  className={selectClass}
                  value={assignmentId}
                  onChange={(event) => setAssignmentId(event.target.value)}
                >
                  <option value="">Choose team member</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  size="sm"
                  loading={busy === "assign"}
                >
                  Assign
                </Button>
              </form>
            ) : null}
          </Surface>

          <Surface className="p-5 shadow-none">
            <div className="flex items-center gap-2">
              <History className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Fulfilment timeline</h2>
            </div>
            <div className="mt-4 grid gap-4">
              {job.history.length ? (
                job.history.map((item) => (
                  <div
                    key={item.id}
                    className="relative border-l border-[#cbd7c3] pl-4 text-sm"
                  >
                    <span className="absolute -left-1 top-1 size-2 rounded-full bg-[#95bf24]" />
                    <p className="font-semibold">
                      {item.action.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-[#7a838c]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                    {item.reason ? (
                      <p className="mt-1 text-xs leading-5 text-[#68717b]">
                        {item.reason}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#7a838c]">No activity yet.</p>
              )}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

function ProfessionalActions({
  job,
  busy,
  onAction,
}: {
  job: JobDetailRecord;
  busy: string | null;
  onAction: (path: string, reason?: string) => Promise<void>;
}) {
  const actions: Array<{
    path: string;
    label: string;
    icon: typeof Play;
    show: boolean;
    variant?: "primary" | "outline" | "danger";
  }> = [
    {
      path: "check-in",
      label: "Check in",
      icon: Route,
      show: ["SCHEDULED", "TEAM_ASSIGNED", "RETURN_VISIT_REQUIRED"].includes(
        job.status,
      ),
    },
    {
      path: "start",
      label: "Start work",
      icon: Play,
      show: ["CREATED", "SCHEDULED", "TEAM_ASSIGNED", "EN_ROUTE"].includes(
        job.status,
      ),
    },
    {
      path: "hold",
      label: "Put on hold",
      icon: Pause,
      show: job.status === "IN_PROGRESS",
      variant: "outline",
    },
    {
      path: "resume",
      label: "Resume",
      icon: Play,
      show: job.status === "ON_HOLD",
    },
    {
      path: "ready",
      label: "Ready for confirmation",
      icon: CheckCircle2,
      show: ["IN_PROGRESS", "RETURN_VISIT_REQUIRED"].includes(job.status),
    },
  ];
  if (!actions.some((item) => item.show)) return null;
  return (
    <Surface className="mt-5 flex flex-wrap gap-2 bg-[#f7fbef] p-4 shadow-none">
      {actions
        .filter((item) => item.show)
        .map((item) => (
          <Button
            key={item.path}
            type="button"
            variant={item.variant}
            loading={busy === item.path}
            onClick={() => void onAction(item.path)}
          >
            <item.icon className="size-4" /> {item.label}
          </Button>
        ))}
    </Surface>
  );
}

function ClientActions({
  job,
  busy,
  run,
}: {
  job: JobDetailRecord;
  busy: string | null;
  run: (
    key: string,
    action: () => Promise<JobDetailRecord>,
  ) => Promise<void>;
}) {
  if (job.status !== "AWAITING_CLIENT_CONFIRMATION") return null;
  return (
    <Surface className="mt-5 border-[#b5d657] bg-[#f7fbef] p-5 shadow-none">
      <p className="text-sm font-semibold text-[#5f8d11]">
        Your response is needed
      </p>
      <h2 className="mt-1 text-xl font-bold">Review the completed work</h2>
      <p className="mt-2 text-sm text-[#68717b]">
        Check the evidence and confirm completion, request clarification, or
        report work that remains unresolved.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          loading={busy === "confirm"}
          onClick={() =>
            void run("confirm", () =>
              clientJobAction(job.id, "completion-response", {
                response: "CONFIRM",
              }),
            )
          }
        >
          Confirm completion
        </Button>
        <Button
          variant="outline"
          loading={busy === "clarification"}
          onClick={() =>
            void run("clarification", () =>
              clientJobAction(job.id, "completion-response", {
                response: "CLARIFICATION",
                comments: "Please clarify the completion evidence.",
              }),
            )
          }
        >
          Request clarification
        </Button>
        <Button
          variant="danger"
          loading={busy === "unresolved"}
          onClick={() =>
            void run("unresolved", () =>
              clientJobAction(job.id, "completion-response", {
                response: "UNRESOLVED",
                comments: "The work still has an unresolved issue.",
              }),
            )
          }
        >
          Report unresolved
        </Button>
      </div>
    </Surface>
  );
}

function EvidenceSection({
  job,
  audience,
  busy,
  run,
}: {
  job: JobDetailRecord;
  audience: "client" | "professional";
  busy: string | null;
  run: (
    key: string,
    action: () => Promise<JobDetailRecord>,
  ) => Promise<void>;
}) {
  async function openEvidence(assetId: string) {
    try {
      const result = await jobApi<{ url: string }>(
        `/api/v1/storage/assets/${assetId}/delivery`,
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Evidence unavailable.",
      );
    }
  }
  return (
    <Surface className="p-5 shadow-none sm:p-6">
      <div className="flex items-center gap-2">
        <FileImage className="size-5 text-[#5f8d11]" />
        <h2 className="text-lg font-bold">Work evidence</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {job.evidence.length ? (
          job.evidence.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void openEvidence(item.assetId)}
              className="rounded-2xl border border-black/8 bg-[#f8f9f9] p-4 text-left"
            >
              <Badge variant="neutral">{item.evidenceType}</Badge>
              <p className="mt-2 text-sm font-semibold">
                {item.caption ?? "View evidence"}
              </p>
              <p className="mt-1 text-xs text-[#7a838c]">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </button>
          ))
        ) : (
          <p className="text-sm text-[#7a838c]">No evidence added yet.</p>
        )}
      </div>
      {audience === "professional" &&
      !["COMPLETED", "CANCELLED", "DISPUTED"].includes(job.status) ? (
        <label className="mt-4 flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#9caf7c] bg-[#fbfdf7] px-4 text-sm font-semibold">
          {busy === "evidence" ? "Uploading evidence…" : "Add photo or PDF evidence"}
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,application/pdf"
            disabled={busy === "evidence"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void run("evidence", async () => {
                const assetId = await uploadJobEvidence(file);
                return professionalJobAction(job.id, "evidence", {
                  assetId,
                  evidenceType:
                    job.status === "IN_PROGRESS" ? "PROGRESS" : "COMPLETION",
                  visibility: "CLIENT",
                  caption: file.name,
                });
              });
            }}
          />
        </label>
      ) : null}
    </Surface>
  );
}

function VariationSection({
  job,
  audience,
  busy,
  variation,
  setVariation,
  run,
}: {
  job: JobDetailRecord;
  audience: "client" | "professional";
  busy: string | null;
  variation: {
    description: string;
    reason: string;
    amount: string;
    scheduleImpactMinutes: string;
  };
  setVariation: React.Dispatch<
    React.SetStateAction<{
      description: string;
      reason: string;
      amount: string;
      scheduleImpactMinutes: string;
    }>
  >;
  run: (
    key: string,
    action: () => Promise<JobDetailRecord>,
  ) => Promise<void>;
}) {
  const activeJob = [
    "EN_ROUTE",
    "IN_PROGRESS",
    "ON_HOLD",
    "RETURN_VISIT_REQUIRED",
  ].includes(job.status);
  async function create(event: FormEvent) {
    event.preventDefault();
    await run("variation-create", () =>
      professionalJobAction(job.id, "variations", {
        description: variation.description,
        reason: variation.reason,
        additionalAmountMinor: Math.round(Number(variation.amount) * 100),
        scheduleImpactMinutes: Number(variation.scheduleImpactMinutes || 0),
      }),
    );
    setVariation({
      description: "",
      reason: "",
      amount: "",
      scheduleImpactMinutes: "",
    });
  }
  return (
    <Surface className="p-5 shadow-none sm:p-6">
      <div className="flex items-center gap-2">
        <CircleDollarSign className="size-5 text-[#5f8d11]" />
        <h2 className="text-lg font-bold">Additional work</h2>
      </div>
      <div className="mt-4 grid gap-3">
        {job.variations.length ? (
          job.variations.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-black/8 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge
                  variant={
                    item.status === "ACCEPTED"
                      ? "trust"
                      : item.status === "REJECTED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {item.status}
                </Badge>
                <strong>
                  {formatMoney(item.additionalAmountMinor, item.currency)}
                </strong>
              </div>
              <p className="mt-3 font-semibold">{item.description}</p>
              <p className="mt-1 text-sm leading-6 text-[#68717b]">
                {item.reason}
              </p>
              {item.scheduleImpactMinutes ? (
                <p className="mt-2 text-xs text-[#7a838c]">
                  Schedule impact: {item.scheduleImpactMinutes} minutes
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {audience === "professional" && item.status === "DRAFT" ? (
                  <Button
                    size="sm"
                    loading={busy === `submit-${item.id}`}
                    onClick={() =>
                      void run(`submit-${item.id}`, () =>
                        professionalJobAction(
                          job.id,
                          `variations/${item.id}/submit`,
                          {},
                        ),
                      )
                    }
                  >
                    Submit to client
                  </Button>
                ) : null}
                {audience === "client" && item.status === "SUBMITTED" ? (
                  <>
                    <Button
                      size="sm"
                      loading={busy === `accept-${item.id}`}
                      onClick={() =>
                        void run(`accept-${item.id}`, () =>
                          clientJobAction(
                            job.id,
                            `variations/${item.id}/respond`,
                            { decision: "ACCEPT" },
                          ),
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === `reject-${item.id}`}
                      onClick={() =>
                        void run(`reject-${item.id}`, () =>
                          clientJobAction(
                            job.id,
                            `variations/${item.id}/respond`,
                            { decision: "REJECT" },
                          ),
                        )
                      }
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#7a838c]">
            No additional work has been requested.
          </p>
        )}
      </div>
      {audience === "professional" && activeJob ? (
        <form className="mt-5 grid gap-3 border-t border-black/6 pt-5" onSubmit={create}>
          <h3 className="font-bold">Draft a variation</h3>
          <Input
            aria-label="Additional work description"
            placeholder="Additional work description"
            value={variation.description}
            onChange={(event) =>
              setVariation((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            required
          />
          <textarea
            aria-label="Reason for additional work"
            className={textareaClass}
            placeholder="Why is this needed?"
            value={variation.reason}
            onChange={(event) =>
              setVariation((current) => ({
                ...current,
                reason: event.target.value,
              }))
            }
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              aria-label="Additional amount in KES"
              type="number"
              min="0"
              step="0.01"
              placeholder="Additional amount (KES)"
              value={variation.amount}
              onChange={(event) =>
                setVariation((current) => ({
                  ...current,
                  amount: event.target.value,
                }))
              }
              required
            />
            <Input
              aria-label="Schedule impact in minutes"
              type="number"
              min="0"
              placeholder="Schedule impact (minutes)"
              value={variation.scheduleImpactMinutes}
              onChange={(event) =>
                setVariation((current) => ({
                  ...current,
                  scheduleImpactMinutes: event.target.value,
                }))
              }
            />
          </div>
          <Button type="submit" loading={busy === "variation-create"}>
            Create draft
          </Button>
        </form>
      ) : null}
    </Surface>
  );
}

function statusVariant(status: JobDetailRecord["status"]) {
  if (status === "COMPLETED") return "trust" as const;
  if (["CANCELLED", "DISPUTED"].includes(status)) return "danger" as const;
  if (
    ["ON_HOLD", "RETURN_VISIT_REQUIRED", "AWAITING_CLIENT_CONFIRMATION"].includes(
      status,
    )
  ) {
    return "warning" as const;
  }
  return "success" as const;
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
