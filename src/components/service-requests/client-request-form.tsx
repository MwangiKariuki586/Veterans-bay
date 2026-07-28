"use client";

import { ArrowLeft, CheckCircle2, FileUp, Save, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EngagementConversation } from "@/components/conversations/engagement-conversation";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type {
  ClientServiceRequest,
  ServiceRequestContactPreference,
  ServiceRequestUrgency,
} from "@/modules/service-requests/types";
import {
  getClientRequest,
  getRequestOptions,
  requestApi,
  RequestApiError,
  uploadRequestAttachment,
} from "./request-api";

type FormState = {
  category: string;
  description: string;
  location: string;
  preferredTime: string;
  budgetMin: string;
  budgetMax: string;
  urgency: ServiceRequestUrgency | "";
  contactPreference: ServiceRequestContactPreference | "";
};

const emptyForm: FormState = {
  category: "",
  description: "",
  location: "",
  preferredTime: "",
  budgetMin: "",
  budgetMax: "",
  urgency: "",
  contactPreference: "",
};

export function ClientRequestForm({
  requestId,
  initial,
}: {
  requestId?: string;
  initial?: {
    source:
      | "MARKETPLACE_DISCOVERY"
      | "PROFESSIONAL_BOOKING_LINK"
      | "REPEAT_CLIENT"
      | "DIRECT_SERVICE_PAGE";
    category?: string;
    preferredProfessionalSlug?: string;
    preferredServiceSlug?: string;
  };
}) {
  const router = useRouter();
  const [request, setRequest] = useState<ClientServiceRequest | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    category: initial?.category ?? "",
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(requestId));
  const [busy, setBusy] = useState<"save" | "submit" | "upload" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [informationNote, setInformationNote] = useState("");
  const isDraft = !request || request.status === "DRAFT";
  const canAttach =
    request?.status === "DRAFT" ||
    request?.status === "SUBMITTED" ||
    request?.status === "MORE_INFORMATION_REQUIRED";
  const canCancel =
    request &&
    [
      "DRAFT",
      "SUBMITTED",
      "UNDER_REVIEW",
      "MORE_INFORMATION_REQUIRED",
      "ASSESSMENT_REQUIRED",
    ].includes(request.status);

  useEffect(() => {
    void getRequestOptions()
      .then((data) => setCategories(data.categories))
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Service categories could not be loaded.",
        ),
      );
    if (!requestId) return;
    void getClientRequest(requestId)
      .then((data) => {
        setRequest(data);
        setForm(toForm(data));
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Request unavailable."),
      )
      .finally(() => setLoading(false));
  }, [requestId]);

  const budgetSummary = useMemo(() => {
    if (!form.budgetMin && !form.budgetMax) return "No budget added";
    const min = form.budgetMin ? `KSh ${Number(form.budgetMin).toLocaleString()}` : "Any";
    const max = form.budgetMax ? `KSh ${Number(form.budgetMax).toLocaleString()}` : "open";
    return `${min} – ${max}`;
  }, [form.budgetMax, form.budgetMin]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setInvalid((current) => current.filter((item) => item !== key));
  }

  async function saveDraft() {
    setBusy("save");
    setError(null);
    setInvalid([]);
    try {
      const payload = toPayload(form);
      const saved = request
        ? await requestApi<ClientServiceRequest>(
            `/api/v1/client/requests/${request.id}`,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ version: request.version, ...payload }),
            },
          )
        : await requestApi<ClientServiceRequest>("/api/v1/client/requests", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              idempotencyKey: crypto.randomUUID(),
              source: initial?.source ?? "MARKETPLACE_DISCOVERY",
              preferredProfessionalSlug:
                initial?.preferredProfessionalSlug ?? null,
              preferredServiceSlug: initial?.preferredServiceSlug ?? null,
              ...payload,
            }),
          });
      setRequest(saved);
      setForm(toForm(saved));
      if (!request) router.replace(`/client/requests/${saved.id}`);
      return saved;
    } catch (cause) {
      handleError(cause);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy("submit");
    setError(null);
    setInvalid([]);
    try {
      let current = request;
      if (!current) {
        const payload = toPayload(form);
        current = await requestApi<ClientServiceRequest>("/api/v1/client/requests", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: crypto.randomUUID(),
            source: initial?.source ?? "MARKETPLACE_DISCOVERY",
            preferredProfessionalSlug:
              initial?.preferredProfessionalSlug ?? null,
            preferredServiceSlug: initial?.preferredServiceSlug ?? null,
            ...payload,
          }),
        });
      } else {
        current = await requestApi<ClientServiceRequest>(
          `/api/v1/client/requests/${current.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ version: current.version, ...toPayload(form) }),
          },
        );
      }
      const submitted = await requestApi<ClientServiceRequest>(
        `/api/v1/client/requests/${current.id}/submit`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: current.version }),
        },
      );
      setRequest(submitted);
      setForm(toForm(submitted));
      router.replace(`/client/requests/${submitted.id}`);
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    if (!request) {
      setError("Save the draft before adding attachments.");
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const assetId = await uploadRequestAttachment(file);
      const updated = await requestApi<ClientServiceRequest>(
        `/api/v1/client/requests/${request.id}/attachments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId }),
        },
      );
      setRequest(updated);
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(null);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (!request) return;
    setError(null);
    try {
      setRequest(
        await requestApi<ClientServiceRequest>(
          `/api/v1/client/requests/${request.id}/attachments/${attachmentId}`,
          { method: "DELETE" },
        ),
      );
    } catch (cause) {
      handleError(cause);
    }
  }

  async function cancelRequest() {
    if (!request) return;
    setBusy("submit");
    setError(null);
    try {
      setRequest(
        await requestApi<ClientServiceRequest>(
          `/api/v1/client/requests/${request.id}/cancel`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ version: request.version }),
          },
        ),
      );
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(null);
    }
  }

  async function sendInformation() {
    if (!request) return;
    setBusy("submit");
    setError(null);
    try {
      const updated = await requestApi<ClientServiceRequest>(
        `/api/v1/client/requests/${request.id}/information`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: request.version,
            note: informationNote,
          }),
        },
      );
      setRequest(updated);
      setInformationNote("");
    } catch (cause) {
      handleError(cause);
    } finally {
      setBusy(null);
    }
  }

  function handleError(cause: unknown) {
    if (cause instanceof RequestApiError) {
      setError(cause.message);
      setInvalid(cause.issues.map((item) => item.path));
    } else {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    }
  }

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="Loading request"
        description="Retrieving the latest saved details."
      />
    );
  }

  return (
    <div>
      <Link
        href="/client/requests"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b] hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to requests
      </Link>
      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#5f8d11]">
              {request ? "Service request" : "New service request"}
            </p>
            {request ? <Badge variant="neutral">{request.status.replaceAll("_", " ")}</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
            {isDraft ? "Tell us what you need" : request?.category}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            {isDraft
              ? "Add enough detail for a professional to understand the work. You can save and return at any time."
              : "Your requirements are submitted. Future updates will appear in the request history."}
          </p>
        </div>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Request needs attention"
          description={error}
        />
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Surface className="p-5 shadow-none sm:p-7">
          <fieldset disabled={!isDraft || busy !== null} className="space-y-6">
            <div>
              <Label htmlFor="request-category">Service category *</Label>
              <select
                id="request-category"
                value={form.category}
                onChange={(event) => update("category", event.target.value)}
                aria-invalid={invalid.includes("category")}
                className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#5f8d11]"
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="request-description">Describe the work *</Label>
              <textarea
                id="request-description"
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                aria-invalid={invalid.includes("description")}
                rows={6}
                maxLength={5_000}
                placeholder="What needs repair or maintenance? Include the current condition, dimensions, or access details where useful."
                className="mt-2 w-full rounded-2xl border border-black/10 bg-white p-3 text-sm leading-6 outline-none focus:border-[#5f8d11]"
              />
              <p className="mt-1 text-right text-xs text-[#7a838c]">
                {form.description.length}/5,000
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Location *" id="request-location" invalid={invalid.includes("location")}>
                <Input
                  id="request-location"
                  value={form.location}
                  onChange={(event) => update("location", event.target.value)}
                  placeholder="Estate, neighbourhood, or address"
                />
              </Field>
              <Field label="Preferred time *" id="request-time" invalid={invalid.includes("preferredTime")}>
                <Input
                  id="request-time"
                  value={form.preferredTime}
                  onChange={(event) => update("preferredTime", event.target.value)}
                  placeholder="e.g. Weekday mornings"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Minimum budget (KSh)" id="budget-min">
                <Input
                  id="budget-min"
                  inputMode="numeric"
                  value={form.budgetMin}
                  onChange={(event) => update("budgetMin", event.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Maximum budget (KSh)" id="budget-max">
                <Input
                  id="budget-max"
                  inputMode="numeric"
                  value={form.budgetMax}
                  onChange={(event) => update("budgetMax", event.target.value)}
                  placeholder="Optional"
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="request-urgency">Urgency *</Label>
                <select
                  id="request-urgency"
                  value={form.urgency}
                  onChange={(event) =>
                    update("urgency", event.target.value as FormState["urgency"])
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                >
                  <option value="">Choose urgency</option>
                  <option value="FLEXIBLE">Flexible</option>
                  <option value="SOON">Soon</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <Label htmlFor="contact-preference">Contact preference *</Label>
                <select
                  id="contact-preference"
                  value={form.contactPreference}
                  onChange={(event) =>
                    update(
                      "contactPreference",
                      event.target.value as FormState["contactPreference"],
                    )
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm"
                >
                  <option value="">Choose preference</option>
                  <option value="IN_APP">In-app message</option>
                  <option value="PHONE">Phone</option>
                  <option value="EMAIL">Email</option>
                </select>
              </div>
            </div>
          </fieldset>

          <div className="mt-7 border-t border-black/8 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Supporting attachments</h2>
                <p className="mt-1 text-xs text-[#68717b]">
                  PDF, JPG, PNG, or WebP up to 8 MB.
                </p>
              </div>
              {canAttach ? (
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-black/10 px-4 text-sm font-semibold">
                  <FileUp className="size-4" />
                  {busy === "upload" ? "Uploading…" : "Add file"}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={!request || busy !== null}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file);
                    }}
                  />
                </label>
              ) : null}
            </div>
            {request?.attachments.length ? (
              <ul className="mt-4 space-y-2">
                {request.attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f9fa] px-4 py-3 text-sm"
                  >
                    <span>
                      {attachment.mimeType} ·{" "}
                      {(attachment.sizeBytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {isDraft ? (
                      <button
                        type="button"
                        onClick={() => void removeAttachment(attachment.id)}
                        className="text-danger"
                        aria-label="Remove attachment"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-[#7a838c]">No attachments added.</p>
            )}
          </div>

          {isDraft ? (
            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-black/8 pt-6">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={busy !== null}
                onClick={() => void saveDraft()}
              >
                <Save className="size-4" />
                {busy === "save" ? "Saving…" : "Save draft"}
              </Button>
              <Button
                className="rounded-full"
                disabled={busy !== null}
                onClick={() => void submit()}
              >
                <Send className="size-4" />
                {busy === "submit" ? "Submitting…" : "Submit request"}
              </Button>
            </div>
          ) : null}
          {request?.status === "MORE_INFORMATION_REQUIRED" ? (
            <div className="mt-7 border-t border-black/8 pt-6">
              <Label htmlFor="supporting-information">
                Supporting information *
              </Label>
              <textarea
                id="supporting-information"
                value={informationNote}
                onChange={(event) => setInformationNote(event.target.value)}
                rows={4}
                placeholder="Answer the professional's question and mention any newly added attachment."
                className="mt-2 w-full rounded-2xl border border-black/10 p-3 text-sm leading-6"
              />
              <div className="mt-3 flex justify-end">
                <Button
                  className="rounded-full"
                  disabled={busy !== null || informationNote.trim().length < 5}
                  onClick={() => void sendInformation()}
                >
                  <Send className="size-4" />
                  Send information
                </Button>
              </div>
            </div>
          ) : null}
          {!isDraft && canCancel ? (
            <div className="mt-7 flex justify-end border-t border-black/8 pt-6">
              <Button
                variant="outline"
                className="rounded-full border-danger/30 text-danger hover:bg-danger-soft"
                disabled={busy !== null}
                onClick={() => void cancelRequest()}
              >
                Cancel request
              </Button>
            </div>
          ) : null}
        </Surface>

        <aside className="space-y-4">
          <Surface className="bg-[#eef8c8] p-5 shadow-none">
            <CheckCircle2 className="size-5 text-[#5f8d11]" />
            <h2 className="mt-3 font-bold">Request summary</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Summary label="Category" value={form.category || "Not added"} />
              <Summary label="Location" value={form.location || "Not added"} />
              <Summary label="Budget" value={budgetSummary} />
              <Summary
                label="Urgency"
                value={form.urgency ? form.urgency.toLowerCase() : "Not added"}
              />
            </dl>
          </Surface>
          {request?.history.length ? (
            <Surface className="p-5 shadow-none">
              <h2 className="font-bold">Request history</h2>
              <ol className="mt-4 space-y-4">
                {request.history.map((item) => (
                  <li key={item.id} className="border-l-2 border-[#b9eb35] pl-3">
                    <p className="text-sm font-semibold">
                      {item.action.replaceAll("_", " ").toLowerCase()}
                    </p>
                    <p className="mt-1 text-xs text-[#7a838c]">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            </Surface>
          ) : null}
        </aside>
      </div>
      {request &&
      request.status !== "DRAFT" &&
      request.preferredProfessionalName ? (
        <div className="mt-5">
          <EngagementConversation requestId={request.id} audience="client" />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  id,
  invalid,
  children,
}: {
  label: string;
  id: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2" aria-invalid={invalid}>
        {children}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[#607044]">{label}</dt>
      <dd className="text-right font-semibold capitalize">{value}</dd>
    </div>
  );
}

function toPayload(form: FormState) {
  return {
    category: form.category || null,
    description: form.description || null,
    location: form.location || null,
    preferredTime: form.preferredTime || null,
    budgetMinMinor: form.budgetMin ? Math.round(Number(form.budgetMin) * 100) : null,
    budgetMaxMinor: form.budgetMax ? Math.round(Number(form.budgetMax) * 100) : null,
    urgency: form.urgency || null,
    contactPreference: form.contactPreference || null,
  };
}

function toForm(request: ClientServiceRequest): FormState {
  return {
    category: request.category ?? "",
    description: request.description ?? "",
    location: request.location ?? "",
    preferredTime: request.preferredTime ?? "",
    budgetMin:
      request.budgetMinMinor == null ? "" : String(request.budgetMinMinor / 100),
    budgetMax:
      request.budgetMaxMinor == null ? "" : String(request.budgetMaxMinor / 100),
    urgency: request.urgency ?? "",
    contactPreference: request.contactPreference ?? "",
  };
}
