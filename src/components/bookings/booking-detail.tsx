"use client";

import {
  ArrowLeft,
  CalendarCheck2,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type {
  BookingDetail as BookingDetailContract,
  BookingSlot,
} from "@/modules/bookings/types";
import {
  bookingAction,
  getBooking,
  getBookingSlots,
} from "./booking-api";

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
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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
    try {
      const updated = await bookingAction(
        audience,
        booking.id,
        action,
        body,
      );
      setBooking(updated);
      setPendingAction(null);
      setReason("");
      setSelectedSlot(null);
      if (
        !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(updated.status)
      ) {
        setSlots(await getBookingSlots(audience, booking.id));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Booking action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!booking && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading booking"
        description="Retrieving schedule, assignment, policy, and history."
      />
    );
  }

  const backPath =
    audience === "client" ? "/client/bookings" : "/professional/bookings";

  return (
    <div>
      <Link
        href={backPath}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" /> Back to bookings
      </Link>
      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Booking needs attention"
          description={error}
        />
      ) : null}
      {booking ? (
        <>
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#5f8d11]">
                  Service booking
                </p>
                <Badge
                  variant={
                    booking.status === "CANCELLED"
                      ? "danger"
                      : ["CONFIRMED", "RESCHEDULED", "COMPLETED"].includes(
                            booking.status,
                          )
                        ? "trust"
                        : "warning"
                  }
                >
                  {booking.status.replaceAll("_", " ")}
                </Badge>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
                {booking.serviceName}
              </h1>
              <p className="mt-2 text-sm text-[#68717b]">
                {booking.providerName} · {booking.clientName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">
                {formatMoney(booking.totalMinor, booking.currency)}
              </p>
              {audience === "client" && booking.status === "COMPLETED" ? (
                <Link
                  className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-3`}
                  href={`/client/bookings/new?sourceBookingId=${booking.id}`}
                >
                  Book again
                </Link>
              ) : null}
            </div>
          </div>

          {booking.status === "PENDING_DEPOSIT" ? (
            <InlineAlert
              className="mt-5"
              variant="warning"
              title="Deposit required before confirmation"
              description="The booking can collect a requested time, but confirmation remains blocked until the deposit requirement is satisfied or waived by the later payment workflow."
            />
          ) : null}

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="space-y-5">
              <Surface className="p-5 shadow-none sm:p-6">
                <h2 className="text-lg font-bold">Schedule</h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <ScheduleValue
                    icon={<CalendarCheck2 className="size-4" />}
                    label="Confirmed time"
                    value={
                      booking.startsAt
                        ? formatDateTime(booking.startsAt)
                        : "Not confirmed"
                    }
                  />
                  <ScheduleValue
                    icon={<CalendarClock className="size-4" />}
                    label="Requested time"
                    value={
                      booking.requestedStartAt
                        ? formatDateTime(booking.requestedStartAt)
                        : "No pending request"
                    }
                  />
                  <ScheduleValue
                    icon={<Clock3 className="size-4" />}
                    label="Duration"
                    value={`${booking.expectedDurationMinutes} minutes`}
                  />
                  <ScheduleValue
                    icon={<UserRound className="size-4" />}
                    label="Assigned professional"
                    value={booking.assignmentName ?? "Assignment pending"}
                  />
                </div>
              </Surface>

              <Surface className="p-5 shadow-none sm:p-6">
                <h2 className="text-lg font-bold">Scope and terms</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Term label="Scope" value={booking.scope} />
                  <Term label="Exclusions" value={booking.exclusions} />
                  <Term label="Warranty" value={booking.warrantyTerms} />
                  <Term label="Payment" value={booking.paymentTerms} />
                </div>
              </Surface>

              <Surface className="p-5 shadow-none sm:p-6">
                <h2 className="text-lg font-bold">Schedule history</h2>
                {booking.history.length === 0 ? (
                  <p className="mt-4 text-sm text-[#68717b]">
                    No schedule changes have been recorded.
                  </p>
                ) : (
                  <ol className="mt-5 space-y-4 border-l border-black/10 pl-5">
                    {booking.history.map((item) => (
                      <li key={item.id}>
                        <p className="text-sm font-semibold">
                          {item.action.replaceAll("_", " ").toLowerCase()}
                        </p>
                        <p className="mt-1 text-xs text-[#7a838c]">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                        {item.startsAt ? (
                          <p className="mt-2 text-sm text-[#59646e]">
                            {formatDateTime(item.startsAt)}
                          </p>
                        ) : null}
                        {item.note ? (
                          <p className="mt-2 text-sm leading-6 text-[#59646e]">
                            {item.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </Surface>
            </div>

            <aside className="space-y-5">
              {needsSlots ? (
                <Surface className="p-5 shadow-none">
                  <h2 className="font-bold">
                    {audience === "client"
                      ? booking.status === "CONFIRMED" ||
                        booking.status === "RESCHEDULED"
                        ? "Request another time"
                        : "Choose a time"
                      : booking.status === "RESCHEDULE_REQUESTED"
                        ? "Review requested time"
                        : "Confirm schedule"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#68717b]">
                    Times are checked against working hours, unavailable periods,
                    and active reservations.
                  </p>
                  {slots === null ? (
                    <p className="mt-4 text-sm text-[#68717b]">
                      Loading availability…
                    </p>
                  ) : slots.length === 0 ? (
                    <InlineAlert
                      className="mt-4"
                      variant="warning"
                      title="No eligible slots"
                      description="The professional needs to publish working hours or clear an existing conflict."
                    />
                  ) : (
                    <div
                      className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1"
                      role="radiogroup"
                      aria-label="Available booking times"
                    >
                      {slots.slice(0, 40).map((slot) => (
                        <label
                          key={`${slot.membershipId}-${slot.startsAt}`}
                          className={`block cursor-pointer rounded-xl border p-3 text-sm ${
                            selectedSlot?.membershipId === slot.membershipId &&
                            selectedSlot.startsAt === slot.startsAt
                              ? "border-[#8eb81d] bg-[#f7fbdc]"
                              : "border-black/8"
                          }`}
                        >
                          <input
                            type="radio"
                            name="booking-slot"
                            className="sr-only"
                            checked={
                              selectedSlot?.membershipId ===
                                slot.membershipId &&
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
                  )}

                  {audience === "client" &&
                  ["CONFIRMED", "RESCHEDULED"].includes(booking.status) ? (
                    <textarea
                      className="mt-4 min-h-24 w-full rounded-xl border border-black/10 p-3 text-sm"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why do you need another time?"
                      aria-label="Reschedule reason"
                    />
                  ) : null}

                  <ScheduleAction
                    audience={audience}
                    booking={booking}
                    selectedSlot={selectedSlot}
                    busy={busy}
                    reason={reason}
                    runAction={runAction}
                  />
                </Surface>
              ) : null}

              {audience === "professional" &&
              ["CONFIRMED", "RESCHEDULED"].includes(booking.status) ? (
                <Surface className="p-5 shadow-none">
                  <h2 className="font-bold">Service outcome</h2>
                  <p className="mt-2 text-sm leading-6 text-[#68717b]">
                    Record the outcome only after the scheduled service window
                    has ended.
                  </p>
                  <ProfessionalOutcomeActions
                    booking={booking}
                    busy={busy}
                    runAction={runAction}
                  />
                </Surface>
              ) : null}

              <Surface className="p-5 shadow-none">
                <h2 className="font-bold">Cancellation policy</h2>
                <p className="mt-3 text-sm leading-6 text-[#68717b]">
                  {booking.cancellationPolicy}
                </p>
                {!["CANCELLED", "COMPLETED", "NO_SHOW"].includes(
                  booking.status,
                ) ? (
                  pendingAction === "cancel" ? (
                    <div className="mt-4">
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-black/10 p-3 text-sm"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Reason for cancellation"
                        aria-label="Cancellation reason"
                      />
                      <div className="mt-3 grid gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setPendingAction(null)}
                        >
                          Keep booking
                        </Button>
                        <Button
                          variant="outline"
                          className="border-danger/30 text-danger"
                          disabled={reason.trim().length < 3}
                          loading={busy === "cancel"}
                          onClick={() =>
                            void runAction("cancel", {
                              lockVersion: booking.lockVersion,
                              reason,
                              cancellationPolicyAcknowledged: true,
                            })
                          }
                        >
                          Confirm cancellation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="mt-4 w-full border-danger/30 text-danger"
                      variant="outline"
                      onClick={() => setPendingAction("cancel")}
                    >
                      Cancel booking
                    </Button>
                  )
                ) : null}
              </Surface>

              {booking.paymentRequirements.length > 0 ? (
                <Surface className="p-5 shadow-none">
                  <h2 className="flex items-center gap-2 font-bold">
                    <CircleDollarSign className="size-4 text-[#5f8d11]" />
                    Payment requirements
                  </h2>
                  <dl className="mt-4 space-y-3">
                    {booking.paymentRequirements.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <dt>
                          {item.requirementType.toLowerCase()} ·{" "}
                          {item.status.toLowerCase()}
                        </dt>
                        <dd className="font-semibold">
                          {formatMoney(item.amountMinor, item.currency)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Surface>
              ) : null}
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ScheduleAction({
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
  runAction: (
    action: string,
    body: Record<string, unknown>,
  ) => Promise<void>;
}) {
  if (audience === "client") {
    const reschedule = ["CONFIRMED", "RESCHEDULED"].includes(booking.status);
    return (
      <Button
        className="mt-4 w-full"
        disabled={!selectedSlot || (reschedule && reason.trim().length < 3)}
        loading={busy === (reschedule ? "reschedule-request" : "schedule-request")}
        onClick={() =>
          selectedSlot &&
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
        {reschedule ? "Request reschedule" : "Request this time"}
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
    <div className="mt-4 grid gap-2">
      <Button
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
    </div>
  );
}

function ProfessionalOutcomeActions({
  booking,
  busy,
  runAction,
}: {
  booking: BookingDetailContract;
  busy: string | null;
  runAction: (
    action: string,
    body: Record<string, unknown>,
  ) => Promise<void>;
}) {
  return (
    <div className="mt-4 grid gap-2">
      <Button
        loading={busy === "complete"}
        onClick={() =>
          void runAction("complete", {
            lockVersion: booking.lockVersion,
            note: "Service fulfilment completed.",
          })
        }
      >
        Mark completed
      </Button>
      <Button
        variant="outline"
        loading={busy === "no-show"}
        onClick={() =>
          void runAction("no-show", {
            lockVersion: booking.lockVersion,
            note: "Client did not attend the scheduled service.",
          })
        }
      >
        Record no-show
      </Button>
    </div>
  );
}

function ScheduleValue({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f7f9fa] p-4">
      <p className="flex items-center gap-2 text-xs text-[#68717b]">
        {icon} {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#59646e]">
        {value}
      </p>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
