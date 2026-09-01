"use client";

import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  FileClock,
  FileText,
  GitCompareArrows,
  MessageCircle,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { EngagementConversation } from "@/components/conversations/engagement-conversation";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { PublicProfessionalProfile } from "@/modules/professional-services/types";
import type {
  QuotationDetail,
  QuotationHistoryItem,
  QuotationStatus,
  QuotationVersion,
} from "@/modules/quotations/types";
import type { ClientServiceRequest } from "@/modules/service-requests/types";
import {
  getQuotation,
  getQuotationAttachment,
  getQuotationProfessional,
  getQuotationRequest,
  quotationAction,
} from "./quotation-api";
import { formatQuotationMoney, QuotationVersionView } from "./quotation-view";

export function ClientQuotationDetail({
  quotationId,
}: {
  quotationId: string;
}) {
  const [quotation, setQuotation] = useState<QuotationDetail | null>(null);
  const [request, setRequest] = useState<ClientServiceRequest | null>(null);
  const [professional, setProfessional] =
    useState<PublicProfessionalProfile | null>(null);
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);
  const [decisionMode, setDecisionMode] = useState<
    "accept" | "revision" | "decline" | null
  >(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getQuotation("client", quotationId, controller.signal)
      .then((result) => {
        setQuotation(result);
        setSelectedVersionNumber(result.currentVersionNumber);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setError(
          cause instanceof Error ? cause.message : "Quotation unavailable.",
        );
      });
    return () => controller.abort();
  }, [quotationId]);

  useEffect(() => {
    if (!quotation) return;
    const controller = new AbortController();
    void getQuotationRequest(quotation.requestId, controller.signal)
      .then(async (relatedRequest) => {
        setRequest(relatedRequest);
        if (!relatedRequest.preferredProfessionalSlug) return;
        const profile = await getQuotationProfessional(
          relatedRequest.preferredProfessionalSlug,
          controller.signal,
        );
        setProfessional(profile);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [quotation]);

  const selectedVersion = useMemo(
    () =>
      quotation?.versions.find(
        (version) => version.versionNumber === selectedVersionNumber,
      ) ?? null,
    [quotation, selectedVersionNumber],
  );

  async function runAction(action: "accept" | "decline" | "request-revision") {
    if (!quotation) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await quotationAction(
        "client",
        quotation.id,
        action,
        quotation.lockVersion,
        note,
      );
      setQuotation(updated);
      setSelectedVersionNumber(updated.currentVersionNumber);
      setNote("");
      setDecisionMode(null);
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "The response could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadAttachment(assetId: string) {
    setAttachmentError(null);
    try {
      const delivery = await getQuotationAttachment(assetId);
      const anchor = document.createElement("a");
      anchor.href = delivery.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.click();
    } catch (cause) {
      setAttachmentError(
        cause instanceof Error
          ? cause.message
          : "The attachment could not be opened.",
      );
    }
  }

  if (!quotation && !error) return <DetailPageSkeleton />;

  return (
    <div className="mx-auto w-full max-w-[1380px]">
      <Link
        href="/client/quotations"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b] transition-colors hover:text-[#5f7f00]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to quotations
      </Link>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Quotation needs attention"
          description={error}
        />
      ) : null}

      {quotation && selectedVersion ? (
        <>
          <Heading quotation={quotation} version={selectedVersion} />

          <DecisionDialog
            mode={decisionMode}
            quotation={quotation}
            note={note}
            busy={busy}
            error={actionError}
            onNoteChange={setNote}
            onOpenChange={(open) => {
              if (open || busy) return;
              setDecisionMode(null);
              setNote("");
              setActionError(null);
            }}
            onConfirm={() => {
              if (!decisionMode) return;
              void runAction(
                decisionMode === "revision" ? "request-revision" : decisionMode,
              );
            }}
          />

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
            <div className="order-2 min-w-0 space-y-5 xl:order-none xl:col-start-1 xl:row-span-2 xl:row-start-1">
              <VersionCard
                quotation={quotation}
                version={selectedVersion}
                onSelect={setSelectedVersionNumber}
              />

              {quotation.versions.length > 1 ? (
                <VersionComparison versions={quotation.versions} />
              ) : null}

              <div className="grid gap-5 lg:grid-cols-2">
                <AttachmentsCard
                  quotation={quotation}
                  request={request}
                  error={attachmentError}
                  onDownload={downloadAttachment}
                />
                <div id="quotation-activity" className="scroll-mt-5">
                  <RecentActivity history={quotation.history} />
                </div>
              </div>

              <div id="quotation-conversation" className="scroll-mt-5">
                <EngagementConversation
                  requestId={quotation.requestId}
                  audience="client"
                />
              </div>
            </div>

            <div className="order-1 xl:order-none xl:col-start-2 xl:row-start-1">
              <QuotationStatusCard
                quotation={quotation}
                version={
                  quotation.versions.find(
                    (version) =>
                      version.versionNumber === quotation.currentVersionNumber,
                  ) ?? selectedVersion
                }
                busy={busy}
                onDecision={setDecisionMode}
              />
            </div>

            <aside className="order-3 grid gap-5 sm:grid-cols-2 xl:order-none xl:col-start-2 xl:row-start-2 xl:grid-cols-1">
              <TimingCard version={selectedVersion} />
              <ProfessionalCard
                name={quotation.providerName}
                profile={professional}
              />
              <RequestCard
                category={quotation.requestCategory}
                request={request}
              />
              <div className="flex gap-3 rounded-2xl border border-[#dce8b0] bg-[#f8fbe9] p-5 sm:col-span-2 xl:col-span-1">
                <ShieldCheck
                  className="mt-0.5 size-6 shrink-0 text-[#5f8d11]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[#45505a]">
                  Structured acceptance preserves this exact version and creates
                  the booking foundation.
                </p>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Heading({
  quotation,
  version,
}: {
  quotation: QuotationDetail;
  version: QuotationVersion;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">Formal quotation</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-title sm:text-3xl">
          {quotation.requestCategory}
        </h1>
        <p className="mt-2 text-sm text-[#68717b]">
          {quotation.providerName} · {quotation.clientName}
        </p>
      </div>
      <a
        href={`/api/v1/client/quotations/${quotation.id}/download`}
        download={`quotation-${quotation.id}-v${version.versionNumber}.pdf`}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full shrink-0 sm:w-auto",
        )}
      >
        <Download className="size-4" aria-hidden="true" /> Download PDF
      </a>
    </div>
  );
}

type StatusTone = "pending" | "revision" | "accepted" | "declined" | "closed";

function QuotationStatusCard({
  quotation,
  version,
  busy,
  onDecision,
}: {
  quotation: QuotationDetail;
  version: QuotationVersion;
  busy: boolean;
  onDecision: (mode: "accept" | "revision" | "decline") => void;
}) {
  const [referenceTime] = useState(() => Date.now());
  const effectiveStatus: QuotationStatus =
    ["SUBMITTED", "VIEWED"].includes(quotation.status) &&
    (!version.validUntil ||
      new Date(version.validUntil).getTime() <= referenceTime)
      ? "EXPIRED"
      : quotation.status;
  const statusEvent = quotation.history.find(
    (item) => item.toStatus === effectiveStatus,
  );
  const responseDate =
    statusEvent?.createdAt ?? version.respondedAt ?? quotation.updatedAt;
  const newQuoteHref = `/client/requests/new?category=${encodeURIComponent(quotation.requestCategory)}`;
  const marketplaceHref = `/marketplace?category=${encodeURIComponent(quotation.requestCategory)}`;
  const messageAction = (
    <a
      href="#quotation-conversation"
      className={cn(buttonVariants({ variant: "outline" }), "w-full")}
    >
      <MessageCircle className="size-4" aria-hidden="true" /> Message
      professional
    </a>
  );

  if (["SUBMITTED", "VIEWED"].includes(effectiveStatus)) {
    return (
      <StatusSurface tone="pending">
        <StatusCardHeader />
        <h2 className="mt-4 text-2xl font-semibold tracking-title">
          Awaiting your decision
        </h2>
        {version.validUntil ? (
          <div className="mt-4">
            <StatusChip tone="pending" icon={<Clock3 className="size-3.5" />}>
              {validityLabel(version.validUntil, referenceTime)}
            </StatusChip>
          </div>
        ) : null}
        <p className="mt-4 text-sm leading-6 text-[#68717b]">
          Accept this quotation to create the booking foundation using this
          exact version of scope, pricing, and terms.
        </p>
        <div className="mt-5 grid gap-4">
          <div>
            <Button
              disabled={busy}
              className="w-full"
              onClick={() => onDecision("accept")}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" /> Accept
              quotation
            </Button>
            <p className="mt-1.5 text-center text-xs text-[#7a838c]">
              Creates booking from Version {version.versionNumber}
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => onDecision("revision")}
            >
              <RefreshCw className="size-4" aria-hidden="true" /> Request
              revision
            </Button>
            <p className="mt-1.5 text-center text-xs text-[#7a838c]">
              Ask for updates before proceeding
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecision("decline")}
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-danger transition-colors hover:bg-danger/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30 disabled:pointer-events-none disabled:opacity-55"
          >
            Decline quotation
          </button>
        </div>
      </StatusSurface>
    );
  }

  if (effectiveStatus === "REVISION_REQUESTED") {
    return (
      <StatusSurface tone="revision">
        <StatusCardHeader />
        <h2 className="mt-4 text-2xl font-semibold tracking-title text-[#8a4a00]">
          Revision requested
        </h2>
        <div className="mt-4">
          <StatusChip tone="revision" icon={<Clock3 className="size-3.5" />}>
            {statusDateLabel("Requested", responseDate, referenceTime)}
          </StatusChip>
        </div>
        <p className="mt-4 text-sm leading-6 text-[#68717b]">
          Your feedback has been sent to {quotation.providerName}. You&apos;ll
          be notified when an updated version is submitted.
        </p>
        {statusEvent?.note ? (
          <div className="mt-5 border-t border-black/8 pt-4">
            <p className="text-xs font-semibold text-[#45505a]">
              Reason for revision
            </p>
            <p className="mt-2 text-sm leading-6 text-[#68717b]">
              {statusEvent.note}
            </p>
          </div>
        ) : null}
        <div className="mt-5 grid gap-3">
          <a
            href="#quotation-activity"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full border-[#c97a1a] text-[#8a4a00] hover:bg-[#fff8ee]",
            )}
          >
            <FileText className="size-4" aria-hidden="true" /> View revision
            request
          </a>
          {messageAction}
        </div>
      </StatusSurface>
    );
  }

  if (effectiveStatus === "ACCEPTED") {
    const acceptedVersion =
      quotation.acceptedVersionNumber ?? version.versionNumber;
    return (
      <StatusSurface tone="accepted">
        <StatusCardHeader />
        <h2 className="mt-4 flex items-center gap-3 text-2xl font-semibold tracking-title text-[#187b22]">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1f922d] text-white">
            <Check className="size-5" aria-hidden="true" />
          </span>
          Quotation accepted
        </h2>
        <p className="mt-4 text-sm leading-6 text-[#68717b]">
          Version {acceptedVersion} was accepted. This quotation is locked and
          preserved as the booking foundation.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusChip
            tone="accepted"
            icon={<CalendarDays className="size-3.5" />}
          >
            {statusDateLabel("Accepted", responseDate, referenceTime)}
          </StatusChip>
          <StatusChip
            tone="accepted"
            icon={<ShieldCheck className="size-3.5" />}
          >
            Version {acceptedVersion} preserved
          </StatusChip>
        </div>
        <div className="mt-5 grid gap-3">
          {quotation.bookingId ? (
            <Link
              href={`/client/bookings/${quotation.bookingId}`}
              className={cn(buttonVariants(), "w-full")}
            >
              <FileCheck2 className="size-4" aria-hidden="true" /> View booking
              <ArrowRight className="ml-auto size-4" aria-hidden="true" />
            </Link>
          ) : null}
          {messageAction}
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#dce8b0] bg-[#f5fae7] p-3 text-xs leading-5 text-[#3f6818]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {quotation.bookingId
            ? "Booking created from this quotation version."
            : "The accepted version is preserved while booking details are prepared."}
        </div>
      </StatusSurface>
    );
  }

  if (effectiveStatus === "DECLINED") {
    return (
      <StatusSurface tone="declined">
        <StatusCardHeader />
        <h2 className="mt-4 text-2xl font-semibold tracking-title text-[#bd1616]">
          Quotation declined
        </h2>
        <p className="mt-4 text-sm leading-6 text-[#68717b]">
          You chose not to proceed with this quotation. No booking was created
          from this version.
        </p>
        <div className="mt-4">
          <StatusChip
            tone="declined"
            icon={<CalendarDays className="size-3.5" />}
          >
            {statusDateLabel("Declined", responseDate, referenceTime)}
          </StatusChip>
        </div>
        {statusEvent?.note ? (
          <div className="mt-5 border-t border-black/8 pt-4">
            <p className="text-xs font-semibold text-[#45505a]">Reason</p>
            <p className="mt-2 text-sm leading-6 text-[#68717b]">
              {statusEvent.note}
            </p>
          </div>
        ) : null}
        <div className="mt-5 grid gap-3">
          <Link
            href={marketplaceHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "w-full border-[#68aa22] text-[#356913] hover:bg-[#f5fae7]",
            )}
          >
            <UsersRound className="size-4" aria-hidden="true" /> Browse other
            professionals
          </Link>
          <Link
            href={newQuoteHref}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            <PlusCircle className="size-4" aria-hidden="true" /> Request a new
            quote
          </Link>
        </div>
        <p className="mt-5 text-center text-xs leading-5 text-[#7a838c]">
          This version remains in your records for reference.
        </p>
      </StatusSurface>
    );
  }

  const closedCopy = closedStatusCopy(effectiveStatus);
  return (
    <StatusSurface tone="closed">
      <StatusCardHeader />
      <h2 className="mt-4 text-2xl font-semibold tracking-title">
        {closedCopy.title}
      </h2>
      <div className="mt-4">
        <StatusChip tone="closed" icon={<FileClock className="size-3.5" />}>
          {statusLabel(effectiveStatus)}
        </StatusChip>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#68717b]">
        {closedCopy.description}
      </p>
      <div className="mt-5 grid gap-3">
        <Link href={newQuoteHref} className={cn(buttonVariants(), "w-full")}>
          <PlusCircle className="size-4" aria-hidden="true" /> Request a new
          quote
        </Link>
        {messageAction}
      </div>
    </StatusSurface>
  );
}

function StatusSurface({
  tone,
  children,
}: {
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <Surface
      aria-live="polite"
      className={cn(
        "overflow-hidden border p-5 shadow-card sm:p-6",
        tone === "pending" && "border-[#9acb31] bg-[#fcfef7]",
        tone === "revision" && "border-[#e3b052] bg-[#fffdf8]",
        tone === "accepted" && "border-[#68b766] bg-[#f9fdf7]",
        tone === "declined" && "border-[#ec7777] bg-[#fffafa]",
        tone === "closed" && "border-black/10 bg-white",
      )}
    >
      {children}
    </Surface>
  );
}

function StatusCardHeader() {
  return (
    <div className="flex items-center gap-2.5">
      <FileCheck2 className="size-5" aria-hidden="true" />
      <p className="text-sm font-semibold">Quotation status</p>
    </div>
  );
}

function StatusChip({
  tone,
  icon,
  children,
}: {
  tone: StatusTone;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        tone === "pending" && "border-[#dce8b0] bg-[#f5fae7] text-[#4f7c15]",
        tone === "revision" && "border-[#f0d6aa] bg-[#fff7eb] text-[#8a4a00]",
        tone === "accepted" && "border-[#d3e9ca] bg-[#edf8e9] text-[#28722d]",
        tone === "declined" && "border-[#f2caca] bg-[#fff1f1] text-[#bd1616]",
        tone === "closed" && "border-black/8 bg-[#f7f9fa] text-[#68717b]",
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function validityLabel(validUntil: string, referenceTime: number) {
  const remainingDays = Math.ceil(
    (new Date(validUntil).getTime() - referenceTime) / (24 * 60 * 60 * 1_000),
  );
  if (remainingDays <= 0) return "Validity ended";
  if (remainingDays <= 30) {
    return `Valid for ${remainingDays} more ${remainingDays === 1 ? "day" : "days"}`;
  }
  return `Valid until ${formatShortDate(validUntil)}`;
}

function statusDateLabel(verb: string, value: string, referenceTime: number) {
  const eventDate = new Date(value);
  const today = new Date(referenceTime);
  if (eventDate.toDateString() === today.toDateString()) return `${verb} today`;
  return `${verb} ${formatShortDate(value)}`;
}

function closedStatusCopy(status: QuotationStatus) {
  if (status === "EXPIRED") {
    return {
      title: "Quotation expired",
      description:
        "This quotation is no longer available for acceptance. You can request a current quote or message the professional.",
    };
  }
  if (status === "CANCELLED") {
    return {
      title: "Quotation cancelled",
      description:
        "This quotation was cancelled and can no longer create a booking.",
    };
  }
  if (status === "REPLACED") {
    return {
      title: "Quotation replaced",
      description:
        "A newer quotation version replaced this record. Review the latest version before deciding.",
    };
  }
  return {
    title: "Quotation in preparation",
    description:
      "The professional is preparing this quotation. You will be notified when it is ready.",
  };
}

function VersionCard({
  quotation,
  version,
  onSelect,
}: {
  quotation: QuotationDetail;
  version: QuotationVersion;
  onSelect: (version: number) => void;
}) {
  return (
    <Surface className="overflow-hidden p-0 shadow-none">
      <div className="flex flex-col gap-4 border-b border-black/8 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className=" font-semibold">Version {version.versionNumber}</h2>
          <p className="mt-1 text-xs text-[#7a838c]">
            {version.submittedAt
              ? `Submitted ${formatDateTime(version.submittedAt)}`
              : "Draft · editable until submitted"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Quotation versions">
          {quotation.versions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.versionNumber)}
              aria-pressed={version.versionNumber === item.versionNumber}
              className={cn(
                "min-h-9 rounded-full border px-4 text-xs font-semibold transition-colors",
                version.versionNumber === item.versionNumber
                  ? "border-[#b7dc52] bg-[#eff9c9] text-[#38520c]"
                  : "border-black/10 bg-white hover:bg-[#f7f9fa]",
              )}
            >
              V{item.versionNumber}
            </button>
          ))}
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <QuotationVersionView version={version} />
      </div>
    </Surface>
  );
}

function TimingCard({ version }: { version: QuotationVersion }) {
  return (
    <Surface className="p-5 shadow-none">
      <CardTitle
        icon={<CalendarClock className="size-5" />}
        title="Timing & validity"
      />
      <dl className="mt-4 grid gap-3 text-sm">
        <Meta
          label="Expected duration"
          value={formatDuration(version.expectedDurationMinutes)}
        />
        <Meta
          label="Proposed start"
          value={
            version.proposedStartAt
              ? formatDateTime(version.proposedStartAt)
              : "To be agreed"
          }
        />
        <Meta
          label="Valid until"
          value={
            version.validUntil ? formatDateTime(version.validUntil) : "Not set"
          }
        />
      </dl>
    </Surface>
  );
}

function ProfessionalCard({
  name,
  profile,
}: {
  name: string;
  profile: PublicProfessionalProfile | null;
}) {
  return (
    <Surface className="p-5 shadow-none">
      <CardTitle icon={<Building2 className="size-5" />} title="Professional" />
      <div className="mt-4 flex items-center gap-3">
        {profile?.logoUrl ? (
          <Image
            src={profile.logoUrl}
            alt={`${name} logo`}
            width={52}
            height={52}
            className="size-13 rounded-full border border-black/8 object-cover"
          />
        ) : (
          <span className="grid size-13 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{name}</span>
            {profile?.verified ? (
              <BadgeCheck
                className="size-4 shrink-0 fill-[#5f8d11] text-white"
                aria-label="Verified professional"
              />
            ) : null}
          </p>
          {profile?.rating !== null && profile?.rating !== undefined ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-[#68717b]">
              <Star
                className="size-3.5 fill-[#ffb81c] text-[#ffb81c]"
                aria-hidden="true"
              />
              <span className="font-semibold text-foreground">
                {profile.rating.toFixed(1)}
              </span>{" "}
              ({profile.reviewCount} reviews)
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#68717b]">No public rating yet</p>
          )}
          {profile?.responseIndicator ? (
            <p className="mt-1 text-xs text-[#68717b]">
              {profile.responseIndicator}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {profile ? (
          <Link
            href={`/professionals/${encodeURIComponent(profile.slug)}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "flex-1",
            )}
          >
            View profile
          </Link>
        ) : null}
        <a
          href="#quotation-conversation"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "flex-1",
          )}
        >
          <MessageCircle className="size-4" aria-hidden="true" /> Message
        </a>
      </div>
    </Surface>
  );
}

function RequestCard({
  category,
  request,
}: {
  category: string;
  request: ClientServiceRequest | null;
}) {
  return (
    <Surface className="p-5 shadow-none sm:col-span-2 xl:col-span-1">
      <CardTitle
        icon={<FileText className="size-5" />}
        title="Request summary"
      />
      <dl className="mt-4 grid gap-3 text-sm">
        <Meta label="Category" value={request?.category ?? category} />
        <Meta label="Location" value={request?.location ?? "Not set"} />
        <Meta
          label="Preferred schedule"
          value={request?.preferredTime ?? "Flexible"}
        />
        <Meta
          label="Urgency"
          value={request?.urgency ? titleCase(request.urgency) : "Flexible"}
        />
        <Meta
          label="Budget"
          value={request ? formatBudget(request) : "Not set"}
        />
        <Meta
          label="Request details"
          value={request?.description ?? "See quotation scope"}
          stacked
        />
      </dl>
    </Surface>
  );
}

function AttachmentsCard({
  quotation,
  request,
  error,
  onDownload,
}: {
  quotation: QuotationDetail;
  request: ClientServiceRequest | null;
  error: string | null;
  onDownload: (assetId: string) => Promise<void>;
}) {
  const attachments = request?.attachments ?? [];
  return (
    <Surface className="p-5 shadow-none">
      <h2 className="font-semibold">Attachments ({attachments.length + 1})</h2>
      <div className="mt-4 space-y-3">
        <AttachmentRow
          name={`Quotation_V${quotation.currentVersionNumber}.pdf`}
          detail="Current quotation"
          href={`/api/v1/client/quotations/${quotation.id}/download`}
        />
        {attachments.map((attachment, index) => (
          <AttachmentRow
            key={attachment.id}
            name={`Request attachment ${index + 1}`}
            detail={`${mimeLabel(attachment.mimeType)} · ${formatBytes(attachment.sizeBytes)}`}
            onClick={() => void onDownload(attachment.assetId)}
          />
        ))}
      </div>
      {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}
    </Surface>
  );
}

function AttachmentRow({
  name,
  detail,
  href,
  onClick,
}: {
  name: string;
  detail: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf3ff] text-[#2d67c8]">
        <FileText className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="mt-0.5 block text-xs text-[#7a838c]">{detail}</span>
      </span>
      <Download className="size-4 shrink-0" aria-hidden="true" />
    </>
  );
  const classes =
    "flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition-colors hover:border-black/8 hover:bg-[#f7f9fa]";
  return href ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <button type="button" className={classes} onClick={onClick}>
      {content}
    </button>
  );
}

function RecentActivity({ history }: { history: QuotationHistoryItem[] }) {
  return (
    <Surface className="p-5 shadow-none">
      <h2 className="font-semibold">Recent activity</h2>
      <ol className="mt-4 space-y-4">
        {history.slice(0, 4).map((item) => (
          <li
            key={item.id}
            className="grid grid-cols-[10px_minmax(0,1fr)] gap-3"
          >
            <span
              className="mt-1.5 size-2.5 rounded-full bg-[#8fbd20]"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className=" font-medium">
                  {titleCase(item.action)}
                  {item.versionNumber ? ` · Version ${item.versionNumber}` : ""}
                </p>
                {item.note ? (
                  <p className="mt-1 text-xs leading-5 text-[#68717b]">
                    {item.note}
                  </p>
                ) : null}
              </div>
              <time className="shrink-0 text-xs text-[#7a838c]">
                {formatDateTime(item.createdAt)}
              </time>
            </div>
          </li>
        ))}
      </ol>
    </Surface>
  );
}

function VersionComparison({ versions }: { versions: QuotationVersion[] }) {
  const [latest, previous] = versions;
  if (!latest || !previous) return null;
  return (
    <Surface className="p-5 shadow-none sm:p-6">
      <CardTitle
        icon={<GitCompareArrows className="size-5 text-[#5f8d11]" />}
        title={`V${previous.versionNumber} → V${latest.versionNumber}`}
      />
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

function DecisionDialog({
  mode,
  quotation,
  note,
  busy,
  error,
  onNoteChange,
  onOpenChange,
  onConfirm,
}: {
  mode: "accept" | "revision" | "decline" | null;
  quotation: QuotationDetail;
  note: string;
  busy: boolean;
  error: string | null;
  onNoteChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const content = mode ? decisionDialogContent(mode, quotation) : null;
  return (
    <Dialog open={Boolean(mode)} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[29rem]"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        {content ? (
          <>
            <DialogHeader>
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>{content.description}</DialogDescription>
            </DialogHeader>

            {mode !== "accept" ? (
              <div>
                <label
                  htmlFor="quotation-decision-note"
                  className="text-sm font-semibold text-[#45505a]"
                >
                  {mode === "revision"
                    ? "What should be revised?"
                    : "Reason for declining (optional)"}
                </label>
                <textarea
                  id="quotation-decision-note"
                  value={note}
                  onChange={(event) => onNoteChange(event.target.value)}
                  rows={5}
                  autoFocus
                  placeholder={
                    mode === "revision"
                      ? "Describe the price, scope, timing, or terms that need to change."
                      : "Share a reason with the professional."
                  }
                  className="mt-2 w-full resize-y rounded-2xl border border-black/10 bg-white p-3 text-sm leading-6 placeholder:text-[#8a9299]"
                />
              </div>
            ) : (
              <div className="flex gap-3 rounded-2xl border border-[#dce8b0] bg-[#f8fbe9] p-4">
                <ShieldCheck
                  className="mt-0.5 size-5 shrink-0 text-[#5f8d11]"
                  aria-hidden="true"
                />
                <p className="text-sm leading-6 text-[#45505a]">
                  Version {quotation.currentVersionNumber} for{" "}
                  {formatQuotationMoney(
                    quotation.currentTotalMinor,
                    quotation.currency,
                  )}{" "}
                  will be preserved as the accepted terms.
                </p>
              </div>
            )}

            {error ? (
              <InlineAlert
                variant="error"
                title="Response not sent"
                description={error}
              />
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={mode === "decline" ? "danger" : "primary"}
                loading={busy}
                disabled={mode === "revision" && note.trim().length < 3}
                onClick={onConfirm}
              >
                {content.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function decisionDialogContent(
  mode: "accept" | "revision" | "decline",
  quotation: QuotationDetail,
) {
  if (mode === "accept") {
    return {
      title: "Accept this quotation?",
      description: `Accepting creates the booking foundation with ${quotation.providerName}.`,
      confirmLabel: "Accept quotation",
    };
  }
  if (mode === "revision") {
    return {
      title: "Request a quotation revision",
      description: `Tell ${quotation.providerName} what should change before you decide.`,
      confirmLabel: "Send revision request",
    };
  }
  return {
    title: "Decline this quotation?",
    description: `This closes the current quotation from ${quotation.providerName}.`,
    confirmLabel: "Decline quotation",
  };
}

function CardTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2" aria-hidden={undefined}>
      {icon}
      <h2 className="font-semibold">{title}</h2>
    </div>
  );
}
function ComparisonValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f9fa] p-4">
      <dt className="text-xs text-[#7a838c]">{label}</dt>
      <dd className="mt-2 font-semibold">{value}</dd>
    </div>
  );
}
function Meta({
  label,
  value,
  stacked = false,
}: {
  label: string;
  value: string;
  stacked?: boolean;
}) {
  return (
    <div
      className={
        stacked
          ? "space-y-1"
          : "grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-3"
      }
    >
      <dt className="text-[#68717b]">{label}</dt>
      <dd className={cn("font-medium", stacked ? "leading-6" : "text-right")}>
        {value}
      </dd>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    SUBMITTED: "Awaiting decision",
    VIEWED: "Awaiting decision",
    ACCEPTED: "Accepted",
    DECLINED: "Declined",
    REVISION_REQUESTED: "Revision requested",
    REPLACED: "Replaced",
    EXPIRED: "Expired",
    CANCELLED: "Cancelled",
  };
  return labels[status] ?? titleCase(status);
}
function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} ${hours === 1 ? "hour" : "hours"}`;
}
function formatShortDate(value: string | null | undefined) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}
function formatBudget(request: ClientServiceRequest) {
  const { budgetMinMinor: min, budgetMaxMinor: max } = request;
  if (min === null && max === null) return "Not set";
  if (min !== null && max !== null)
    return `${formatQuotationMoney(min, "KES")} – ${formatQuotationMoney(max, "KES")}`;
  if (min !== null) return `From ${formatQuotationMoney(min, "KES")}`;
  return `Up to ${formatQuotationMoney(max ?? 0, "KES")}`;
}
function formatSignedMoney(value: number, currency: string) {
  const formatted = formatQuotationMoney(Math.abs(value), currency);
  return value > 0
    ? `+ ${formatted}`
    : value < 0
      ? `− ${formatted}`
      : formatted;
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function mimeLabel(value: string) {
  if (value === "application/pdf") return "PDF";
  if (value.startsWith("image/")) return "Image";
  return "File";
}
function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
