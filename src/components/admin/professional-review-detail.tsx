"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { OnboardingSummary } from "@/modules/professional-onboarding/types";

type ReviewDecision =
  | "approve"
  | "request_changes"
  | "reject"
  | "suspend"
  | "restore";

const decisionCopy = {
  approve: {
    label: "Approve",
    title: "Approve this professional?",
    description:
      "The organisation becomes active and eligible for marketplace publication.",
  },
  request_changes: {
    label: "Request changes",
    title: "Return this application for changes?",
    description:
      "The professional can edit the application and submit it again.",
  },
  reject: {
    label: "Reject",
    title: "Reject this professional application?",
    description:
      "The organisation is deactivated and the decision remains in its history.",
  },
  suspend: {
    label: "Suspend organisation",
    title: "Suspend this organisation?",
    description:
      "The organisation will disappear from discovery and cannot accept new marketplace work.",
  },
  restore: {
    label: "Restore organisation",
    title: "Restore this organisation?",
    description:
      "The organisation becomes active and its published services become discoverable again.",
  },
} as const;

function resolveDecision(
  status: OnboardingSummary["status"],
  selected: ReviewDecision,
): ReviewDecision {
  if (status === "active") return "suspend";
  if (status === "suspended") return "restore";
  return selected;
}

async function fetchProfessionalReview(
  organisationId: string,
): Promise<OnboardingSummary> {
  const response = await fetch(
    `/api/v1/admin/professionals/${encodeURIComponent(organisationId)}`,
    { credentials: "include" },
  );
  const body = (await response.json().catch(() => null)) as {
    data?: OnboardingSummary;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.data) {
    throw new Error(
      body?.error?.message ?? "The professional application could not be loaded.",
    );
  }
  return body.data;
}

export function ProfessionalReviewDetail({
  organisationId,
}: {
  organisationId: string;
}) {
  const [profile, setProfile] = useState<OnboardingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<ReviewDecision>("approve");
  const [submitting, setSubmitting] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState<string | null>(null);

  useEffect(() => {
    void fetchProfessionalReview(organisationId)
      .then(setProfile)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "The professional application could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
  }, [organisationId]);

  async function submitDecision() {
    if (reason.trim().length < 5 || submitting) return;
    if (!profile) return;
    const effectiveDecision = resolveDecision(profile.status, decision);
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/admin/professionals/${encodeURIComponent(organisationId)}/decision`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision: effectiveDecision,
            reason: reason.trim(),
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "The review decision could not be recorded.",
        );
      }
      setProfile(await fetchProfessionalReview(organisationId));
      setReason("");
      toast.success("Review decision recorded.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The review decision could not be recorded.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openEvidence(assetId: string) {
    setEvidenceLoading(assetId);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/admin/professionals/${encodeURIComponent(organisationId)}/evidence/${encodeURIComponent(assetId)}`,
        { credentials: "include" },
      );
      const body = (await response.json().catch(() => null)) as {
        data?: { url: string };
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.data?.url) {
        throw new Error(body?.error?.message ?? "Evidence could not be opened.");
      }
      window.open(body.data.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Evidence could not be opened.",
      );
    } finally {
      setEvidenceLoading(null);
    }
  }

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="Loading application"
        description="Retrieving the submitted profile, evidence, and history."
        className="min-h-72"
      />
    );
  }
  if (!profile) {
    return (
      <StatePanel
        variant="error"
        title="Application unavailable"
        description={error ?? "The professional application could not be loaded."}
        actionLabel="Try again"
        onAction={() => {
          setError(null);
          setLoading(true);
          void fetchProfessionalReview(organisationId)
            .then(setProfile)
            .catch((cause) =>
              setError(cause instanceof Error ? cause.message : "Unable to retry."),
            )
            .finally(() => setLoading(false));
        }}
        className="min-h-72"
      />
    );
  }

  const canAct = ["pending_review", "active", "suspended"].includes(
    profile.status,
  );
  const effectiveDecision = resolveDecision(profile.status, decision);
  const copy = decisionCopy[effectiveDecision];

  return (
    <div>
      <Link
        href="/admin/professionals"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to review queue
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Professional application
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            {profile.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant={profile.status === "pending_review" ? "warning" : "neutral"}>
              {profile.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant={profile.readiness.complete ? "success" : "danger"}>
              {profile.readiness.completedCount}/{profile.readiness.totalCount} complete
            </Badge>
          </div>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full bg-[#f7f9fa] px-4 py-2 text-xs text-[#68717b]">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Updated {new Date(profile.updatedAt).toLocaleString()}
        </p>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Action could not be completed"
          description={error}
        />
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <div className="space-y-5">
          <Surface className="p-6 shadow-none">
            <h2 className="text-lg font-semibold">Application information</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Detail label="Business type" value={profile.businessType ?? "Not supplied"} />
              <Detail label="Primary category" value={profile.primaryCategory ?? "Not supplied"} />
              <Detail label="Phone" value={profile.phone ?? "Not supplied"} />
              <Detail label="Email" value={profile.email ?? "Not supplied"} />
              <Detail
                label="Operating location"
                value={profile.operatingLocation ?? "Not supplied"}
                icon={<MapPin className="size-4" aria-hidden="true" />}
              />
              <Detail
                label="Service areas"
                value={profile.serviceAreas.join(", ") || "Not supplied"}
              />
              <Detail
                label="Verification type"
                value={profile.verificationType ?? "Not supplied"}
                icon={<BadgeCheck className="size-4" aria-hidden="true" />}
              />
              <Detail
                label="Verification reference"
                value={profile.verificationReference ?? "Not supplied"}
              />
            </div>
            <div className="mt-6 border-t border-black/8 pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#68717b]">
                Public description
              </p>
              <p className="mt-2 text-sm leading-7 text-[#3d4750]">
                {profile.description ?? "No description supplied."}
              </p>
            </div>
          </Surface>

          <Surface className="p-6 shadow-none">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                <FileCheck2 className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold">Private verification evidence</h2>
                <p className="text-xs text-[#68717b]">
                  Access is restricted and audit logged.
                </p>
              </div>
            </div>
            {profile.documents.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {profile.documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/8 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">{document.documentType}</p>
                      <p className="mt-1 max-w-md truncate text-xs text-[#68717b]">
                        {document.fileName}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={evidenceLoading === document.assetId}
                      onClick={() => openEvidence(document.assetId)}
                    >
                      Open evidence
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <StatePanel
                variant="empty"
                title="No verification evidence"
                description="This application has no linked verification document."
                className="mt-5"
              />
            )}
          </Surface>

          <Surface className="p-6 shadow-none">
            <h2 className="font-semibold">Decision history</h2>
            <ol className="mt-5 space-y-4">
              {profile.history.map((item) => (
                <li key={item.id} className="relative border-l border-black/10 pl-5">
                  <span className="absolute top-1 -left-1.5 size-3 rounded-full bg-[#5f8d11]" />
                  <p className="text-sm font-semibold">
                    {item.fromStatus
                      ? `${item.fromStatus.replaceAll("_", " ")} → ${item.toStatus.replaceAll("_", " ")}`
                      : item.toStatus.replaceAll("_", " ")}
                  </p>
                  {item.reason ? (
                    <p className="mt-1 text-sm leading-6 text-[#68717b]">
                      {item.reason}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-[#68717b]">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          </Surface>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Surface className="p-6 shadow-none">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#5f8d11]" aria-hidden="true" />
              <h2 className="font-semibold">Review decision</h2>
            </div>
            {canAct ? (
              <>
                <label className="mt-5 block text-sm font-semibold">
                  Decision
                  <select
                    value={effectiveDecision}
                    onChange={(event) =>
                      setDecision(event.target.value as ReviewDecision)
                    }
                    disabled={profile.status !== "pending_review"}
                    className="mt-2 h-11 w-full rounded-xl border border-black/8 bg-white px-3"
                  >
                    {profile.status === "pending_review" ? (
                      <>
                        <option value="approve">Approve</option>
                        <option value="request_changes">Request changes</option>
                        <option value="reject">Reject</option>
                      </>
                    ) : profile.status === "active" ? (
                      <option value="suspend">Suspend organisation</option>
                    ) : (
                      <option value="restore">Restore organisation</option>
                    )}
                  </select>
                </label>
                <label className="mt-4 block text-sm font-semibold">
                  Decision reason
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={5}
                    minLength={5}
                    maxLength={500}
                    placeholder="Record the evidence and reasoning behind this decision."
                    className="mt-2 w-full rounded-xl border border-black/8 bg-white p-3 text-sm leading-6 outline-none focus:border-[#5f8d11] focus:ring-2 focus:ring-[#b8f52a]/35"
                  />
                </label>
                <p className="mt-2 text-xs text-[#68717b]">
                  Required, 5–500 characters. This becomes part of the permanent history.
                </p>
                <ConfirmDialog
                  title={copy.title}
                  description={copy.description}
                  confirmLabel={copy.label}
                  tone={
                    effectiveDecision === "reject" ||
                    effectiveDecision === "suspend"
                      ? "danger"
                      : "default"
                  }
                  onConfirm={() => void submitDecision()}
                  trigger={
                    <Button
                      type="button"
                      className="mt-5 w-full"
                      disabled={reason.trim().length < 5 || submitting}
                      loading={submitting}
                    >
                      {copy.label}
                    </Button>
                  }
                />
              </>
            ) : (
              <InlineAlert
                className="mt-5"
                variant="info"
                title="Decision already recorded"
                description="This application is no longer pending review. Its immutable decision history appears alongside the application."
              />
            )}
          </Surface>
        </aside>
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#68717b]">
        {label}
      </p>
      <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
        {icon}
        {value}
      </p>
    </div>
  );
}
