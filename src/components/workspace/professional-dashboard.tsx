import {
  ArrowRight,
  CalendarDays,
  FilePlus2,
  MessageCircle,
  Share2,
  Star,
  Store,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  professionalBookings,
  professionalMetrics,
  professionalReviews,
  professionalToday,
} from "@/components/workspace/fixtures/professional-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const tagClass: Record<string, string> = {
  purple: "bg-[#f3e8ff] text-[#6b21a8]",
  blue: "bg-info-soft text-info",
  green: "bg-[#eef8c8] text-[#5f8d11]",
  gold: "bg-warning-soft text-warning",
};

const statusClass: Record<string, string> = {
  "In Progress": "bg-info-soft text-info",
  Scheduled: "bg-[#eef8c8] text-[#5f8d11]",
};

export function ProfessionalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">
          Good morning, ProLine Plumbing! 👋
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
          Here&apos;s what&apos;s happening with your business today.
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {professionalMetrics.map((metric) => (
          <Surface key={metric.label} className="p-4 shadow-none">
            <p className="text-xs text-[#68717b]">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold">{metric.value}</p>
            <p className="mt-1 text-[0.7rem] text-[#68717b]">{metric.hint}</p>
          </Surface>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <div className="space-y-5">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Today&apos;s Overview</h2>
            <ul className="mt-4 space-y-3">
              {professionalToday.map((item) => (
                <li
                  key={item.title}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-black/8 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-[#68717b]">{item.meta}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.65rem] font-semibold",
                      tagClass[item.tone],
                    )}
                  >
                    {item.tag}
                  </span>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="overflow-hidden p-0 shadow-none">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-bold">Active Bookings</h2>
              <Link
                href="/professional/bookings"
                className="text-xs font-semibold text-[#5f8d11]"
              >
                View all bookings
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-[#68717b]">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Booking</th>
                    <th className="px-3 py-2 font-semibold">Customer</th>
                    <th className="px-3 py-2 font-semibold">Schedule</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-5 py-2 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {professionalBookings.map((booking) => (
                    <tr key={booking.id} className="border-t border-black/8">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Image
                            src={booking.image}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 rounded-xl object-cover"
                          />
                          <div>
                            <p className="font-semibold">{booking.title}</p>
                            <p className="text-xs text-[#68717b]">
                              {booking.service}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-[#68717b]">
                        <p className="font-semibold text-foreground">
                          {booking.customer}
                        </p>
                        {booking.location}
                      </td>
                      <td className="px-3 py-3 text-xs text-[#68717b]">
                        {booking.schedule}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold",
                            statusClass[booking.status],
                          )}
                        >
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href="/messages"
                          className="grid size-9 place-items-center rounded-full border border-black/8"
                          aria-label="Message customer"
                        >
                          <MessageCircle className="size-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Surface>
        </div>

        <aside className="space-y-4">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Profile Strength</h2>
            <div className="mt-4 flex items-center gap-4">
              <div
                className="grid size-20 place-items-center rounded-full"
                style={{
                  background:
                    "conic-gradient(#c8f43d 0 92%, #edf1f3 92% 100%)",
                }}
              >
                <span className="grid size-14 place-items-center rounded-full bg-white text-sm font-bold">
                  92%
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#5f8d11]">
                  Verified Professional
                </p>
                <p className="mt-1 text-xs text-[#68717b]">
                  Complete availability to reach 100%.
                </p>
              </div>
            </div>
            <Link
              href="/account/profile"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "mt-4 h-10 w-full rounded-full",
              )}
            >
              Improve Profile
            </Link>
          </Surface>

          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Earnings Summary</h2>
            <p className="mt-3 text-2xl font-bold">KSh 85,450</p>
            <p className="mt-1 text-xs font-semibold text-[#5f8d11]">↑ 18% this month</p>
            <svg viewBox="0 0 200 60" className="mt-4 h-16 w-full" aria-hidden="true">
              <path
                d="M0 45 C30 40, 50 20, 80 28 S130 50, 160 18 S190 10, 200 22"
                fill="none"
                stroke="#5f8d11"
                strokeWidth="3"
              />
            </svg>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[#68717b]">Jobs Completed</dt>
                <dd className="font-semibold">28</dd>
              </div>
              <div>
                <dt className="text-[#68717b]">Avg. Job Value</dt>
                <dd className="font-semibold">KSh 3,050</dd>
              </div>
            </dl>
          </Surface>

          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Quick Actions</h2>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[0.65rem] font-semibold">
              {[
                { label: "Add Service", icon: Store },
                { label: "Availability", icon: CalendarDays },
                { label: "Create Quote", icon: FilePlus2 },
                { label: "Share Profile", icon: Share2 },
                { label: "Calendar", icon: CalendarDays },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="grid justify-items-center gap-2"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="bg-[#f3e8ff] p-5 shadow-none">
            <p className="text-sm font-bold">Grow your business</p>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "secondary" }),
                "mt-3 h-10 rounded-full",
              )}
            >
              Boost my profile <ArrowRight className="size-3.5" />
            </button>
          </Surface>

          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Recent Reviews</h2>
            {professionalReviews.map((review) => (
              <div key={review.name} className="mt-4">
                <div className="flex items-center gap-2">
                  <Image
                    src="/images/header-avatar.png"
                    alt=""
                    width={32}
                    height={32}
                    className="size-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold">{review.name}</p>
                    <p className="inline-flex items-center gap-1 text-xs">
                      <Star className="size-3 fill-[#ffb81c] text-[#ffb81c]" />
                      {review.rating}.0
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#68717b]">
                  {review.comment}
                </p>
              </div>
            ))}
          </Surface>
        </aside>
      </div>
    </div>
  );
}
