"use client";

import { ArrowLeft, CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { BookingDetail, BookingSlot } from "@/modules/bookings/types";
import {
  createClientBooking,
  getBooking,
  getBookingSlots,
  getDirectServiceSlots,
} from "./booking-api";

const cancellationPolicy =
  "Cancel or request a reschedule at least 24 hours before the scheduled start. Later changes may affect the deposit record.";

export function BookingStart({
  professionalSlug,
  serviceSlug,
  serviceName,
  providerName,
  sourceBookingId,
}: {
  professionalSlug?: string;
  serviceSlug?: string;
  serviceName?: string;
  providerName?: string;
  sourceBookingId?: string;
}) {
  const router = useRouter();
  const [source, setSource] = useState<BookingDetail | null>(null);
  const [slots, setSlots] = useState<BookingSlot[] | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<BookingSlot | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = sourceBookingId
      ? Promise.all([
          getBooking("client", sourceBookingId),
          getBookingSlots("client", sourceBookingId),
        ]).then(([booking, availableSlots]) => {
          if (booking.status !== "COMPLETED") {
            throw new Error(
              "Only completed bookings can be booked again.",
            );
          }
          setSource(booking);
          return availableSlots;
        })
      : professionalSlug && serviceSlug
        ? getDirectServiceSlots(professionalSlug, serviceSlug)
        : Promise.reject(new Error("Choose an eligible service to book."));
    void load
      .then(setSlots)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Availability unavailable.",
        ),
      );
  }, [professionalSlug, serviceSlug, sourceBookingId]);

  async function createBooking() {
    if (!selectedSlot || !acknowledged) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await createClientBooking(
        sourceBookingId
          ? {
              origin: "REPEAT_BOOKING",
              sourceBookingId,
              membershipId: selectedSlot.membershipId,
              requestedStartAt: selectedSlot.startsAt,
              timezone: selectedSlot.timezone,
              cancellationPolicyAcknowledged: true,
            }
          : {
              origin: "DIRECT_SERVICE",
              professionalSlug,
              serviceSlug,
              membershipId: selectedSlot.membershipId,
              requestedStartAt: selectedSlot.startsAt,
              timezone: selectedSlot.timezone,
              cancellationPolicyAcknowledged: true,
            },
      );
      router.push(`/client/bookings/${booking.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The booking was not created.",
      );
      setBusy(false);
    }
  }

  const resolvedServiceName =
    source?.serviceName ?? serviceName ?? "Selected service";
  const resolvedProviderName =
    source?.providerName ?? providerName ?? "Professional";

  return (
    <div>
      <Link
        href={sourceBookingId ? `/client/bookings/${sourceBookingId}` : "/marketplace"}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b]"
      >
        <ArrowLeft className="size-4" />{" "}
        {sourceBookingId ? "Back to booking" : "Back to marketplace"}
      </Link>
      <div className="mt-5">
        <p className="text-sm font-semibold text-[#5f8d11]">
          {sourceBookingId ? "Repeat booking" : "Direct booking"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-title">
          Choose an eligible time
        </h1>
        <p className="mt-2 text-sm text-[#68717b]">
          {resolvedServiceName} with {resolvedProviderName}
        </p>
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Booking needs attention"
          description={error}
        />
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Surface className="p-5 shadow-none sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="size-5 text-[#5f8d11]" />
            Available times
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#68717b]">
            These times respect published working hours, unavailable periods,
            service duration, and confirmed reservations.
          </p>
          {error ? null : slots === null ? (
            <StatePanel
              className="mt-5"
              variant="loading"
              title="Checking availability"
              description="Finding eligible times across the professional team."
            />
          ) : slots?.length === 0 ? (
            <StatePanel
              className="mt-5"
              title="No eligible times"
              description="This professional has no open times in the next fourteen days. Try again later or send a service request."
            />
          ) : (
            <div
              className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              role="radiogroup"
              aria-label="Eligible booking times"
            >
              {slots?.slice(0, 60).map((slot) => {
                const selected =
                  selectedSlot?.membershipId === slot.membershipId &&
                  selectedSlot.startsAt === slot.startsAt;
                return (
                  <label
                    key={`${slot.membershipId}-${slot.startsAt}`}
                    className={`cursor-pointer rounded-2xl border p-4 ${
                      selected
                        ? "border-[#8eb81d] bg-[#f7fbdc]"
                        : "border-black/8 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="booking-start-slot"
                      className="sr-only"
                      checked={selected}
                      onChange={() => setSelectedSlot(slot)}
                    />
                    <span className="block text-sm font-bold">
                      {new Date(slot.startsAt).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="mt-2 flex items-center gap-1 text-sm text-[#59646e]">
                      <Clock3 className="size-3.5" />
                      {new Date(slot.startsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="mt-2 block text-xs text-[#7a838c]">
                      {slot.memberName}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Surface>

        <aside>
          <Surface className="p-5 shadow-none">
            <h2 className="flex items-center gap-2 font-bold">
              <ShieldCheck className="size-4 text-[#5f8d11]" />
              Confirm your request
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#68717b]">
              {selectedSlot
                ? new Date(selectedSlot.startsAt).toLocaleString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Choose an available time to continue."}
            </p>
            <label className="mt-5 flex items-start gap-3 rounded-2xl bg-[#f7f9fa] p-4 text-sm leading-6">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              <span>
                I acknowledge the cancellation policy: {cancellationPolicy}
              </span>
            </label>
            <Button
              className="mt-5 w-full"
              disabled={!selectedSlot || !acknowledged}
              loading={busy}
              onClick={() => void createBooking()}
            >
              Create booking
            </Button>
            <p className="mt-3 text-xs leading-5 text-[#7a838c]">
              The professional will confirm the requested time. Any deposit
              requirement remains visible before confirmation.
            </p>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
