"use client";

import { ArrowLeft, FileText, LockKeyhole, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { EngagementConversation } from "@/components/conversations/engagement-conversation";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { ProfessionalServiceRequest } from "@/modules/service-requests/types";
import { requestApi } from "./request-api";

type Action =
  | "review"
  | "request-information"
  | "request-assessment"
  | "decline";

export function ProfessionalEnquiryDetail({
  requestId,
}: {
  requestId: string;
}) {
  const [request, setRequest] = useState<ProfessionalServiceRequest | null>(null);
  const [note, setNote] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestApi<ProfessionalServiceRequest>(
      `/api/v1/professional/enquiries/${requestId}`,
    )
      .then(setRequest)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Enquiry unavailable."),
      );
  }, [requestId]);

  async function runAction(action: Action) {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      setRequest(
        await requestApi<ProfessionalServiceRequest>(
          `/api/v1/professional/enquiries/${request.id}/${action}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              version: request.version,
              ...(note.trim() ? { note: note.trim() } : {}),
            }),
          },
        ),
      );
      setNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function savePrivateNote() {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      setRequest(
        await requestApi<ProfessionalServiceRequest>(
          `/api/v1/professional/enquiries/${request.id}/private-notes`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ note: privateNote }),
          },
        ),
      );
      setPrivateNote("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Note could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  if (!request && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading enquiry"
        description="Retrieving the client requirements and activity."
      />
    );
  }

  return (
    <div>
      <Link
        href="/professional/enquiries"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" /> Back to enquiries
      </Link>
      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Enquiry needs attention"
          description={error}
        />
      ) : null}
      {request ? (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#5f8d11]">Service enquiry</p>
                <Badge variant="neutral">{request.status.replaceAll("_", " ")}</Badge>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
                {request.category}
              </h1>
              <p className="mt-2 text-sm text-[#68717b]">
                {request.client.displayName} · {request.location}
              </p>
            </div>
            {request.conversionEligible ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="trust">Eligible for quotation</Badge>
                <Button asChild>
                  <Link
                    href={`/professional/quotations/new?requestId=${encodeURIComponent(request.id)}`}
                  >
                    <FileText className="size-4" /> Prepare quotation
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <Surface className="p-6 shadow-none">
                <h2 className="font-bold">Client requirements</h2>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#4f5963]">
                  {request.description}
                </p>
                <dl className="mt-5 grid gap-4 border-t border-black/8 pt-5 text-sm sm:grid-cols-2">
                  <Detail label="Preferred time" value={request.preferredTime} />
                  <Detail label="Urgency" value={request.urgency} />
                  <Detail
                    label="Budget"
                    value={
                      request.budgetMinMinor == null && request.budgetMaxMinor == null
                        ? "Not specified"
                        : `KSh ${((request.budgetMinMinor ?? 0) / 100).toLocaleString()} – ${((request.budgetMaxMinor ?? 0) / 100).toLocaleString()}`
                    }
                  />
                  <Detail label="Contact" value={request.contactPreference} />
                </dl>
              </Surface>

              <Surface className="p-6 shadow-none">
                <h2 className="font-bold">Qualification action</h2>
                <p className="mt-2 text-sm text-[#68717b]">
                  Notes entered here are visible to the client.
                </p>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={4}
                  placeholder="Explain the question, assessment need, or decline reason."
                  className="mt-4 w-full rounded-2xl border border-black/10 p-3 text-sm leading-6"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {request.status === "SUBMITTED" ? (
                    <Button
                      className="rounded-full"
                      disabled={busy}
                      onClick={() => void runAction("review")}
                    >
                      Start review
                    </Button>
                  ) : null}
                  {["SUBMITTED", "UNDER_REVIEW", "ASSESSMENT_REQUIRED"].includes(
                    request.status,
                  ) ? (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void runAction("request-information")}
                    >
                      Request information
                    </Button>
                  ) : null}
                  {["SUBMITTED", "UNDER_REVIEW"].includes(request.status) ? (
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void runAction("request-assessment")}
                    >
                      Request assessment
                    </Button>
                  ) : null}
                  {!["DECLINED", "CANCELLED", "EXPIRED", "CONVERTED"].includes(
                    request.status,
                  ) ? (
                    <Button
                      variant="outline"
                      className="rounded-full border-danger/30 text-danger"
                      disabled={busy || note.trim().length < 5}
                      onClick={() => void runAction("decline")}
                    >
                      Decline
                    </Button>
                  ) : null}
                </div>
              </Surface>

              <EngagementConversation
                requestId={request.id}
                audience="professional"
              />
            </div>

            <aside className="space-y-5">
              <Surface className="p-5 shadow-none">
                <h2 className="font-bold">Client contact</h2>
                <p className="mt-3 text-sm">{request.client.displayName}</p>
                <p className="mt-1 text-sm text-[#68717b]">
                  {request.client.primaryEmail}
                </p>
                <p className="mt-1 text-sm text-[#68717b]">
                  {request.client.phone || "No phone added"}
                </p>
              </Surface>
              <Surface className="p-5 shadow-none">
                <div className="flex items-center gap-2">
                  <LockKeyhole className="size-4 text-[#5f8d11]" />
                  <h2 className="font-bold">Private notes</h2>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#68717b]">
                  Organisation-only. Never shown in the client response.
                </p>
                <textarea
                  value={privateNote}
                  onChange={(event) => setPrivateNote(event.target.value)}
                  rows={4}
                  className="mt-3 w-full rounded-xl border border-black/10 p-3 text-sm"
                  placeholder="Internal qualification notes"
                />
                <Button
                  variant="outline"
                  className="mt-3 w-full rounded-full"
                  disabled={busy || !privateNote.trim()}
                  onClick={() => void savePrivateNote()}
                >
                  <Send className="size-4" /> Save private note
                </Button>
                <ul className="mt-4 space-y-3">
                  {request.history
                    .filter((item) => item.privateProfessionalNote)
                    .map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl bg-[#f7f9fa] p-3 text-sm leading-6"
                      >
                        {item.privateProfessionalNote}
                      </li>
                    ))}
                </ul>
              </Surface>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-xs text-[#7a838c]">{label}</dt>
      <dd className="mt-1 font-semibold capitalize">
        {value?.replaceAll("_", " ").toLowerCase() || "Not specified"}
      </dd>
    </div>
  );
}
