"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { ModerationCaseDetail } from "@/modules/administration/types";
import { administrationApi } from "./administration-api";

const actions = [
  ["START_INVESTIGATION", "Start investigation"],
  ["AWAIT_DECISION", "Await decision"],
  ["RESOLVE_NO_ACTION", "Resolve with no action"],
  ["HIDE_REVIEW", "Hide review"],
  ["SUSPEND_ACCOUNT", "Suspend account"],
  ["RESTORE_ACCOUNT", "Restore account"],
  ["DISMISS", "Dismiss case"],
] as const;

export function ModerationCaseDetailView({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<ModerationCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void administrationApi<ModerationCaseDetail>(
      `/api/v1/admin/moderation/cases/${caseId}`,
      { signal: controller.signal },
    )
      .then(setDetail)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "The case could not be loaded.");
      });
    return () => controller.abort();
  }, [caseId, reload]);

  async function transition(action: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await administrationApi(`/api/v1/admin/moderation/cases/${caseId}/transition`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: reason.trim(),
          ...(evidenceSummary.trim() ? { evidenceSummary: evidenceSummary.trim() } : {}),
        }),
      });
      toast.success("Case decision recorded.");
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The decision could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  if (!detail && !error) return <StatePanel variant="loading" title="Loading case evidence" description="Retrieving the case, linked evidence, and immutable decision history." />;
  if (!detail) return <StatePanel variant="error" title="Case unavailable" description={error ?? "The case was not found."} actionLabel="Try again" onAction={() => setReload((value) => value + 1)} />;
  const closed = ["RESOLVED", "DISMISSED"].includes(detail.case.status);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <div className="space-y-5">
        {error ? <InlineAlert title="Decision not recorded" description={error} /> : null}
        <Surface className="p-5 shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-muted-foreground">Case {caseId.slice(0, 8)}</p><h2 className="mt-1 text-xl font-semibold">{label(detail.case.caseType)}</h2></div>
            <Badge variant={closed ? "success" : "warning"}>{label(detail.case.status)}</Badge>
          </div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-muted-foreground">Linked record</dt><dd className="mt-1 text-sm font-semibold">{label(detail.case.subjectType)} · {detail.case.subjectId}</dd></div>
            <div><dt className="text-xs font-semibold text-muted-foreground">Priority</dt><dd className="mt-1 text-sm font-semibold">{label(detail.case.priority)}</dd></div>
            {detail.case.decisionReason ? <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Decision reason</dt><dd className="mt-1 text-sm">{detail.case.decisionReason}</dd></div> : null}
            {detail.case.evidenceSummary ? <div className="sm:col-span-2"><dt className="text-xs font-semibold text-muted-foreground">Evidence considered</dt><dd className="mt-1 text-sm">{detail.case.evidenceSummary}</dd></div> : null}
          </dl>
        </Surface>
        <Surface className="p-5 shadow-none">
          <h2 className="font-semibold">Case history</h2>
          <ol className="mt-4 space-y-4">
            {detail.history.map((item) => (
              <li key={item.id} className="border-l-2 border-primary/40 pl-4">
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{label(item.action)}</p><Badge>{label(item.toStatus)}</Badge></div>
                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
                <time className="mt-1 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        </Surface>
      </div>
      <div className="space-y-5">
        <Surface className="p-5 shadow-none">
          <h2 className="font-semibold">Private evidence</h2>
          {detail.evidence.length ? <ul className="mt-3 space-y-2">{detail.evidence.map((item) => <li key={item.assetId} className="rounded-xl bg-muted px-3 py-2 text-sm">{item.purpose} · {item.mimeType}</li>)}</ul> : <StatePanel className="mt-4" title="No linked files" description="Record the evidence reviewed in the decision summary. Private assets remain purpose-limited." />}
        </Surface>
        {!closed ? (
          <Surface className="p-5 shadow-none">
            <h2 className="font-semibold">Record decision</h2>
            <div className="mt-4 space-y-4">
              <div><Label htmlFor="case-reason">Reason</Label><textarea id="case-reason" className="mt-1 min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
              <div><Label htmlFor="case-evidence">Evidence summary</Label><textarea id="case-evidence" className="mt-1 min-h-24 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm" value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} /></div>
              <div className="grid gap-2">
                {actions.map(([action, actionLabel]) => (
                  <ConfirmDialog key={action} title={actionLabel} description="This action is reasoned, audited, and cannot silently alter transaction history." confirmLabel={actionLabel} tone={action.includes("SUSPEND") || action === "HIDE_REVIEW" ? "danger" : "default"} onConfirm={() => void transition(action)} trigger={<Button variant={action.includes("SUSPEND") || action === "HIDE_REVIEW" ? "danger" : "outline"} disabled={busy || reason.trim().length < 10}>{actionLabel}</Button>} />
                ))}
              </div>
            </div>
          </Surface>
        ) : null}
      </div>
    </div>
  );
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
