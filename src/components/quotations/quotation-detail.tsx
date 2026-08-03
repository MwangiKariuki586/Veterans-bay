"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Download,
  GitCompareArrows,
  Pencil,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { EngagementConversation } from "@/components/conversations/engagement-conversation";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type {
  QuotationDetail as QuotationDetailContract,
  QuotationVersion,
} from "@/modules/quotations/types";
import { getQuotation, quotationAction } from "./quotation-api";
import { QuotationEditor } from "./quotation-editor";
import {
  formatQuotationMoney,
  QuotationVersionView,
} from "./quotation-view";

export function QuotationDetail({
  audience,
  quotationId,
}: {
  audience: "client" | "professional";
  quotationId: string;
}) {
  const [quotation, setQuotation] =
    useState<QuotationDetailContract | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] =
    useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<
    "update" | "revision" | null
  >(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "submit" | "accept" | "decline" | null
  >(null);

  useEffect(() => {
    void getQuotation(audience, quotationId)
      .then((result) => {
        setQuotation(result);
        setSelectedVersionNumber(result.currentVersionNumber);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Quotation unavailable.",
        ),
      );
  }, [audience, quotationId]);

  const selectedVersion = useMemo(
    () =>
      quotation?.versions.find(
        (item) => item.versionNumber === selectedVersionNumber,
      ) ?? null,
    [quotation, selectedVersionNumber],
  );

  async function runAction(
    action: "submit" | "accept" | "decline" | "request-revision",
  ) {
    if (!quotation) return;
    if (action !== "request-revision" && pendingAction !== action) {
      setPendingAction(action);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await quotationAction(
        audience,
        quotation.id,
        action,
        quotation.lockVersion,
        note,
      );
      setQuotation(updated);
      setSelectedVersionNumber(updated.currentVersionNumber);
      setNote("");
      setPendingAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!quotation && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading quotation"
        description="Retrieving the current commercial terms and version history."
      />
    );
  }

  if (quotation && editorMode) {
    return (
      <QuotationEditor
        quotation={quotation}
        mode={editorMode}
        onSaved={(updated) => {
          setQuotation(updated);
          setSelectedVersionNumber(updated.currentVersionNumber);
          setEditorMode(null);
        }}
      />
    );
  }

  const backPath =
    audience === "client" ? "/client/quotations" : "/professional/quotations";

  return (
    <div>
      <Link
        href={backPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" /> Back to quotations
      </Link>
      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Quotation needs attention"
          description={error}
        />
      ) : null}
      {pendingAction ? (
        <div
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d6e799] bg-[#f7fbdc] p-4"
          role="alert"
        >
          <p className="text-sm font-semibold text-[#33400f]">
            {pendingAction === "submit"
              ? "Submit this version? Its commercial terms will become immutable."
              : pendingAction === "accept"
                ? "Accept this quotation and create the booking foundation?"
                : "Decline this quotation?"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              loading={busy}
              onClick={() => void runAction(pendingAction)}
            >
              Confirm {pendingAction.replace("-", " ")}
            </Button>
          </div>
        </div>
      ) : null}
      {quotation && selectedVersion ? (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#5f8d11]">
                  Formal quotation
                </p>
                <Badge
                  variant={
                    quotation.status === "ACCEPTED"
                      ? "trust"
                      : quotation.status === "DRAFT"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {quotation.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-title">
                {quotation.requestCategory}
              </h1>
              <p className="mt-2 text-sm text-[#68717b]">
                {quotation.providerName} · {quotation.clientName}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/v1/${audience}/quotations/${quotation.id}/download`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Download className="size-4" /> Download
              </a>
              {audience === "professional" && quotation.status === "DRAFT" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditorMode("update")}
                  >
                    <Pencil className="size-4" /> Edit draft
                  </Button>
                  <Button
                    loading={busy}
                    onClick={() => void runAction("submit")}
                  >
                    <Send className="size-4" /> Submit
                  </Button>
                </>
              ) : null}
              {audience === "professional" &&
              ["SUBMITTED", "VIEWED", "REVISION_REQUESTED"].includes(
                quotation.status,
              ) ? (
                <Button onClick={() => setEditorMode("revision")}>
                  Create revision
                </Button>
              ) : null}
            </div>
          </div>

          {quotation.status === "ACCEPTED" && quotation.bookingId ? (
            <InlineAlert
              className="mt-5"
              variant="success"
              title="Quotation accepted"
              description="The accepted terms are preserved and the booking foundation has been created."
            />
          ) : null}

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              <Surface className="p-5 shadow-none sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-5">
                  <div>
                    <h2 className="text-lg font-bold">
                      Version {selectedVersion.versionNumber}
                    </h2>
                    <p className="mt-1 text-xs text-[#7a838c]">
                      {selectedVersion.submittedAt
                        ? `Submitted ${new Date(selectedVersion.submittedAt).toLocaleString()}`
                        : "Draft · editable until submitted"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quotation.versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        onClick={() =>
                          setSelectedVersionNumber(version.versionNumber)
                        }
                        className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${
                          selectedVersion.versionNumber === version.versionNumber
                            ? "border-[#8eb81d] bg-[#eff9c9]"
                            : "border-black/10 bg-white"
                        }`}
                      >
                        v{version.versionNumber}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <QuotationVersionView version={selectedVersion} />
                </div>
              </Surface>

              {quotation.versions.length > 1 ? (
                <VersionComparison versions={quotation.versions} />
              ) : null}

              <EngagementConversation
                requestId={quotation.requestId}
                audience={audience}
              />
            </div>

            <aside className="space-y-5">
              <Surface className="p-5 shadow-none">
                <h2 className="font-bold">Timing</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <Meta
                    label="Expected duration"
                    value={`${selectedVersion.expectedDurationMinutes} minutes`}
                  />
                  <Meta
                    label="Proposed start"
                    value={
                      selectedVersion.proposedStartAt
                        ? new Date(
                            selectedVersion.proposedStartAt,
                          ).toLocaleString()
                        : "To be agreed"
                    }
                  />
                  <Meta
                    label="Valid until"
                    value={
                      selectedVersion.validUntil
                        ? new Date(selectedVersion.validUntil).toLocaleString()
                        : "Not set"
                    }
                  />
                </dl>
              </Surface>

              {audience === "client" &&
              ["SUBMITTED", "VIEWED"].includes(quotation.status) ? (
                <Surface className="p-5 shadow-none">
                  <h2 className="font-bold">Your decision</h2>
                  <p className="mt-2 text-sm leading-6 text-[#68717b]">
                    Structured acceptance preserves the exact version and creates
                    the booking foundation.
                  </p>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={4}
                    placeholder="Explain a revision request or decline reason."
                    className="mt-4 w-full rounded-xl border border-black/10 p-3 text-sm"
                  />
                  <div className="mt-4 grid gap-2">
                    <Button
                      loading={busy}
                      onClick={() => void runAction("accept")}
                    >
                      <CheckCircle2 className="size-4" /> Accept current version
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy || note.trim().length < 3}
                      onClick={() => void runAction("request-revision")}
                    >
                      Request revision
                    </Button>
                    <Button
                      variant="outline"
                      className="border-danger/30 text-danger"
                      disabled={busy}
                      onClick={() => void runAction("decline")}
                    >
                      Decline
                    </Button>
                  </div>
                </Surface>
              ) : null}

              <Surface className="p-5 shadow-none">
                <h2 className="font-bold">Version history</h2>
                <ol className="mt-4 space-y-4 border-l border-black/10 pl-4">
                  {quotation.history.map((item) => (
                    <li key={item.id}>
                      <p className="text-sm font-semibold">
                        {item.action.replaceAll("_", " ").toLowerCase()}
                      </p>
                      <p className="mt-1 text-xs text-[#7a838c]">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                      {item.note ? (
                        <p className="mt-2 text-sm leading-6 text-[#68717b]">
                          {item.note}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </Surface>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function VersionComparison({ versions }: { versions: QuotationVersion[] }) {
  const [latest, previous] = versions;
  if (!latest || !previous) return null;
  return (
    <Surface className="p-5 shadow-none sm:p-6">
      <div className="flex items-center gap-2">
        <GitCompareArrows className="size-5 text-[#5f8d11]" />
        <h2 className="text-lg font-bold">
          v{previous.versionNumber} → v{latest.versionNumber}
        </h2>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <ComparisonValue
          label="Total change"
          value={formatSignedMoney(
            latest.totalMinor - previous.totalMinor,
            latest.currency,
          )}
        />
        <ComparisonValue
          label="Deposit change"
          value={formatSignedMoney(
            latest.depositMinor - previous.depositMinor,
            latest.currency,
          )}
        />
        <ComparisonValue
          label="Duration change"
          value={`${latest.expectedDurationMinutes - previous.expectedDurationMinutes >= 0 ? "+" : ""}${latest.expectedDurationMinutes - previous.expectedDurationMinutes} min`}
        />
      </dl>
    </Surface>
  );
}

function ComparisonValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f9fa] p-4">
      <dt className="text-xs text-[#7a838c]">{label}</dt>
      <dd className="mt-2 font-bold">{value}</dd>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#7a838c]">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function formatSignedMoney(value: number, currency: string) {
  const formatted = formatQuotationMoney(Math.abs(value), currency);
  return value > 0 ? `+ ${formatted}` : value < 0 ? `− ${formatted}` : formatted;
}
