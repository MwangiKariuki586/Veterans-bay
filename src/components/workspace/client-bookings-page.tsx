"use client";

import { ArrowRight, Gift, Headphones, RefreshCw, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { clientBookingsList } from "@/components/workspace/fixtures/client-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const tabs = [
  "All Bookings",
  "Upcoming",
  "In Progress",
  "Completed",
  "Cancelled",
] as const;

const statusClass: Record<string, string> = {
  Confirmed: "bg-[#eef8c8] text-[#5f8d11]",
  Pending: "bg-warning-soft text-warning",
  "In Progress": "bg-info-soft text-info",
  Completed: "bg-[#edf1f3] text-[#3d4750]",
  Cancelled: "bg-danger-soft text-danger",
  Ongoing: "bg-info-soft text-info",
};

export function ClientBookingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All Bookings");

  const filtered = useMemo(() => {
    if (tab === "All Bookings") {
      return clientBookingsList;
    }
    if (tab === "Upcoming") {
      return clientBookingsList.filter(
        (item) => item.status === "Confirmed" || item.status === "Pending",
      );
    }
    return clientBookingsList.filter((item) => item.status === tab);
  }, [tab]);

  const summary = {
    total: clientBookingsList.length,
    upcoming: clientBookingsList.filter(
      (item) => item.status === "Confirmed" || item.status === "Pending",
    ).length,
    inProgress: clientBookingsList.filter((item) => item.status === "In Progress")
      .length,
    completed: clientBookingsList.filter((item) => item.status === "Completed")
      .length,
    cancelled: clientBookingsList.filter((item) => item.status === "Cancelled")
      .length,
  };

  return (
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/client" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Bookings</span>
      </nav>
      <h1 className="mt-4 text-3xl font-bold tracking-title">My Bookings</h1>
      <p className="mt-2 text-sm text-[#68717b]">
        Track and manage all your booking requests in one place.
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(250px,0.75fr)]">
        <div>
          <div className="flex flex-wrap gap-4 border-b border-black/8">
            {tabs.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={cn(
                  "border-b-2 pb-3 text-sm font-semibold",
                  tab === item
                    ? "border-[#5f8d11] text-foreground"
                    : "border-transparent text-[#68717b]",
                )}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select className="h-10 rounded-full border border-black/8 bg-white px-3 text-xs">
              <option>Filter by status</option>
            </select>
            <select className="h-10 rounded-full border border-black/8 bg-white px-3 text-xs">
              <option>Filter by service</option>
            </select>
            <input
              type="text"
              defaultValue="May 1, 2024 - May 31, 2024"
              className="h-10 rounded-full border border-black/8 bg-white px-3 text-xs"
              aria-label="Date range"
            />
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-black/8 px-3 text-xs font-semibold"
            >
              <RefreshCw className="size-3.5" /> Reset
            </button>
          </div>

          <Surface className="mt-4 overflow-hidden p-0 shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-[#f7f9fa] text-xs text-[#68717b]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Service</th>
                    <th className="px-3 py-3 font-semibold">Booking details</th>
                    <th className="px-3 py-3 font-semibold">Date & time</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booking) => (
                    <tr key={booking.id} className="border-t border-black/8">
                      <td className="px-4 py-3">
                        <Image
                          src={booking.image}
                          alt=""
                          width={48}
                          height={48}
                          className="size-12 rounded-xl object-cover"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold">{booking.service}</p>
                        <p className="text-xs text-[#68717b]">
                          {booking.professional}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-xs font-semibold text-[#5f8d11]"
                        >
                          View Details
                        </button>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#68717b]">
                        <p>{booking.date}</p>
                        <p>{booking.time}</p>
                        <p>{booking.location}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 type-caption font-semibold",
                            statusClass[booking.status],
                          )}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        KSh {booking.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-4 py-3 text-xs text-[#68717b]">
              <p>
                Showing 1 to {filtered.length} of {summary.total} bookings.
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={cn(
                      "grid size-8 place-items-center rounded-lg font-semibold",
                      page === 1 ? "bg-[#14532d] text-white" : "border border-black/8",
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
            </div>
          </Surface>
        </div>

        <aside className="space-y-4">
          <Surface className="p-5 shadow-none">
            <p className="text-xs text-[#68717b]">Total Bookings</p>
            <p className="mt-1 text-3xl font-bold">{summary.total}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                ["Upcoming", summary.upcoming, "bg-[#5f8d11]"],
                ["In Progress", summary.inProgress, "bg-info"],
                ["Completed", summary.completed, "bg-[#68717b]"],
                ["Cancelled", summary.cancelled, "bg-danger"],
              ].map(([label, count, color]) => (
                <li key={String(label)} className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", color)} />
                  <span className="flex-1">{label}</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          </Surface>
          <Surface className="p-5 shadow-none">
            <Wrench className="size-5 text-[#5f8d11]" />
            <h2 className="mt-3 font-bold">Need a Custom Job?</h2>
            <p className="mt-2 text-sm text-[#68717b]">
              Post a job and get quotes from verified pros.
            </p>
            <Link
              href="/marketplace"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-10 rounded-full border-black/8",
              )}
            >
              Post a Job <ArrowRight className="size-3.5" />
            </Link>
          </Surface>
          <Surface className="p-5 shadow-none">
            <Gift className="size-5 text-[#5f8d11]" />
            <h2 className="mt-3 font-bold">Refer & Earn</h2>
            <p className="mt-2 text-sm text-[#68717b]">
              Invite friends and earn KSh 500 in credits.
            </p>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-10 rounded-full border-black/8",
              )}
            >
              Invite Now <ArrowRight className="size-3.5" />
            </button>
          </Surface>
          <Surface className="bg-[#eef8c8] p-5 shadow-none">
            <Headphones className="size-5" />
            <h2 className="mt-3 font-bold">Help & Support</h2>
            <p className="mt-2 text-sm text-[#3d4a2a]">
              Our support team is available 24/7.
            </p>
            <Link
              href="/help"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "mt-4 h-10 rounded-full",
              )}
            >
              Get Help <ArrowRight className="size-3.5" />
            </Link>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
