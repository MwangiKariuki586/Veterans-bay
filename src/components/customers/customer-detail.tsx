"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type {
  CustomerBalance,
  CustomerDetail as Detail,
} from "@/modules/customers/types";
import {
  cancelReminder,
  customerAction,
  getCustomer,
  getCustomerBalance,
  listReminders,
  scheduleReminder,
  type ReminderItem,
} from "./customer-api";

export function CustomerDetail({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Detail | null>(null);
  const [balance, setBalance] = useState<CustomerBalance | null>(null);
  const [note, setNote] = useState("");
  const [tag, setTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [reminderReason, setReminderReason] = useState("");
  const [reminderDueAt, setReminderDueAt] = useState("");
  useEffect(() => {
    void getCustomer(customerId)
      .then(setCustomer)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Customer unavailable."),
      );
    void getCustomerBalance(customerId)
      .then(setBalance)
      .catch(() => undefined);
    void listReminders(customerId).then(setReminders).catch(() => undefined);
  }, [customerId]);
  async function act(action: string, values?: Record<string, unknown>) {
    try {
      setCustomer(await customerAction(customerId, action, values));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    }
  }
  if (error && !customer)
    return (
      <StatePanel
        variant="error"
        title="Customer unavailable"
        description={error}
      />
    );
  if (!customer)
    return (
      <StatePanel
        variant="loading"
        title="Loading customer"
        description="Retrieving private customer history."
      />
    );
  const money = (minor: number) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: balance?.currency ?? "KES",
      maximumFractionDigits: 0,
    }).format(minor / 100);
  async function addReminder(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await scheduleReminder(
        customerId,
        reminderReason,
        new Date(reminderDueAt).toISOString(),
      );
      setReminders((current) => [...current, created]);
      setReminderReason("");
      setReminderDueAt("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Reminder could not be scheduled.",
      );
    }
  }
  return (
    <div className="space-y-5">
      {error ? (
        <InlineAlert variant="error" title="Action failed">
          {error}
        </InlineAlert>
      ) : null}
      <Surface className="p-6 shadow-none">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#5f8d11]">
              {customer.status.replaceAll("_", " ")}
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{customer.displayName}</h1>
            <p className="mt-2 text-sm text-[#68717b]">
              {customer.email ?? customer.phone}
            </p>
            <p className="mt-2 text-xs text-[#68717b]">
              Origin: {customer.acquisitionSource.replaceAll("_", " ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/professional/bookings/new?customerId=${customer.id}`}
              className={cn(buttonVariants())}
            >
              Create booking
            </Link>
            {customer.status !== "REGISTERED" && customer.email ? (
              <Button variant="outline" onClick={() => void act("invite")}>
                Invite customer
              </Button>
            ) : null}
            {customer.email && !customer.accountProfileId ? (
              <Button variant="outline" onClick={() => void act("reconcile")}>
                Check registration
              </Button>
            ) : null}
          </div>
        </div>
        {customer.duplicateOfCustomerId ? (
          <InlineAlert
            className="mt-4"
            variant="warning"
            title="Possible duplicate"
            description="This contact matches an existing organisation customer. Review both records before proceeding."
          />
        ) : null}
      </Surface>
      {balance ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Invoiced" value={money(balance.invoiceTotalMinor)} />
          <Metric label="Paid" value={money(balance.paidMinor)} />
          <Metric label="Outstanding" value={money(balance.outstandingMinor)} />
        </div>
      ) : (
        <InlineAlert
          variant="info"
          title="Financial details restricted"
          description="Balances are shown only to roles with payment visibility."
        />
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Surface className="p-5 shadow-none">
          <h2 className="font-semibold">Private notes</h2>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act("notes", { body: note }).then(() => setNote(""));
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-2xl border border-black/8 px-4 text-sm"
              required
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Visible only to this organisation"
            />
            <Button type="submit">Save</Button>
          </form>
          <div className="mt-4 space-y-3">
            {customer.notes.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#f3f5f6] p-4 text-sm"
              >
                <p>{item.body}</p>
                <p className="mt-2 text-xs text-[#68717b]">{item.authorName}</p>
              </div>
            ))}
          </div>
        </Surface>
        <Surface className="p-5 shadow-none">
          <h2 className="font-semibold">Tags</h2>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void act("tags", { name: tag }).then(() => setTag(""));
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-2xl border border-black/8 px-4 text-sm"
              required
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="VIP, annual service…"
            />
            <Button type="submit">Add</Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {customer.tags.map((item) => (
              <span
                key={item}
                className="rounded-full bg-[#eef8c8] px-3 py-1 text-xs font-semibold"
              >
                {item}
              </span>
            ))}
          </div>
        </Surface>
      </div>
      <Surface className="p-5 shadow-none">
        <h2 className="font-semibold">Service history</h2>
        {customer.history.length ? (
          <div className="mt-4 divide-y divide-black/6">
            {customer.history.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-xs text-[#68717b]">{item.kind}</p>
                </div>
                <div className="text-right">
                  <span>{item.status.replaceAll("_", " ")}</span>
                  {item.kind === "BOOKING" && item.status === "COMPLETED" ? (
                    <Link
                      className="mt-1 block text-xs font-semibold text-[#5f8d11]"
                      href={`/professional/bookings/new?customerId=${customer.id}&sourceBookingId=${item.id}`}
                    >
                      Book again
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StatePanel
            title="No service history"
            description="Bookings, quotations, and jobs will appear after identity reconciliation."
            className="mt-4"
          />
        )}
      </Surface>
      <Surface className="p-5 shadow-none">
        <h2 className="font-semibold">Service reminders</h2>
        <p className="mt-2 text-sm text-[#68717b]">
          Scheduled reminders create one in-app notification. SMS and email are
          not enabled.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]"
          onSubmit={addReminder}
        >
          <input
            className="min-h-11 rounded-2xl border border-black/8 px-4 text-sm"
            required
            minLength={3}
            maxLength={500}
            placeholder="Annual inspection is due"
            value={reminderReason}
            onChange={(event) => setReminderReason(event.target.value)}
          />
          <input
            className="min-h-11 rounded-2xl border border-black/8 px-4 text-sm"
            required
            type="datetime-local"
            value={reminderDueAt}
            onChange={(event) => setReminderDueAt(event.target.value)}
          />
          <Button type="submit">Schedule</Button>
        </form>
        {reminders.length ? (
          <div className="mt-4 divide-y divide-black/6">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{reminder.reason}</p>
                  <p className="text-xs text-[#68717b]">
                    {new Date(reminder.dueAt).toLocaleString()} ·{" "}
                    {reminder.status}
                  </p>
                </div>
                {reminder.status === "SCHEDULED" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      void cancelReminder(reminder.id).then((updated) =>
                        setReminders((items) =>
                          items.map((item) =>
                            item.id === updated.id ? updated : item,
                          ),
                        ),
                      )
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[#68717b]">
            No service reminders scheduled.
          </p>
        )}
      </Surface>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Surface className="p-5 shadow-none">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#68717b]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </Surface>
  );
}
