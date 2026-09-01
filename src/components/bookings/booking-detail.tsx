"use client";

import {
  ArrowLeft,
  Bell,
  CalendarCheck,
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  MessageCircle,
  Package,
  Star,
  Tag,
  Trash2,
  UserRound,
  Wrench,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  BookingDetail as BookingDetailContract,
  BookingSlot,
} from "@/modules/bookings/types";
import { bookingAction, getBooking, getBookingSlots } from "./booking-api";

export function BookingDetail({
  audience,
  bookingId,
}: {
  audience: "client" | "professional";
  bookingId: string;
}) {
  const [booking, setBooking] = useState<BookingDetailContract | null>(null);
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");

  useEffect(() => {
    void getBooking(audience, bookingId)
      .then(setBooking)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Booking unavailable.",
        ),
      );
  }, [audience, bookingId]);

  const needsSlots = useMemo(
    () =>
      booking &&
      (audience === "client"
        ? !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(booking.status)
        : [
            "PENDING_CONFIRMATION",
            "PENDING_DEPOSIT",
            "RESCHEDULE_REQUESTED",
          ].includes(booking.status)),
    [audience, booking],
  );

  useEffect(() => {
    if (!needsSlots) return;
    void getBookingSlots(audience, bookingId)
      .then((items) => {
        setSlots(items);
        if (booking?.requestedStartAt) {
          setSelectedSlot(
            items.find(
              (item) =>
                item.startsAt === booking.requestedStartAt &&
                item.membershipId === booking.requestedMembershipId,
            ) ?? null,
          );
        }
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Availability unavailable.",
        ),
      );
  }, [
    audience,
    booking?.requestedMembershipId,
    booking?.requestedStartAt,
    bookingId,
    needsSlots,
  ]);

  async function runAction(action: string, body: Record<string, unknown>) {
    if (!booking) return;
    setBusy(action);
    setError(null);
    setActionError(null);
    try {
      const updated = await bookingAction(audience, booking.id, action, body);
      setBooking(updated);
      setReason("");
      setRescheduleReason("");
      setCancelOpen(false);
      setRescheduleOpen(false);
      if (!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(updated.status)) {
        const refreshedSlots = await getBookingSlots(audience, booking.id);
        setSlots(refreshedSlots);
        setSelectedSlot(
          updated.requestedStartAt && updated.requestedMembershipId
            ? (refreshedSlots.find(
                (item) =>
                  item.startsAt === updated.requestedStartAt &&
                  item.membershipId === updated.requestedMembershipId,
              ) ?? selectedSlot)
            : null,
        );
      } else {
        setSelectedSlot(null);
      }
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Booking action failed.";
      setError(message);
      setActionError(message);
    } finally {
      setBusy(null);
    }
  }

  if (!booking && !error) return <DetailPageSkeleton />;
  const backPath =
    audience === "client" ? "/client/bookings" : "/professional/bookings";
  if (!booking) {
    return (
      <div className="mx-auto w-full max-w-[1280px]">
        <Link
          href={backPath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
        >
          <ArrowLeft className="size-4" /> Back to bookings
        </Link>
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Booking needs attention"
          description={error ?? "Booking unavailable."}
        />
      </div>
    );
  }

  const isScheduled = ["CONFIRMED", "RESCHEDULED"].includes(booking.status);
  const isCompleted = booking.status === "COMPLETED";
  const isCancelled = ["CANCELLED", "NO_SHOW"].includes(booking.status);
  const isPending = ["PENDING_CONFIRMATION", "PENDING_DEPOSIT"].includes(
    booking.status,
  );
  const isRescheduleRequested = booking.status === "RESCHEDULE_REQUESTED";

  // progress steps: 0 Confirmed, 1 Scheduled, 2 In progress, 3 Completed, 4 Review
  // For mock, Scheduled is green when CONFIRMED/RESCHEDULED/COMPLETED, else grey
  const progressActive = (() => {
    if (isCancelled) return -1;
    if (isPending) return 0;
    if (isRescheduleRequested) return 1;
    if (isScheduled) return 1;
    if (isCompleted) return 3;
    return 1;
  })();

  const currentStatus = (() => {
    if (isCancelled)
      return {
        dot: "bg-[#c0392b]",
        label: "Cancelled",
        title: "Cancelled",
        desc: "This booking has been cancelled.",
        tone: "text-[#c0392b]",
      };
    if (isCompleted)
      return {
        dot: "bg-[#5f8d11]",
        label: "Completed",
        title: "Completed",
        desc: "Your service has been completed. Thank you for using Veterans Bay.",
        tone: "text-[#5f8d11]",
      };
    if (isPending)
      return {
        dot: "bg-[#e67e22]",
        label: "Pending confirmation",
        title: "Awaiting confirmation",
        desc: "Your booking is awaiting confirmation. The professional will review your requested time soon.",
        tone: "text-[#b45309]",
      };
    if (booking.status === "PENDING_DEPOSIT")
      return {
        dot: "bg-[#e67e22]",
        label: "Deposit required",
        title: "Deposit required",
        desc: "A deposit is required before this booking can be confirmed.",
        tone: "text-[#b45309]",
      };
    if (isRescheduleRequested)
      return {
        dot: "bg-[#e67e22]",
        label: "Reschedule requested",
        title: "Reschedule requested",
        desc: "A new time has been requested. The professional will confirm shortly.",
        tone: "text-[#b45309]",
      };
    return {
      dot: "bg-[#5f8d11]",
      label: "Scheduled",
      title: "Scheduled",
      desc: "Your booking is confirmed and scheduled. You'll be notified before the professional arrives.",
      tone: "text-[#426d08]",
    };
  })();

  const scheduleDate = booking.startsAt
    ? new Date(booking.startsAt)
    : booking.requestedStartAt
      ? new Date(booking.requestedStartAt)
      : null;
  const endsAt = booking.endsAt
    ? new Date(booking.endsAt)
    : scheduleDate && booking.expectedDurationMinutes
      ? new Date(
          scheduleDate.getTime() + booking.expectedDurationMinutes * 60000,
        )
      : null;
  const duration = booking.expectedDurationMinutes;
  const daysToGo = scheduleDate
    ? Math.max(
        0,
        Math.ceil(
          // eslint-disable-next-line react-hooks/purity
          (scheduleDate.getTime() - Date.now()) / 86400000,
        ),
      )
    : null;

  const bookingTypeLabel = (() => {
    if (booking.origin === "DIRECT_SERVICE") return "Direct booking";
    if (booking.origin === "ACCEPTED_QUOTATION") return "From quotation";
    if (booking.origin === "PROFESSIONAL_CUSTOMER")
      return "Professional booking";
    if (booking.origin === "REPEAT_BOOKING") return "Repeat booking";
    if (booking.origin === "APPROVED_ASSESSMENT") return "Approved assessment";
    return (booking.origin as string).replaceAll("_", " ").toLowerCase();
  })();

  const sourceLabel = booking.quotationId
    ? `Quoted from request ${formatReqId(booking.requestId)}`
    : booking.requestId
      ? `Request ${formatReqId(booking.requestId)}`
      : "Direct service";

  const payment = {
    total: booking.totalMinor,
    currency: booking.currency,
    subtotal: Math.round(booking.totalMinor / 1.16),
    tax: booking.totalMinor - Math.round(booking.totalMinor / 1.16),
  };

  const locationTitle = "Kilimani, Nairobi";
  const locationDetail = "Apartment 4B, Rose Avenue\nNairobi, Kenya";

  const bookAgainHref = (b: BookingDetailContract) => {
    if (b.serviceSlug) return `/services/${b.serviceSlug}`;
    if (b.providerSlug) return `/professionals/${b.providerSlug}`;
    return `/client/bookings/new?sourceBookingId=${b.id}`;
  };

  const headerPrimary = (() => {
    if (["CANCELLED", "NO_SHOW", "COMPLETED"].includes(booking.status)) {
      return { label: "Book again", href: bookAgainHref(booking), variant: "primary" as const };
    }
    if (booking.status === "PENDING_DEPOSIT") {
      return { label: "View booking", href: `/${audience}/bookings/${booking.id}`, variant: "outline" as const };
    }
    if (booking.status === "PENDING_CONFIRMATION") {
      return audience === "professional"
        ? { label: "Review & confirm", onClick: () => setRescheduleOpen(true), variant: "primary" as const }
        : { label: "Manage schedule", onClick: () => setRescheduleOpen(true), variant: "primary" as const };
    }
    if (booking.status === "RESCHEDULE_REQUESTED") {
      return audience === "professional"
        ? { label: "Accept new time", onClick: () => setRescheduleOpen(true), variant: "primary" as const }
        : { label: "View booking", href: `/${audience}/bookings/${booking.id}`, variant: "outline" as const };
    }
    if (["CONFIRMED", "RESCHEDULED"].includes(booking.status)) {
      return audience === "client"
        ? { label: "Request new time", onClick: () => setRescheduleOpen(true), variant: "primary" as const }
        : booking.jobId
          ? { label: "View job", href: `/professional/jobs/${booking.jobId}`, variant: "primary" as const }
          : { label: "View booking", href: `/${audience}/bookings/${booking.id}`, variant: "outline" as const };
    }
    return null;
  })();

  return (
    <div>
      <Link
        href={backPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" /> Back to bookings
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-title">
            {booking.serviceName}
          </h1>
          <p className="mt-1.5 text-sm text-[#68717b]">
            {booking.providerName} ·{" "}
            {booking.assignmentName ?? booking.clientName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {headerPrimary ? (
            headerPrimary.href ? (
              <Link href={headerPrimary.href} className={buttonVariants({ variant: headerPrimary.variant, className: "rounded-full" })}>
                {headerPrimary.label}
              </Link>
            ) : (
              <Button onClick={headerPrimary.onClick} className="rounded-full">
                {headerPrimary.label}
              </Button>
            )
          ) : null}
        </div>
      </div>

      {error ? (
        <InlineAlert
          className="mt-4"
          variant="error"
          title="Booking needs attention"
          description={error}
        />
      ) : null}
      {booking.status === "PENDING_DEPOSIT" ? (
        <InlineAlert
          className="mt-4"
          variant="warning"
          title="Deposit required before confirmation"
          description="The booking can collect a requested time, but confirmation remains blocked until the deposit requirement is satisfied or waived by the later payment workflow."
        />
      ) : null}

      {/* Main grid */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Left */}
        <div className="space-y-4">
          {/* Booking progress */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Booking progress
            </h2>
            <div className="relative mt-5">
              <div
                className="absolute left-[16%] right-[16%] top-[18px] h-px bg-black/10"
                aria-hidden="true"
              />
              <div
                className="absolute left-[16%] top-[18px] h-px bg-[#8eb81d] transition-all"
                style={{
                  width: `${Math.max(0, Math.min(1, (progressActive + 1) / 5)) * 68}%`,
                }}
                aria-hidden="true"
              />
              <ol className="grid grid-cols-5 gap-2">
                <ProgressStep
                  active={progressActive >= 0}
                  label="Confirmed"
                  sub={
                    booking.createdAt ? formatShortDate(booking.createdAt) : "—"
                  }
                  icon={Check}
                />
                <ProgressStep
                  active={progressActive >= 1}
                  label="Scheduled"
                  sub={
                    scheduleDate
                      ? formatShortDate(scheduleDate.toISOString())
                      : "Pending"
                  }
                  icon={CalendarDays}
                />
                <ProgressStep
                  active={progressActive >= 2}
                  label="In progress"
                  sub="Upcoming"
                  icon={ClipboardList}
                  muted
                />
                <ProgressStep
                  active={progressActive >= 3}
                  label="Completed"
                  sub="Upcoming"
                  icon={Package}
                  muted
                />
                <ProgressStep
                  active={progressActive >= 4}
                  label="Review"
                  sub="Upcoming"
                  icon={Star}
                  muted
                />
              </ol>
            </div>
          </section>

          {/* Booking details */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Booking details
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              <dl className="space-y-3">
                <DetailRow
                  icon={Wrench}
                  label="Service"
                  value={booking.serviceName}
                />
                <DetailRow
                  icon={Tag}
                  label="Booking type"
                  value={bookingTypeLabel}
                />
                <DetailRow
                  icon={CalendarDays}
                  label="Booking created"
                  value={formatLongDateTime(booking.createdAt)}
                />
                <DetailRow
                  icon={FileText}
                  label="Booking ID"
                  value={`BK-${booking.id.slice(-6).toUpperCase()}`}
                  mono
                />
                <DetailRow
                  icon={MapPin}
                  label="Source"
                  value={sourceLabel}
                  href={
                    booking.requestId
                      ? `/client/requests?requestId=${booking.requestId}`
                      : undefined
                  }
                  highlight={Boolean(booking.requestId)}
                />
              </dl>
              <dl className="space-y-3">
                <DetailRow
                  icon={UserRound}
                  label={
                    audience === "professional" ? "Client" : "Professional"
                  }
                  value={
                    audience === "professional"
                      ? booking.clientName
                      : booking.providerName
                  }
                  href="#"
                  highlight
                />
                <DetailRow
                  icon={UserRound}
                  label="Assigned to"
                  value={booking.assignmentName ?? "Assignment pending"}
                  muted={!booking.assignmentName}
                />
                <DetailRow
                  icon={MapPin}
                  label="Location"
                  value={locationTitle}
                />
                <DetailRow
                  icon={CreditCard}
                  label="Payment method"
                  value="Card ending in 4242"
                />
                <DetailRow
                  icon={DollarSign}
                  label="Total amount"
                  value={formatMoney(payment.total, payment.currency)}
                  strong
                />
              </dl>
            </div>
          </section>

          {/* Service & scope */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Service & scope
            </h2>
            <div className="mt-3 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-[0.72rem] font-semibold text-[#0b1e2e]">
                  Scope
                </p>
                <p className="mt-1 text-[0.76rem] leading-6 text-[#5f6c76]">
                  {booking.scope || "No scope provided."}
                </p>
              </div>
              <div>
                <p className="text-[0.72rem] font-semibold text-[#0b1e2e]">
                  Exclusions
                </p>
                <p className="mt-1 text-[0.76rem] leading-6 text-[#5f6c76]">
                  {booking.exclusions || "No exclusions."}
                </p>
              </div>
            </div>
            <Link
              href="#"
              className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#6b9f16] hover:underline"
            >
              View full scope & terms{" "}
              <ArrowLeft className="size-3 rotate-180" />
            </Link>
          </section>

          {/* Schedule + Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-[14px] border border-black/8 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
              <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
                Schedule
              </h2>
              <div className="mt-4 flex gap-4">
                <div className="grid h-24 w-[76px] shrink-0 place-items-center rounded-[12px] border border-black/8 bg-[#f8fafb] text-center">
                  {scheduleDate ? (
                    <>
                      <span className="text-[0.62rem] font-semibold uppercase tracking-wide text-[#6f7d8b]">
                        {scheduleDate
                          .toLocaleDateString("en-US", { weekday: "short" })
                          .toUpperCase()}
                      </span>
                      <span className="text-[1.7rem] font-semibold leading-none text-[#0b1e2e]">
                        {scheduleDate.getDate()}
                      </span>
                      <span className="text-[0.66rem] font-semibold uppercase text-[#5f8d11]">
                        {scheduleDate
                          .toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                          .toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <span className="text-[0.7rem] text-muted-foreground">
                      Not set
                    </span>
                  )}
                </div>
                <dl className="flex-1 space-y-2 text-[0.72rem]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6f7d8b]">Date</dt>
                    <dd className="font-medium text-[#0b1e2e]">
                      {scheduleDate ? formatScheduleDate(scheduleDate) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6f7d8b]">Time</dt>
                    <dd className="font-medium text-[#0b1e2e]">
                      {scheduleDate && endsAt
                        ? `${formatTimeRange(scheduleDate, endsAt)}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6f7d8b]">Duration</dt>
                    <dd className="font-medium text-[#0b1e2e]">
                      {duration} minutes
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6f7d8b]">Arrival window</dt>
                    <dd className="font-medium text-[#0b1e2e]">
                      {scheduleDate
                        ? `${formatArrivalWindow(scheduleDate)}`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="rounded-[14px] border border-black/8 bg-white p-4 sm:p-5 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
              <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
                Location
              </h2>
              <div className="mt-3">
                <p className="flex items-center gap-1.5 text-[0.76rem] font-medium text-[#0b1e2e]">
                  <MapPin className="size-3.5 text-[#6f7d8b]" /> {locationTitle}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-[0.74rem] leading-5 text-[#5f6c76]">
                  {locationDetail}
                </p>
                <Link
                  href="#"
                  className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#6b9f16] hover:underline"
                >
                  View on map <ArrowLeft className="size-3 rotate-180" />
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          {/* Current status */}
          <section className="rounded-[14px] border border-[#dbe8b8] bg-[#f6fae6] p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <p className="inline-flex items-center gap-1.5 text-[0.68rem] font-semibold text-[#5f6c76]">
              <span
                className={`size-2 rounded-full ${currentStatus.dot}`}
                aria-hidden="true"
              />{" "}
              Current status
            </p>
            <h2
              className={`mt-1 text-[1.15rem] font-semibold ${currentStatus.tone}`}
            >
              {currentStatus.title}
            </h2>
            <p className="mt-1 text-[0.74rem] leading-5 text-[#5f6c76]">
              {currentStatus.desc}
            </p>
            {scheduleDate && !isCancelled ? (
              <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-[#eef5c8] px-3 py-3">
                <span className="grid size-8 place-items-center rounded-full bg-white text-[#6b9f16]">
                  <Clock3 className="size-4" />
                </span>
                <div>
                  <p className="text-[0.78rem] font-semibold text-[#1d2f1d]">
                    {daysToGo === 0
                      ? "Today"
                      : daysToGo === 1
                        ? "1 day to go"
                        : daysToGo !== null
                          ? `${daysToGo} days to go`
                          : "Scheduled"}
                  </p>
                  <p className="text-[0.7rem] text-[#5f6c76]">
                    {formatScheduleDayTime(scheduleDate)}
                  </p>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (!scheduleDate || !endsAt) return;
                const ics = buildIcs(
                  booking.serviceName,
                  scheduleDate,
                  endsAt,
                  locationTitle,
                );
                const blob = new Blob([ics], {
                  type: "text/calendar;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `booking-${booking.id.slice(0, 8)}.ics`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              disabled={!scheduleDate}
              className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-black/8 bg-white px-4 text-[0.72rem] font-semibold text-[#1a2b3a] shadow-sm hover:bg-[#f7f9fa] disabled:opacity-50"
            >
              <CalendarDays className="size-4 text-[#6b9f16]" /> Add to calendar
            </button>
          </section>

          {/* Upcoming schedule */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Upcoming schedule
            </h2>
            <div className="mt-3 space-y-3">
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f3f5f7] text-[#3a4b5c]">
                  <CalendarDays className="size-4" />
                </span>
                <div>
                  <p className="text-[0.74rem] font-semibold text-[#0b1e2e]">
                    {scheduleDate
                      ? formatScheduleDay(scheduleDate)
                      : "No schedule yet"}
                  </p>
                  <p className="text-[0.72rem] text-[#5f6c76]">
                    {scheduleDate && endsAt
                      ? `${formatTimeRange(scheduleDate, endsAt)}`
                      : "—"}
                  </p>
                  <p className="text-[0.68rem] text-[#8a99a8]">
                    Service appointment
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f3f5f7] text-[#3a4b5c]">
                  <Bell className="size-4" />
                </span>
                <div>
                  <p className="text-[0.74rem] font-semibold text-[#0b1e2e]">
                    {scheduleDate
                      ? formatReminderDay(scheduleDate)
                      : "Reminder"}
                  </p>
                  <p className="text-[0.72rem] font-semibold text-[#5f6c76]">
                    Reminder
                  </p>
                  <p className="text-[0.68rem] text-[#8a99a8]">
                    You&apos;ll get a reminder
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="#"
              className="mt-3 inline-flex items-center gap-1 text-[0.72rem] font-semibold text-[#6b9f16] hover:underline"
            >
              View full schedule <ArrowLeft className="size-3 rotate-180" />
            </Link>
          </section>

          {/* Actions */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Actions
            </h2>
            <div className="mt-3 grid gap-2">
              <Button
                variant="outline"
                className="justify-center gap-2 rounded-full"
                onClick={() => setRescheduleOpen(true)}
                disabled={isCancelled || isCompleted}
              >
                <CalendarCheck className="size-4" /> Reschedule booking
              </Button>
              <Link
                href="/messages"
                className={buttonVariants({
                  variant: "outline",
                  className: "justify-center gap-2 rounded-full",
                })}
              >
                <MessageCircle className="size-4" /> Contact{" "}
                {audience === "client" ? "professional" : "client"}
              </Link>
              {!isCancelled && !isCompleted ? (
                <Button
                  variant="outline"
                  className="justify-center gap-2 rounded-full border-danger/20 text-danger hover:bg-danger/5"
                  onClick={() => setCancelOpen(true)}
                >
                  <Trash2 className="size-4" /> Cancel booking
                </Button>
              ) : null}
            </div>
            {audience === "professional" &&
            ["CONFIRMED", "RESCHEDULED"].includes(booking.status) ? (
              <div className="mt-4 border-t border-black/8 pt-4">
                <p className="text-[0.72rem] font-semibold text-[#0b1e2e]">
                  Service outcome
                </p>
                <p className="mt-1 text-[0.7rem] leading-5 text-[#5f6c76]">
                  Record the outcome only after the scheduled window has ended.
                </p>
                <div className="mt-3 grid gap-2">
                  <Button
                    loading={busy === "complete"}
                    onClick={() =>
                      void runAction("complete", {
                        lockVersion: booking.lockVersion,
                        note: "Service fulfilment completed.",
                      })
                    }
                    className="rounded-full"
                  >
                    Mark completed
                  </Button>
                  <Button
                    variant="outline"
                    loading={busy === "no-show"}
                    onClick={() =>
                      void runAction("no-show", {
                        lockVersion: booking.lockVersion,
                        note: "Client did not attend.",
                      })
                    }
                    className="rounded-full"
                  >
                    Record no-show
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {/* Payment summary */}
          <section className="rounded-[14px] border border-black/8 bg-white p-4 shadow-[0_4px_16px_rgba(15,31,43,0.04)]">
            <h2 className="text-[0.84rem] font-semibold text-[#0b1e2e]">
              Payment summary
            </h2>
            <dl className="mt-3 space-y-2 text-[0.74rem]">
              <div className="flex justify-between">
                <dt className="text-[#5f6c76]">Subtotal</dt>
                <dd className="font-medium text-[#0b1e2e]">
                  {formatMoney(payment.subtotal, payment.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5f6c76]">Tax (16%)</dt>
                <dd className="font-medium text-[#0b1e2e]">
                  {formatMoney(payment.tax, payment.currency)}
                </dd>
              </div>
              <div className="my-2 h-px bg-black/8" aria-hidden="true" />
              <div className="flex justify-between text-[0.78rem]">
                <dt className="font-semibold text-[#0b1e2e]">Total</dt>
                <dd className="font-semibold text-[#0b1e2e]">
                  {formatMoney(payment.total, payment.currency)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-[#dbe8b8] bg-[#f6fbdf] px-3 py-2 text-[0.72rem] font-semibold text-[#2e5a14]">
              <CircleCheck className="size-4 text-[#5f8d11]" /> Paid
            </div>
            {booking.paymentRequirements.length > 0 ? (
              <dl className="mt-3 space-y-1.5 border-t border-black/8 pt-3 text-[0.7rem]">
                {booking.paymentRequirements.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <dt className="text-[#5f6c76]">
                      {item.requirementType.toLowerCase()} ·{" "}
                      {item.status.toLowerCase()}
                    </dt>
                    <dd className="font-semibold">
                      {formatMoney(item.amountMinor, item.currency)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        </aside>
      </div>

      {/* Cancel modal */}
      <Sheet open={cancelOpen} onOpenChange={setCancelOpen}>
        <SheetContent
          className="flex h-full w-[min(28rem,92vw)] flex-col p-0"
          aria-describedby="booking-cancel-description"
        >
          <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6 pr-10">
            <SheetTitle className="text-lg font-semibold">
              Cancel booking
            </SheetTitle>
            <SheetDescription
              id="booking-cancel-description"
              className="mt-1 text-xs text-muted-foreground"
            >
              Share a brief reason. This will be recorded in schedule history
              and visible to the other party.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div>
              <label
                htmlFor="booking-cancel-reason-page"
                className="text-xs font-medium text-muted-foreground"
              >
                Reason for cancellation
              </label>
              <textarea
                id="booking-cancel-reason-page"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for cancellation"
                className="mt-2 min-h-24 w-full rounded-xl border border-black/10 bg-white p-3 text-sm outline-none focus:border-ring"
              />
              <p className="mt-2 text-[0.68rem] text-muted-foreground">
                Minimum 3 characters.
              </p>
            </div>
            {actionError && busy === "cancel" ? (
              <InlineAlert
                variant="error"
                title="Cancellation failed"
                description={actionError}
              />
            ) : null}
            <InlineAlert
              variant="info"
              title="Policy"
              description={booking.cancellationPolicy}
            />
          </div>
          <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setCancelOpen(false)}
              disabled={busy === "cancel"}
            >
              Keep booking
            </Button>
            <Button
              className="flex-1"
              disabled={reason.trim().length < 3 || busy === "cancel"}
              loading={busy === "cancel"}
              onClick={() =>
                void runAction("cancel", {
                  lockVersion: booking.lockVersion,
                  reason: reason.trim(),
                  cancellationPolicyAcknowledged: true,
                })
              }
            >
              Confirm cancellation
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reschedule modal with slots */}
      <Sheet open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <SheetContent
          className="flex h-full w-[min(30rem,94vw)] flex-col p-0"
          aria-describedby="booking-reschedule-description"
        >
          <div className="shrink-0 border-b border-black/7 px-6 pb-5 pt-6 pr-10">
            <SheetTitle className="text-lg font-semibold">
              {audience === "client"
                ? booking.status === "CONFIRMED" ||
                  booking.status === "RESCHEDULED"
                  ? "Request new time"
                  : booking.requestedStartAt
                    ? "Update time request"
                    : "Choose a time"
                : booking.status === "RESCHEDULE_REQUESTED"
                  ? "Review requested time"
                  : "Confirm schedule"}
            </SheetTitle>
            <SheetDescription
              id="booking-reschedule-description"
              className="mt-1 text-xs text-muted-foreground"
            >
              Times are checked against working hours, unavailable periods, and
              active reservations.
            </SheetDescription>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {needsSlots && slots === null ? (
              <p className="text-sm text-[#68717b]">Loading availability…</p>
            ) : null}
            {needsSlots && slots?.length === 0 ? (
              <InlineAlert
                variant="warning"
                title="No eligible slots"
                description="The professional needs to publish working hours or clear an existing conflict."
              />
            ) : null}
            {needsSlots && slots && slots.length > 0 ? (
              <div
                className="max-h-[50vh] space-y-2 overflow-y-auto pr-1"
                role="radiogroup"
                aria-label="Available booking times"
              >
                {slots.slice(0, 40).map((slot) => (
                  <label
                    key={`${slot.membershipId}-${slot.startsAt}`}
                    className={`block cursor-pointer rounded-xl border p-3 text-sm ${selectedSlot?.membershipId === slot.membershipId && selectedSlot.startsAt === slot.startsAt ? "border-[#8eb81d] bg-[#f7fbdc]" : "border-black/8"}`}
                  >
                    <input
                      type="radio"
                      name="booking-slot-page"
                      className="sr-only"
                      checked={
                        selectedSlot?.membershipId === slot.membershipId &&
                        selectedSlot.startsAt === slot.startsAt
                      }
                      onChange={() => setSelectedSlot(slot)}
                    />
                    <span className="font-semibold">
                      {new Date(slot.startsAt).toLocaleString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="mt-1 block text-xs text-[#68717b]">
                      {slot.memberName}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {audience === "client" &&
            ["CONFIRMED", "RESCHEDULED"].includes(booking.status) ? (
              <div>
                <label
                  htmlFor="reschedule-reason-page"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Reason for reschedule
                </label>
                <textarea
                  id="reschedule-reason-page"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Why do you need another time?"
                  className="mt-2 min-h-20 w-full rounded-xl border border-black/10 p-3 text-sm outline-none focus:border-ring"
                />
              </div>
            ) : null}
            {actionError ? (
              <InlineAlert
                variant="error"
                title="Time request not sent"
                description={actionError}
              />
            ) : null}
            {audience === "client" &&
            booking.status === "PENDING_CONFIRMATION" &&
            booking.requestedStartAt ? (
              <InlineAlert
                variant="success"
                title="Time request sent"
                description="The professional still needs to confirm this time. Choose a different slot only if you want to update your request."
              />
            ) : null}
          </div>
          <div className="shrink-0 border-t border-black/8 bg-white px-6 py-4">
            <ScheduleActionButton
              audience={audience}
              booking={booking}
              selectedSlot={selectedSlot}
              busy={busy}
              reason={rescheduleReason}
              runAction={runAction}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ProgressStep({
  active,
  label,
  sub,
  icon: Icon,
  muted,
}: {
  active: boolean;
  label: string;
  sub: string;
  icon: React.ElementType;
  muted?: boolean;
}) {
  return (
    <li className="flex flex-col items-center text-center">
      <span
        className={`grid size-9 place-items-center rounded-full border ${active ? "border-[#8eb81d] bg-[#8eb81d] text-white shadow-sm" : "border-black/10 bg-[#f3f5f7] text-[#8a99a8]"}`}
      >
        <Icon className="size-4" />
      </span>
      <span
        className={`mt-2 text-[0.68rem] font-semibold leading-none ${active ? "text-[#1a2b12]" : muted ? "text-[#8a99a8]" : "text-[#1a2b12]"}`}
      >
        {label}
      </span>
      <span
        className={`mt-1 text-[0.62rem] leading-none ${muted && !active ? "text-[#8a99a8]" : "text-[#6f7d8b]"}`}
      >
        {sub}
      </span>
    </li>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
  highlight,
  mono,
  muted,
  strong,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  href?: string;
  highlight?: boolean;
  mono?: boolean;
  muted?: boolean;
  strong?: boolean;
}) {
  const content = href ? (
    <Link
      href={href}
      className={
        highlight
          ? "font-medium text-[#6b9f16] hover:underline"
          : "hover:underline"
      }
    >
      {value}
    </Link>
  ) : (
    <span
      className={`${mono ? "font-mono text-[0.72rem]" : ""} ${strong ? "font-semibold text-[#0b1e2e]" : highlight ? "font-medium text-[#6b9f16]" : muted ? "text-[#8a99a8]" : "text-[#0b1e2e]"}`}
    >
      {value}
    </span>
  );
  return (
    <div className="flex gap-3 text-[0.72rem]">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#f3f5f7] text-[#5f6c76]">
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-medium text-[#6f7d8b]">
          {label}
        </span>
        <span className="mt-0.5 block font-medium">{content}</span>
      </span>
    </div>
  );
}

function ScheduleActionButton({
  audience,
  booking,
  selectedSlot,
  busy,
  reason,
  runAction,
}: {
  audience: "client" | "professional";
  booking: BookingDetailContract;
  selectedSlot: BookingSlot | null;
  busy: string | null;
  reason: string;
  runAction: (action: string, body: Record<string, unknown>) => Promise<void>;
}) {
  if (audience === "client") {
    const reschedule = ["CONFIRMED", "RESCHEDULED"].includes(booking.status);
    const hasPending =
      booking.status === "PENDING_CONFIRMATION" &&
      Boolean(booking.requestedStartAt && booking.requestedMembershipId);
    const selectedPending =
      hasPending &&
      selectedSlot?.startsAt === booking.requestedStartAt &&
      selectedSlot.membershipId === booking.requestedMembershipId;
    return (
      <Button
        className="w-full rounded-full"
        disabled={
          !selectedSlot ||
          !!selectedPending ||
          (reschedule && reason.trim().length < 3)
        }
        loading={
          busy === (reschedule ? "reschedule-request" : "schedule-request")
        }
        onClick={() =>
          selectedSlot &&
          !selectedPending &&
          void runAction(
            reschedule ? "reschedule-request" : "schedule-request",
            {
              lockVersion: booking.lockVersion,
              membershipId: selectedSlot.membershipId,
              startsAt: selectedSlot.startsAt,
              cancellationPolicyAcknowledged: true,
              ...(reschedule ? { reason } : {}),
            },
          )
        }
      >
        {selectedPending
          ? "Time requested"
          : reschedule
            ? "Request reschedule"
            : hasPending
              ? "Update time request"
              : "Request this time"}
      </Button>
    );
  }
  const reschedule = booking.status === "RESCHEDULE_REQUESTED";
  const requestedSlot =
    booking.requestedStartAt && booking.requestedMembershipId
      ? {
          membershipId: booking.requestedMembershipId,
          startsAt: booking.requestedStartAt,
        }
      : null;
  const slot = selectedSlot ?? requestedSlot;
  return (
    <Button
      className="w-full rounded-full"
      disabled={!slot}
      loading={busy === (reschedule ? "reschedule" : "confirm")}
      onClick={() =>
        slot &&
        void runAction(reschedule ? "reschedule" : "confirm", {
          lockVersion: booking.lockVersion,
          membershipId: slot.membershipId,
          startsAt: slot.startsAt,
          cancellationPolicyAcknowledged: true,
        })
      }
    >
      {reschedule ? "Accept requested time" : "Confirm booking"}
    </Button>
  );
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function formatLongDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
function formatScheduleDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function formatScheduleDay(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatScheduleDayTime(d: Date) {
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} • ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function formatReminderDay(d: Date) {
  const r = new Date(d.getTime() - 86400000);
  return r.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatTimeRange(s: Date, e: Date) {
  return `${s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function formatArrivalWindow(s: Date) {
  const a = new Date(s.getTime() - 30 * 60000);
  const b = new Date(s.getTime() + 30 * 60000);
  return `${a.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${b.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
function formatReqId(id: string | null) {
  return id ? `REQ-${id.slice(-4).toUpperCase()}-7821`.slice(0, 12) : "—";
}
function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  })
    .format(amountMinor / 100)
    .replace("KES", "KSh");
}
function buildIcs(title: string, start: Date, end: Date, location: string) {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Veterans Bay//Booking//EN\r\nBEGIN:VEVENT\r\nUID:${start.getTime()}@veterans-bay\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(start)}\r\nDTEND:${fmt(end)}\r\nSUMMARY:${title}\r\nLOCATION:${location}\r\nDESCRIPTION:Service appointment\r\nEND:VEVENT\r\nEND:VCALENDAR`;
}
