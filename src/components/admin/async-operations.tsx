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
import { administrationApi } from "./administration-api";

interface Diagnostics {
  summary: Record<string, number>;
  consumers: Array<{
    consumerName: string;
    attempts: number;
    duplicates: number;
    retries: number;
    dead_letters: number;
    average_duration_ms: number;
  }>;
  failures: Array<{
    id: string;
    consumerName: string;
    eventType: string;
    outcome: string;
    createdAt: string;
  }>;
  deadLetters: Array<{
    id: string;
    eventId: string;
    consumerName: string;
    eventType: string;
    failureCategory: string;
    attemptCount: number;
    resolutionState: string;
    createdAt: string;
  }>;
  generatedAt: string;
}

export function AsyncOperations() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void administrationApi<Diagnostics>("/api/v1/admin/operations/async", {
      signal: controller.signal,
    })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Async diagnostics could not be loaded.");
      });
    return () => controller.abort();
  }, [reload]);

  async function resolve(deadLetterId: string, action: "retry" | "discard") {
    setBusy(deadLetterId);
    try {
      await administrationApi(
        `/api/v1/admin/operations/dead-letters/${deadLetterId}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reasons[deadLetterId]?.trim() }),
        },
      );
      toast.success(
        action === "retry"
          ? "Manual retry queued with the original event ID."
          : "Dead letter discarded with an audit record.",
      );
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operation could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return <StatePanel variant="loading" title="Loading async diagnostics" description="Checking backlog, attempts, duration, duplicates, failures, and dead letters." />;
  if (!data) return <StatePanel variant="error" title="Diagnostics unavailable" description={error ?? "Async diagnostics could not be loaded."} actionLabel="Try again" onAction={() => setReload((value) => value + 1)} />;

  const summary = [
    ["Backlog", data.summary.backlog ?? 0],
    ["Claimed", data.summary.claimed ?? 0],
    ["Retrying", data.summary.retrying ?? 0],
    ["Oldest backlog", `${data.summary.oldest_backlog_seconds ?? 0}s`],
    ["Publish duration", `${data.summary.average_publish_duration_ms ?? 0}ms`],
  ] as const;

  return (
    <div className="space-y-5">
      {error ? <InlineAlert title="Operation not completed" description={error} /> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summary.map(([label, value]) => (
          <Surface key={label} className="p-4 shadow-none">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </Surface>
        ))}
      </div>
      <Surface className="overflow-hidden p-0 shadow-none">
        <div className="px-5 py-4"><h2 className="font-semibold">Consumers · last 24 hours</h2></div>
        {data.consumers.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted text-xs"><tr><th className="px-4 py-3">Consumer</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Duplicates</th><th className="px-4 py-3">Retries</th><th className="px-4 py-3">Dead letters</th><th className="px-4 py-3">Average duration</th></tr></thead><tbody>{data.consumers.map((item) => <tr key={item.consumerName} className="border-t border-black/8"><td className="px-4 py-3 font-semibold">{item.consumerName}</td><td className="px-4 py-3">{item.attempts}</td><td className="px-4 py-3">{item.duplicates}</td><td className="px-4 py-3">{item.retries}</td><td className="px-4 py-3">{item.dead_letters}</td><td className="px-4 py-3">{item.average_duration_ms}ms</td></tr>)}</tbody></table></div>
        ) : <StatePanel className="m-5" title="No recent consumer activity" description="Consumer attempts will appear after domain events are delivered." />}
      </Surface>
      <Surface className="p-5 shadow-none">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Dead-letter operations</h2><Badge variant={data.deadLetters.some((item) => item.resolutionState === "open") ? "danger" : "success"}>{data.deadLetters.filter((item) => item.resolutionState === "open").length} open</Badge></div>
        {data.deadLetters.length ? <ul className="mt-4 space-y-4">{data.deadLetters.map((item) => {
          const open = item.resolutionState === "open";
          return <li key={item.id} className="rounded-2xl border border-black/8 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{item.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{item.consumerName} · {item.failureCategory} · {item.attemptCount} attempts</p></div><Badge variant={open ? "danger" : "neutral"}>{item.resolutionState}</Badge></div>{open ? <div className="mt-4"><Label htmlFor={`dead-letter-${item.id}`}>Resolution reason</Label><textarea id={`dead-letter-${item.id}`} className="mt-1 min-h-20 w-full rounded-xl border border-input px-3 py-2 text-sm" value={reasons[item.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><div className="mt-3 flex gap-2"><ConfirmDialog title="Retry original event" description="The original event ID and payload will be requeued and the action audited." confirmLabel="Queue retry" onConfirm={() => void resolve(item.id, "retry")} trigger={<Button variant="outline" disabled={busy === item.id || (reasons[item.id]?.trim().length ?? 0) < 10}>Retry</Button>} /><ConfirmDialog title="Discard dead letter" description="Discarding closes this operational failure without changing the authoritative business record." confirmLabel="Discard" tone="danger" onConfirm={() => void resolve(item.id, "discard")} trigger={<Button variant="danger" disabled={busy === item.id || (reasons[item.id]?.trim().length ?? 0) < 10}>Discard</Button>} /></div></div> : null}</li>;
        })}</ul> : <StatePanel className="mt-4" title="No dead letters" description="No consumer events are awaiting manual recovery." />}
      </Surface>
    </div>
  );
}
