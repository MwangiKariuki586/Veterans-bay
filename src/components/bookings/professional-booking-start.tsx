"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bookingApi, getBooking } from "./booking-api";
import { catalogueApi } from "@/components/professional-services/catalogue-api";
import { getCustomer } from "@/components/customers/customer-api";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { BookingDetail } from "@/modules/bookings/types";
import type { CustomerDetail } from "@/modules/customers/types";
import type { ProfessionalServiceSummary } from "@/modules/professional-services/types";

interface TeamMember {
  id: string;
  name: string;
  status: string;
}
export function ProfessionalBookingStart({
  customerId,
  sourceBookingId,
}: {
  customerId?: string;
  sourceBookingId?: string;
}) {
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [source, setSource] = useState<BookingDetail | null>(null);
  const [services, setServices] = useState<ProfessionalServiceSummary[] | null>(
    null,
  );
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!customerId) return;
    void Promise.all([
      getCustomer(customerId),
      sourceBookingId
        ? getBooking("professional", sourceBookingId)
        : Promise.resolve(null),
      catalogueApi<ProfessionalServiceSummary[]>(
        "/api/v1/professional/services",
      ),
      bookingApi<{ members: TeamMember[] }>("/api/v1/professional/team"),
    ])
      .then(([customerData, sourceData, serviceData, teamData]) => {
        setCustomer(customerData);
        setSource(sourceData);
        const eligible = serviceData.filter(
          (item) =>
            item.status === "published" &&
            item.directBookingEnabled &&
            item.pricingModel !== "custom_quote" &&
            item.priceMinor != null &&
            item.estimatedDurationMinutes != null,
        );
        setServices(eligible);
        setTeam(
          teamData.members.filter((member) => member.status === "active"),
        );
        setServiceId(
          sourceData?.professionalServiceId ?? eligible[0]?.id ?? "",
        );
        setMembershipId(
          teamData.members.find((member) => member.status === "active")?.id ??
            "",
        );
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Booking context is unavailable.",
        ),
      );
  }, [customerId, sourceBookingId]);
  const service = useMemo(
    () => services?.find((item) => item.id === serviceId) ?? null,
    [serviceId, services],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!customer?.accountProfileId || !service || !membershipId) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await bookingApi<BookingDetail>(
        "/api/v1/professional/bookings",
        {
          method: "POST",
          body: JSON.stringify(
            sourceBookingId
              ? {
                  origin: "REPEAT_BOOKING",
                  customerId: customer.id,
                  sourceBookingId,
                  serviceId: service.id,
                  membershipId,
                  requestedStartAt: new Date(startsAt).toISOString(),
                  timezone: "Africa/Nairobi",
                  cancellationPolicyAcknowledged: true,
                }
              : {
                  origin: "PROFESSIONAL_CUSTOMER",
                  clientAccountId: customer.accountProfileId,
                  serviceId: service.id,
                  membershipId,
                  requestedStartAt: new Date(startsAt).toISOString(),
                  timezone: "Africa/Nairobi",
                  cancellationPolicyAcknowledged: true,
                },
          ),
        },
      );
      router.push(`/professional/bookings/${booking.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Booking could not be created.",
      );
      setBusy(false);
    }
  }
  if (!customerId)
    return (
      <StatePanel
        variant="error"
        title="Booking unavailable"
        description="Choose a registered customer before creating a booking."
      />
    );
  if (!customer && !error)
    return (
      <StatePanel
        variant="loading"
        title="Loading booking context"
        description="Revalidating the current customer, service, and team."
      />
    );
  if (!customer)
    return (
      <StatePanel
        variant="error"
        title="Booking unavailable"
        description={error ?? "Customer unavailable."}
      />
    );
  if (!customer.accountProfileId)
    return (
      <StatePanel
        title="Registration required"
        description="Invite and reconcile this customer before creating an in-app booking."
      />
    );
  if (sourceBookingId && source?.status !== "COMPLETED")
    return (
      <StatePanel
        title="Repeat booking unavailable"
        description="Only completed service history can start repeat work."
      />
    );
  if (
    sourceBookingId &&
    source?.professionalServiceId &&
    !services?.some((item) => item.id === source.professionalServiceId)
  )
    return (
      <StatePanel
        title="Service unavailable"
        description="The previous service is no longer currently bookable. Start a new request or choose another published service."
      />
    );
  const currentMinor = service?.priceMinor ?? 0;
  const priceChanged = source && currentMinor !== source.totalMinor;
  return (
    <Surface className="max-w-3xl p-6 shadow-none">
      <p className="text-sm font-semibold text-[#5f8d11]">
        {sourceBookingId ? "Repeat booking" : "Existing customer booking"}
      </p>
      <h2 className="mt-2 text-2xl font-bold">{customer.displayName}</h2>
      <p className="mt-2 text-sm text-[#68717b]">
        Current catalogue terms and availability are authoritative. Historical
        prices are reference only.
      </p>
      {priceChanged ? (
        <InlineAlert
          className="mt-4"
          variant="warning"
          title="Price changed"
          description="The current published service price differs from the previous booking. Review it before continuing."
        />
      ) : null}
      {error ? (
        <InlineAlert
          className="mt-4"
          variant="error"
          title="Booking needs attention"
        >
          {error}
        </InlineAlert>
      ) : null}
      <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Current service
          <select
            className="mt-1 min-h-11 w-full rounded-2xl border border-black/8 bg-white px-4"
            required
            value={serviceId}
            onChange={(event) => setServiceId(event.target.value)}
          >
            {services?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ·{" "}
                {new Intl.NumberFormat("en-KE", {
                  style: "currency",
                  currency: item.currency,
                  maximumFractionDigits: 0,
                }).format((item.priceMinor ?? 0) / 100)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Assigned team member
          <select
            className="mt-1 min-h-11 w-full rounded-2xl border border-black/8 bg-white px-4"
            required
            value={membershipId}
            onChange={(event) => setMembershipId(event.target.value)}
          >
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Requested start
          <input
            className="mt-1 min-h-11 w-full rounded-2xl border border-black/8 px-4"
            type="datetime-local"
            required
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </label>
        <Button type="submit" loading={busy}>
          Create booking with current terms
        </Button>
      </form>
    </Surface>
  );
}
