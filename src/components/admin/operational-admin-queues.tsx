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
import type {
  AdminDispute,
  AuditEvent,
  EscalatedWarranty,
  PageResult,
  PlatformRule,
} from "@/modules/administration/types";
import { administrationApi } from "./administration-api";

export function DisputeQueue() {
  return (
    <DecisionQueue<AdminDispute>
      path="/api/v1/admin/disputes?status=all&pageSize=30"
      emptyTitle="No active disputes"
      emptyDescription="Payment and service disagreements will appear here without changing their financial history."
      title={(item) => `Job ${item.jobId.slice(0, 8)}`}
      description={(item) => item.reason}
      status={(item) => item.status}
      actions={[
        ["START_INVESTIGATION", "Start investigation"],
        ["AWAIT_DECISION", "Await decision"],
        ["RESOLVE", "Resolve"],
        ["DISMISS", "Dismiss"],
      ]}
      actionPath={(item) => `/api/v1/admin/disputes/${item.id}/transition`}
    />
  );
}

export function EscalatedWarrantyQueue() {
  return (
    <DecisionQueue<EscalatedWarranty>
      path="/api/v1/admin/warranties/escalated?pageSize=30"
      emptyTitle="No escalated warranties"
      emptyDescription="Escalated warranty claims requiring platform intervention will appear here."
      title={(item) => item.serviceName}
      description={(item) => `${item.subject} — ${item.description}`}
      status={(item) => item.status}
      actions={[
        ["RESOLVE", "Resolve claim"],
        ["REJECT", "Reject claim"],
      ]}
      actionPath={(item) =>
        `/api/v1/admin/warranties/escalated/${item.id}/decision`
      }
    />
  );
}

function DecisionQueue<T extends { id: string }>({
  actionPath,
  actions,
  description,
  emptyDescription,
  emptyTitle,
  path,
  status,
  title,
}: {
  path: string;
  emptyTitle: string;
  emptyDescription: string;
  title: (item: T) => string;
  description: (item: T) => string;
  status: (item: T) => string;
  actions: ReadonlyArray<readonly [string, string]>;
  actionPath: (item: T) => string;
}) {
  const [data, setData] = useState<PageResult<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void administrationApi<PageResult<T>>(path, { signal: controller.signal })
      .then(setData)
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "The queue could not be loaded.");
      });
    return () => controller.abort();
  }, [path, reload]);

  async function decide(item: T, action: string) {
    setBusy(item.id);
    try {
      await administrationApi(actionPath(item), {
        method: "POST",
        body: JSON.stringify({
          action,
          reason: reason[item.id]?.trim(),
          ...(evidence[item.id]?.trim()
            ? { evidenceSummary: evidence[item.id].trim() }
            : {}),
        }),
      });
      toast.success("Decision recorded.");
      setReload((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The decision could not be recorded.");
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return <StatePanel variant="loading" title="Loading operational queue" description="Retrieving scoped records and decision history." />;
  if (!data) return <StatePanel variant="error" title="Queue unavailable" description={error ?? "The queue could not be loaded."} actionLabel="Try again" onAction={() => setReload((value) => value + 1)} />;
  if (data.items.length === 0) return <StatePanel title={emptyTitle} description={emptyDescription} />;

  return (
    <div className="space-y-4">
      {error ? <InlineAlert title="Action not completed" description={error} /> : null}
      {data.items.map((item) => {
        const closed = ["RESOLVED", "DISMISSED", "REJECTED"].includes(status(item));
        return (
          <Surface key={item.id} className="p-5 shadow-none">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold">{title(item)}</h2><p className="mt-1 text-sm text-muted-foreground">{description(item)}</p></div>
              <Badge variant={closed ? "success" : "warning"}>{status(item).replaceAll("_", " ")}</Badge>
            </div>
            {!closed ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div><Label htmlFor={`reason-${item.id}`}>Decision reason</Label><textarea id={`reason-${item.id}`} className="mt-1 min-h-24 w-full rounded-xl border border-input px-3 py-2 text-sm" value={reason[item.id] ?? ""} onChange={(event) => setReason((current) => ({ ...current, [item.id]: event.target.value }))} /></div>
                <div><Label htmlFor={`evidence-${item.id}`}>Evidence considered</Label><textarea id={`evidence-${item.id}`} className="mt-1 min-h-24 w-full rounded-xl border border-input px-3 py-2 text-sm" value={evidence[item.id] ?? ""} onChange={(event) => setEvidence((current) => ({ ...current, [item.id]: event.target.value }))} /></div>
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  {actions.map(([action, actionLabel]) => (
                    <ConfirmDialog key={action} title={actionLabel} description="The decision and evidence summary will be retained in the audit trail." confirmLabel={actionLabel} tone={action === "REJECT" ? "danger" : "default"} onConfirm={() => void decide(item, action)} trigger={<Button variant="outline" disabled={busy === item.id || (reason[item.id]?.trim().length ?? 0) < 10}>{actionLabel}</Button>} />
                  ))}
                </div>
              </div>
            ) : null}
          </Surface>
        );
      })}
    </div>
  );
}

export function AuditLog() {
  const [data, setData] = useState<PageResult<AuditEvent> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void administrationApi<PageResult<AuditEvent>>("/api/v1/admin/audit?pageSize=50")
      .then(setData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Audit history could not be loaded."));
  }, []);
  if (!data && !error) return <StatePanel variant="loading" title="Loading audit history" description="Retrieving the latest high-risk platform actions." />;
  if (!data) return <StatePanel variant="error" title="Audit history unavailable" description={error ?? "Audit history could not be loaded."} />;
  if (!data.items.length) return <StatePanel title="No audit history" description="Audited administrative and commercial decisions will appear here." />;
  return (
    <Surface className="overflow-hidden p-0 shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Latest platform audit events</caption>
          <thead className="bg-muted text-xs"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Correlation</th></tr></thead>
          <tbody>{data.items.map((item) => <tr key={item.id} className="border-t border-black/8"><td className="px-4 py-3 font-semibold">{item.action}</td><td className="px-4 py-3">{item.entityType} · {item.entityId.slice(0, 8)}</td><td className="px-4 py-3">{item.actorAccountId?.slice(0, 8) ?? "System"}</td><td className="px-4 py-3">{new Date(item.createdAt).toLocaleString()}</td><td className="px-4 py-3 font-mono text-xs">{item.correlationId ?? "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </Surface>
  );
}

export function PlatformRulesManager() {
  const [rules, setRules] = useState<PlatformRule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("{}");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => administrationApi<PlatformRule[]>("/api/v1/admin/rules").then(setRules).catch((cause) => setError(cause instanceof Error ? cause.message : "Rules could not be loaded."));
  useEffect(() => { void load(); }, []);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await administrationApi(`/api/v1/admin/rules/${key}`, { method: "PUT", body: JSON.stringify({ name, description, value: JSON.parse(value) as unknown, status: "ACTIVE", reason }) });
      toast.success("Platform rule saved.");
      setKey(""); setName(""); setDescription(""); setValue("{}"); setReason("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The rule could not be saved.");
    } finally { setBusy(false); }
  }
  if (!rules && !error) return <StatePanel variant="loading" title="Loading platform rules" description="Retrieving active operational configuration." />;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Surface className="p-5 shadow-none">
        <h2 className="font-semibold">Configured rules</h2>
        {rules?.length ? <ul className="mt-4 space-y-3">{rules.map((rule) => <li key={rule.id} className="rounded-2xl border border-black/8 p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{rule.name}</p><Badge variant={rule.status === "ACTIVE" ? "success" : "neutral"}>{rule.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{rule.description}</p><code className="mt-2 block rounded-lg bg-muted p-2 text-xs">{JSON.stringify(rule.value)}</code></li>)}</ul> : <StatePanel className="mt-4" title="No platform rules" description="Add the first explicitly versioned operational rule." />}
      </Surface>
      <Surface className="p-5 shadow-none">
        <h2 className="font-semibold">Add or update rule</h2>
        {error ? <InlineAlert className="mt-4" title="Rule not saved" description={error} /> : null}
        <div className="mt-4 space-y-3">
          <Field label="Stable key" value={key} onChange={setKey} placeholder="moderation.review_window_days" />
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Description" value={description} onChange={setDescription} multiline />
          <Field label="JSON value" value={value} onChange={setValue} multiline />
          <Field label="Reason for change" value={reason} onChange={setReason} multiline />
          <Button disabled={busy || key.length < 3 || name.length < 3 || description.length < 10 || reason.length < 10} onClick={() => void save()}>{busy ? "Saving…" : "Save rule"}</Button>
        </div>
      </Surface>
    </div>
  );
}

function Field({ label, multiline, onChange, placeholder, value }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; placeholder?: string }) {
  const fieldId = label.toLowerCase().replaceAll(" ", "-");
  return <div><Label htmlFor={fieldId}>{label}</Label>{multiline ? <textarea id={fieldId} className="mt-1 min-h-20 w-full rounded-xl border border-input px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input id={fieldId} className="mt-1 h-10 w-full rounded-xl border border-input px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />}</div>;
}
