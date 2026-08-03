"use client";

import {
  CalendarClock,
  FileCheck2,
  History,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import { Surface } from "@/components/ui/surface";
import type {
  WarrantyClaim,
  WarrantyDetail as WarrantyDetailRecord,
} from "@/modules/warranties/types";
import {
  escalateWarrantyClaim,
  getWarranty,
  professionalClaimAction,
  submitWarrantyClaim,
  uploadWarrantyEvidence,
  warrantyApi,
} from "./warranty-api";

const textareaClass =
  "min-h-28 w-full resize-y rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm focus-visible:border-[#071522]/35 focus-visible:outline-none";

export function WarrantyDetail({
  audience,
  warrantyId,
}: {
  audience: "client" | "professional";
  warrantyId: string;
}) {
  const [warranty, setWarranty] = useState<WarrantyDetailRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [evidenceAssetIds, setEvidenceAssetIds] = useState<string[]>([]);
  const [claimForm, setClaimForm] = useState({
    subject: "",
    description: "",
    preferredResolution: "",
  });

  const refresh = useCallback(async () => {
    try {
      setWarranty(await getWarranty(audience, warrantyId));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Warranty unavailable.");
    }
  }, [audience, warrantyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function run(
    key: string,
    action: () => Promise<WarrantyDetailRecord>,
    success: string,
  ) {
    setBusy(key);
    setError(null);
    try {
      const next = await action();
      setWarranty(next);
      toast.success(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Warranty action failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitClaim(event: FormEvent) {
    event.preventDefault();
    if (!warranty) return;
    await run(
      "submit",
      () =>
        submitWarrantyClaim(warranty.id, {
          ...claimForm,
          preferredResolution: claimForm.preferredResolution || undefined,
          evidenceAssetIds,
        }),
      "Warranty claim submitted.",
    );
    setClaimForm({ subject: "", description: "", preferredResolution: "" });
    setEvidenceAssetIds([]);
  }

  if (!warranty && !error) {
    return <DetailPageSkeleton />;
  }
  if (!warranty) {
    return (
      <StatePanel
        variant="error"
        title="Warranty unavailable"
        description={error ?? "The warranty could not be loaded."}
      />
    );
  }
  const hasOpenClaim = warranty.claims.some((claim) =>
    [
      "SUBMITTED",
      "UNDER_REVIEW",
      "ACCEPTED",
      "RETURN_VISIT_SCHEDULED",
      "ESCALATED",
    ].includes(claim.status),
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge
            variant={warranty.status === "ACTIVE" ? "success" : "warning"}
          >
            {warranty.status}
          </Badge>
          <h1 className="mt-3 text-3xl font-bold tracking-title">
            {warranty.serviceName}
          </h1>
          <p className="mt-2 text-sm text-[#68717b]">
            {audience === "client" ? warranty.providerName : warranty.clientName}
          </p>
        </div>
        <Link
          href={`/${audience}/jobs/${warranty.jobId}`}
          className={buttonVariants({ variant: "outline" })}
        >
          View service job
        </Link>
      </div>
      {error ? (
        <InlineAlert
          className="mt-5"
          title="Warranty needs attention"
          description={error}
        />
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="grid content-start gap-5">
          <Surface className="p-5 shadow-none sm:p-6">
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Claim history</h2>
            </div>
            {warranty.claims.length ? (
              <div className="mt-5 grid gap-5">
                {warranty.claims.map((claim) => (
                  <ClaimCard
                    key={claim.id}
                    claim={claim}
                    warranty={warranty}
                    audience={audience}
                    busy={busy}
                    setError={setError}
                    run={run}
                  />
                ))}
              </div>
            ) : (
              <StatePanel
                className="mt-5"
                title="No warranty claims"
                description="This coverage has no recorded follow-up issue."
              />
            )}
          </Surface>
        </div>

        <div className="grid content-start gap-5">
          <Surface className="p-5 shadow-none">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-[#5f8d11]" />
              <h2 className="font-bold">Recorded coverage</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#45515c]">
              {warranty.termsSnapshot}
            </p>
            <div className="mt-4 rounded-2xl bg-[#f6f8f8] p-4 text-sm">
              <p className="font-semibold">Recorded exclusions</p>
              <p className="mt-2 leading-6 text-[#68717b]">
                {warranty.exclusionsSnapshot}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-[#68717b]">
              <CalendarClock className="size-4 text-[#5f8d11]" />
              {new Date(warranty.startsAt).toLocaleDateString()} –{" "}
              {new Date(warranty.endsAt).toLocaleDateString()}
            </div>
          </Surface>

          {audience === "client" &&
          warranty.status === "ACTIVE" &&
          !hasOpenClaim ? (
            <Surface className="p-5 shadow-none">
              <h2 className="font-bold">Submit a warranty claim</h2>
              <p className="mt-2 text-sm leading-6 text-[#68717b]">
                Describe the issue and add supporting evidence. A claim does not
                promise financial compensation.
              </p>
              <form className="mt-5 grid gap-4" onSubmit={submitClaim}>
                <label className="grid gap-2 text-sm font-semibold">
                  Issue
                  <Input
                    required
                    minLength={3}
                    value={claimForm.subject}
                    onChange={(event) =>
                      setClaimForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  What happened?
                  <textarea
                    required
                    minLength={10}
                    className={textareaClass}
                    value={claimForm.description}
                    onChange={(event) =>
                      setClaimForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Preferred resolution
                  <Input
                    value={claimForm.preferredResolution}
                    onChange={(event) =>
                      setClaimForm((current) => ({
                        ...current,
                        preferredResolution: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Evidence (optional)
                  <Input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    disabled={busy === "upload"}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setBusy("upload");
                      void uploadWarrantyEvidence(file)
                        .then((assetId) => {
                          setEvidenceAssetIds((current) => [
                            ...current,
                            assetId,
                          ]);
                          toast.success("Warranty evidence uploaded.");
                        })
                        .catch((cause: unknown) =>
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Evidence upload failed.",
                          ),
                        )
                        .finally(() => setBusy(null));
                    }}
                  />
                  <span className="font-normal text-[#68717b]">
                    {evidenceAssetIds.length
                      ? `${evidenceAssetIds.length} file ready`
                      : "PDF or image, up to 8 MB."}
                  </span>
                </label>
                <Button type="submit" loading={busy === "submit"}>
                  Submit claim
                </Button>
              </form>
            </Surface>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ClaimCard({
  claim,
  warranty,
  audience,
  busy,
  setError,
  run,
}: {
  claim: WarrantyClaim;
  warranty: WarrantyDetailRecord;
  audience: "client" | "professional";
  busy: string | null;
  setError: (message: string | null) => void;
  run: (
    key: string,
    action: () => Promise<WarrantyDetailRecord>,
    success: string,
  ) => Promise<void>;
}) {
  return (
    <article className="rounded-[20px] border border-black/8 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant={claimStatusVariant(claim.status)}>
            {claim.status.replaceAll("_", " ")}
          </Badge>
          <h3 className="mt-3 font-bold">
            Claim {claim.sequence}: {claim.subject}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#68717b]">
            {claim.description}
          </p>
        </div>
        <span className="text-xs text-[#7a838c]">
          {new Date(claim.submittedAt).toLocaleDateString()}
        </span>
      </div>
      {claim.decisionReason ? (
        <InlineAlert
          className="mt-4"
          variant={claim.status === "REJECTED" ? "warning" : "info"}
          title="Decision record"
          description={claim.decisionReason}
        />
      ) : null}
      {claim.returnVisitStartsAt ? (
        <div className="mt-4 rounded-2xl bg-[#eff9c9] p-4 text-sm">
          <p className="font-semibold">Return visit scheduled</p>
          <p className="mt-1 text-[#536132]">
            {new Date(claim.returnVisitStartsAt).toLocaleString()} –{" "}
            {new Date(claim.returnVisitEndsAt!).toLocaleString()}
          </p>
        </div>
      ) : null}
      {claim.resolutionNotes ? (
        <InlineAlert
          className="mt-4"
          variant="success"
          title="Resolution recorded"
          description={claim.resolutionNotes}
        />
      ) : null}
      {claim.evidence.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {claim.evidence.map((item) => (
            <Button
              key={item.id}
              size="sm"
              variant="outline"
              onClick={() => void openEvidence(item.assetId, setError)}
            >
              <FileCheck2 className="size-4" /> {item.evidenceType} evidence
            </Button>
          ))}
        </div>
      ) : null}
      {audience === "professional" ? (
        <ProfessionalClaimActions
          claim={claim}
          busy={busy}
          run={run}
        />
      ) : (
        <ClientClaimActions claim={claim} warranty={warranty} busy={busy} run={run} />
      )}
      {claim.history.length ? (
        <details className="mt-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <History className="size-4" /> Traceable history
          </summary>
          <div className="mt-3 grid gap-2 border-l border-black/10 pl-4 text-xs text-[#68717b]">
            {claim.history.map((item) => (
              <p key={item.id}>
                {item.action.replaceAll("_", " ")} ·{" "}
                {new Date(item.createdAt).toLocaleString()}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function ProfessionalClaimActions({
  claim,
  busy,
  run,
}: {
  claim: WarrantyClaim;
  busy: string | null;
  run: (
    key: string,
    action: () => Promise<WarrantyDetailRecord>,
    success: string,
  ) => Promise<void>;
}) {
  const action = (
    key: string,
    claimAction: "START_REVIEW" | "ACCEPT" | "REJECT",
    reason?: string,
  ) =>
    run(
      `${key}-${claim.id}`,
      () =>
        professionalClaimAction(claim.id, "action", {
          lockVersion: claim.lockVersion,
          action: claimAction,
          reason,
        }),
      "Warranty claim updated.",
    );
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {claim.status === "SUBMITTED" ? (
        <Button
          size="sm"
          loading={busy === `review-${claim.id}`}
          onClick={() => void action("review", "START_REVIEW")}
        >
          Start review
        </Button>
      ) : null}
      {["SUBMITTED", "UNDER_REVIEW"].includes(claim.status) ? (
        <>
          <Button
            size="sm"
            variant="secondary"
            loading={busy === `accept-${claim.id}`}
            onClick={() => void action("accept", "ACCEPT")}
          >
            Accept claim
          </Button>
          <Button
            size="sm"
            variant="outline"
            loading={busy === `reject-${claim.id}`}
            onClick={() => {
              const reason = window.prompt("Reason for rejection");
              if (reason) void action("reject", "REJECT", reason);
            }}
          >
            Reject with reason
          </Button>
        </>
      ) : null}
      {claim.status === "ACCEPTED" ? (
        <Button
          size="sm"
          loading={busy === `schedule-${claim.id}`}
          onClick={() => {
            const startsAt = new Date(Date.now() + 86_400_000);
            startsAt.setHours(9, 0, 0, 0);
            const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
            void run(
              `schedule-${claim.id}`,
              () =>
                professionalClaimAction(claim.id, "return-visit", {
                  lockVersion: claim.lockVersion,
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  reason: "Warranty follow-up visit.",
                }),
              "Return visit scheduled.",
            );
          }}
        >
          Schedule next-day visit
        </Button>
      ) : null}
      {["ACCEPTED", "RETURN_VISIT_SCHEDULED", "ESCALATED"].includes(
        claim.status,
      ) ? (
        <Button
          size="sm"
          variant="secondary"
          loading={busy === `resolve-${claim.id}`}
          onClick={() => {
            const notes = window.prompt("Resolution notes");
            if (!notes) return;
            void run(
              `resolve-${claim.id}`,
              () =>
                professionalClaimAction(claim.id, "resolve", {
                  lockVersion: claim.lockVersion,
                  resolutionNotes: notes,
                  evidenceAssetIds: [],
                }),
              "Warranty claim resolved.",
            );
          }}
        >
          Record resolution
        </Button>
      ) : null}
    </div>
  );
}

function ClientClaimActions({
  claim,
  warranty,
  busy,
  run,
}: {
  claim: WarrantyClaim;
  warranty: WarrantyDetailRecord;
  busy: string | null;
  run: (
    key: string,
    action: () => Promise<WarrantyDetailRecord>,
    success: string,
  ) => Promise<void>;
}) {
  if (!["SUBMITTED", "UNDER_REVIEW", "REJECTED"].includes(claim.status))
    return null;
  return (
    <Button
      className="mt-4"
      size="sm"
      variant="outline"
      loading={busy === `escalate-${claim.id}`}
      onClick={() => {
        const reason = window.prompt("Why does this claim need escalation?");
        if (!reason) return;
        void run(
          `escalate-${claim.id}`,
          () =>
            escalateWarrantyClaim(warranty.id, claim.id, {
              lockVersion: claim.lockVersion,
              reason,
            }),
          "Warranty claim escalated.",
        );
      }}
    >
      Escalate claim
    </Button>
  );
}

function claimStatusVariant(status: WarrantyClaim["status"]) {
  if (status === "RESOLVED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  if (status === "ESCALATED") return "warning" as const;
  if (status === "RETURN_VISIT_SCHEDULED") return "trust" as const;
  return "info" as const;
}

async function openEvidence(
  assetId: string,
  setError: (message: string | null) => void,
) {
  try {
    const delivery = await warrantyApi<{ url: string }>(
      `/api/v1/storage/assets/${assetId}/delivery`,
    );
    window.open(delivery.url, "_blank", "noopener,noreferrer");
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : "Evidence unavailable.");
  }
}
