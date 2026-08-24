"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type {
  ModerationCase,
  ModerationReport,
  PageResult,
} from "@/modules/administration/types";
import { administrationApi } from "./administration-api";

export function ModerationReportQueue() {
  const [reports, setReports] = useState<PageResult<ModerationReport> | null>(null);
  const [cases, setCases] = useState<PageResult<ModerationCase> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      administrationApi<PageResult<ModerationReport>>(
        "/api/v1/admin/reports?status=OPEN&pageSize=20",
        { signal: controller.signal },
      ),
      administrationApi<PageResult<ModerationCase>>(
        "/api/v1/admin/moderation/cases?status=all&pageSize=20",
        { signal: controller.signal },
      ),
    ])
      .then(([nextReports, nextCases]) => {
        setReports(nextReports);
        setCases(nextCases);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Reports could not be loaded.");
      });
    return () => controller.abort();
  }, [reload]);

  async function openCase(reportId: string) {
    const reason = reasons[reportId]?.trim() ?? "";
    if (reason.length < 10 || busy) return;
    setBusy(reportId);
    try {
      await administrationApi(`/api/v1/admin/reports/${reportId}/cases`, {
        method: "POST",
        body: JSON.stringify({ priority: "NORMAL", reason }),
      });
      toast.success("Moderation case opened.");
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The case could not be opened.");
    } finally {
      setBusy(null);
    }
  }

  if (!reports && !cases && !error) {
    return <StatePanel variant="loading" title="Loading moderation queue" description="Checking open reports and active case history." />;
  }
  if (error && !reports && !cases) {
    return <StatePanel variant="error" title="Moderation queue unavailable" description={error} actionLabel="Try again" onAction={() => setReload((value) => value + 1)} />;
  }

  return (
    <div className="space-y-5">
      {error ? <InlineAlert title="Some moderation data is unavailable" description={error} /> : null}
      <Surface className="p-5 shadow-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Open reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">Oldest reports are reviewed first. Opening a case creates immutable history.</p>
          </div>
          <Badge variant="warning">{reports?.totalItems ?? 0} open</Badge>
        </div>
        {reports?.items.length ? (
          <ul className="mt-5 space-y-4">
            {reports.items.map((report) => (
              <li key={report.id} className="rounded-2xl border border-black/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge>{label(report.category)}</Badge>
                    <h3 className="mt-2 font-semibold">{report.summary}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{report.details}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{label(report.subjectType)} · {new Date(report.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Label htmlFor={`reason-${report.id}`}>Reason for opening case</Label>
                    <Input id={`reason-${report.id}`} value={reasons[report.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Record why this report requires investigation" />
                  </div>
                  <Button className="self-end" disabled={(reasons[report.id]?.trim().length ?? 0) < 10 || busy === report.id} onClick={() => void openCase(report.id)}>
                    {busy === report.id ? "Opening…" : "Open case"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <StatePanel className="mt-5" title="Empty report queue" description="There are no open reports requiring a case." />
        )}
      </Surface>

      <Surface className="p-5 shadow-none">
        <h2 className="text-lg font-semibold">Case history</h2>
        {cases?.items.length ? (
          <ul className="mt-4 divide-y divide-black/8">
            {cases.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-semibold">{label(item.caseType)}</p>
                  <p className="text-sm text-muted-foreground">{label(item.subjectType)} · opened {new Date(item.openedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.status === "RESOLVED" ? "success" : item.status === "DISMISSED" ? "neutral" : "warning"}>{label(item.status)}</Badge>
                  <Button asChild size="sm" variant="outline"><Link href={`/admin/reports/${item.id}`}>Inspect</Link></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <StatePanel className="mt-5" title="No case history" description="Cases appear here after an administrator opens a report." />
        )}
      </Surface>
    </div>
  );
}

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
