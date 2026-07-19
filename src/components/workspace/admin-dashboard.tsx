import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  adminActivity,
  adminBookings,
  adminHealth,
  adminKpis,
  adminPending,
} from "@/components/workspace/fixtures/admin-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const kpiTone: Record<string, string> = {
  blue: "bg-info-soft text-info",
  green: "bg-[#eef8c8] text-[#5f8d11]",
  indigo: "bg-[#e0e7ff] text-[#3730a3]",
  purple: "bg-[#f3e8ff] text-[#6b21a8]",
  dark: "bg-[#edf1f3] text-[#071522]",
};

const statusClass: Record<string, string> = {
  "In Progress": "bg-[#eef8c8] text-[#5f8d11]",
  Confirmed: "bg-success-soft text-success",
  Scheduled: "bg-info-soft text-info",
  Pending: "bg-warning-soft text-warning",
};

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            Welcome back!
            <ShieldCheck className="size-4 text-[#5f8d11]" />
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
            Here&apos;s what&apos;s happening on Veterans Bay today.
          </h1>
        </div>
        <p className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-[#f7f9fa] px-3 py-1.5 text-xs font-semibold">
          <span className="size-2 animate-pulse rounded-full bg-[#5f8d11]" />
          Live overview · Nairobi, Kenya
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {adminKpis.map((kpi) => (
          <Surface key={kpi.label} className="p-4 shadow-none">
            <span
              className={cn(
                "inline-flex rounded-lg px-2 py-1 text-[0.65rem] font-semibold",
                kpiTone[kpi.tone],
              )}
            >
              {kpi.label}
            </span>
            <p className="mt-3 text-2xl font-bold">{kpi.value}</p>
            <p className="mt-1 text-[0.7rem] font-semibold text-[#5f8d11]">
              ▲ {kpi.trend}
            </p>
          </Surface>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Surface className="p-5 shadow-none xl:col-span-1">
          <h2 className="font-bold">Platform Growth</h2>
          <svg viewBox="0 0 280 140" className="mt-4 h-36 w-full" aria-hidden="true">
            <path d="M0 110 C40 100, 70 80, 110 70 S180 40, 220 50 S260 70, 280 40" fill="none" stroke="#2f70e8" strokeWidth="3" />
            <path d="M0 120 C50 115, 90 100, 130 95 S190 70, 230 75 S260 85, 280 60" fill="none" stroke="#5f8d11" strokeWidth="3" />
            <path d="M0 125 C60 120, 100 110, 140 105 S200 90, 240 95 S265 100, 280 80" fill="none" stroke="#7969e8" strokeWidth="3" />
          </svg>
          <div className="mt-2 flex flex-wrap gap-3 text-[0.68rem]">
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#2f70e8]" /> Users</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#5f8d11]" /> Pros</span>
            <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-[#7969e8]" /> Bookings</span>
          </div>
        </Surface>

        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">User Distribution</h2>
          <div className="mt-4 flex items-center gap-4">
            <div
              className="grid size-28 place-items-center rounded-full"
              style={{
                background:
                  "conic-gradient(#2f70e8 0 64%, #5f8d11 64% 90%, #071522 90% 92%, #c4b5fd 92% 100%)",
              }}
            >
              <span className="grid size-16 place-items-center rounded-full bg-white text-center text-[0.65rem] font-semibold">
                24,582
                <span className="block font-normal text-[#68717b]">users</span>
              </span>
            </div>
            <ul className="space-y-2 text-xs">
              <li>Clients 64%</li>
              <li>Professionals 26%</li>
              <li>Admins 2%</li>
              <li>Others 8%</li>
            </ul>
          </div>
        </Surface>

        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">System Health</h2>
          <p className="mt-2 text-sm font-semibold text-[#5f8d11]">
            All systems operational
          </p>
          <ul className="mt-4 space-y-2">
            {adminHealth.map((item) => (
              <li
                key={item}
                className="flex items-center justify-between rounded-xl bg-[#f7f9fa] px-3 py-2 text-sm"
              >
                {item}
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#5f8d11]">
                  <CheckCircle2 className="size-3.5" /> Operational
                </span>
              </li>
            ))}
          </ul>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">Recent Activity</h2>
          <ul className="mt-4 space-y-3">
            {adminActivity.map((item) => (
              <li key={item.title} className="rounded-2xl border border-black/8 px-4 py-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs text-[#68717b]">{item.time}</p>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">Pending Actions</h2>
          <ul className="mt-4 space-y-3">
            {adminPending.map((item) => (
              <li
                key={item.title}
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/8 px-4 py-3"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <button
                  type="button"
                  className="rounded-full border border-black/8 px-3 py-1.5 text-xs font-semibold"
                >
                  {item.action}
                </button>
              </li>
            ))}
          </ul>
        </Surface>
        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              { label: "Verify Pros", icon: BadgeCheck },
              { label: "Moderate", icon: ShieldCheck },
              { label: "Categories", icon: Building2 },
              { label: "Payouts", icon: Wallet },
              { label: "Reports", icon: BarChart3 },
              { label: "Users", icon: Users },
            ].map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="grid justify-items-center gap-2 rounded-2xl border border-black/8 px-3 py-4 text-xs font-semibold"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                  <Icon className="size-4" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(240px,0.7fr)]">
        <Surface className="overflow-hidden p-0 shadow-none">
          <div className="px-5 py-4">
            <h2 className="font-bold">Latest Bookings</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-[#68717b]">
                <tr>
                  <th className="px-5 py-2 font-semibold">Booking</th>
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Client</th>
                  <th className="px-3 py-2 font-semibold">Professional</th>
                  <th className="px-3 py-2 font-semibold">Amount</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {adminBookings.map((booking) => (
                  <tr key={booking.id} className="border-t border-black/8">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Image
                          src={booking.image}
                          alt=""
                          width={36}
                          height={36}
                          className="size-9 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-semibold">{booking.id}</p>
                          <p className="text-xs text-[#68717b]">{booking.date}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{booking.service}</td>
                    <td className="px-3 py-3 text-[#68717b]">{booking.client}</td>
                    <td className="px-3 py-3 text-[#68717b]">
                      {booking.professional}
                    </td>
                    <td className="px-3 py-3 font-semibold">
                      KSh {booking.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
                          statusClass[booking.status],
                        )}
                      >
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>

        <Surface className="p-5 shadow-none">
          <h2 className="font-bold">Platform Insights</h2>
          <ul className="mt-4 space-y-3 text-sm text-[#68717b]">
            <li>Professional verification throughput is up 18%.</li>
            <li>Marketplace bookings remain strongest in Nairobi West.</li>
            <li>Support response time is under 15 minutes.</li>
          </ul>
          <Link
            href="/admin/analytics"
            className={cn(
              buttonVariants(),
              "mt-5 h-11 w-full justify-between rounded-full pr-1 pl-4 text-xs",
            )}
          >
            View Full Analytics
            <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
        </Surface>
      </div>
    </div>
  );
}
