import {
  ArrowRight,
  BriefcaseBusiness,
  CreditCard,
  FileText,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  clientDashboardStats,
  clientRecentBookings,
  clientTopCategories,
  clientUpcomingJobs,
} from "@/components/workspace/fixtures/client-dashboard";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const statusClass: Record<string, string> = {
  Completed: "bg-success-soft text-success",
  Ongoing: "bg-info-soft text-info",
  Confirmed: "bg-[#eef8c8] text-[#5f8d11]",
  Pending: "bg-warning-soft text-warning",
  Cancelled: "bg-danger-soft text-danger",
};

const toneClass: Record<string, string> = {
  green: "bg-[#eef8c8] text-[#5f8d11]",
  blue: "bg-info-soft text-info",
  gold: "bg-warning-soft text-warning",
  purple: "bg-[#f3e8ff] text-[#6b21a8]",
};

export function ClientDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">Good morning! 👋</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
          Here&apos;s what&apos;s happening with your home today.
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {clientDashboardStats.map((stat) => (
          <Surface key={stat.label} className="p-4 shadow-none">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-1 text-[0.65rem] font-semibold",
                toneClass[stat.tone],
              )}
            >
              {stat.label}
            </span>
            <p className="mt-4 text-2xl font-bold tracking-[-0.03em]">
              {stat.value}
            </p>
            <p className="mt-2 text-xs text-[#68717b]">{stat.hint}</p>
          </Surface>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
        <Surface className="overflow-hidden p-0 shadow-none">
          <div className="flex items-center justify-between border-b border-black/8 px-5 py-4">
            <h2 className="font-bold">Recent Bookings</h2>
            <Link
              href="/client/bookings"
              className="text-xs font-semibold text-[#5f8d11]"
            >
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-[#68717b]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Service</th>
                  <th className="px-3 py-3 font-semibold">Professional</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {clientRecentBookings.map((booking) => (
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
                        <span className="font-semibold">{booking.service}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[#68717b]">
                      {booking.professional}
                    </td>
                    <td className="px-3 py-3 text-[#68717b]">{booking.date}</td>
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
                    <td className="px-5 py-3 font-semibold">
                      KSh {booking.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-black/8 px-5 py-4">
            <Link
              href="/client/bookings"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full justify-center rounded-full border-black/8",
              )}
            >
              View All Bookings <ArrowRight className="size-4" />
            </Link>
          </div>
        </Surface>

        <aside className="space-y-4">
          <Surface className="p-4 shadow-none">
            <h2 className="font-bold">Quick Actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { href: "/marketplace", label: "Book Service", icon: BriefcaseBusiness },
                { href: "/marketplace", label: "Post a Job", icon: FileText },
                { href: "/client/invoices", label: "Make Payment", icon: CreditCard },
                { href: "/messages", label: "Send Message", icon: MessageCircle },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="grid justify-items-center gap-2 rounded-2xl border border-black/8 px-3 py-4 text-center text-xs font-semibold"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                    <Icon className="size-4" />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 shadow-none">
            <h2 className="font-bold">Upcoming Bookings</h2>
            <ul className="mt-4 space-y-3">
              {clientUpcomingJobs.map((job) => (
                <li
                  key={job.title}
                  className="flex gap-3 rounded-2xl border border-black/8 p-3"
                >
                  <Image
                    src={job.image}
                    alt=""
                    width={48}
                    height={48}
                    className="size-12 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{job.title}</p>
                    <p className="truncate text-xs text-[#68717b]">{job.company}</p>
                    <p className="mt-1 text-[0.68rem] text-[#68717b]">{job.when}</p>
                  </div>
                  <span
                    className={cn(
                      "h-fit rounded-full px-2 py-0.5 text-[0.62rem] font-semibold",
                      statusClass[job.status],
                    )}
                  >
                    {job.status}
                  </span>
                </li>
              ))}
            </ul>
          </Surface>

          <Surface className="overflow-hidden bg-[#e8f5f5] p-0 shadow-none">
            <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <p className="text-sm font-bold">
                  Need something done around your home?
                </p>
                <Link
                  href="/marketplace"
                  className={cn(
                    buttonVariants(),
                    "mt-3 h-10 justify-between rounded-full pr-1 pl-4 text-xs",
                  )}
                >
                  Post a Job
                  <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                    <ArrowRight className="size-3.5" />
                  </span>
                </Link>
              </div>
              <Image
                src="/images/featured-professional.png"
                alt=""
                width={88}
                height={88}
                className="size-20 rounded-2xl object-cover"
              />
            </div>
          </Surface>

          <Surface className="p-4 shadow-none">
            <h2 className="font-bold">Popular Services</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {clientTopCategories.map((category) => (
                <Link
                  key={category.label}
                  href={`/marketplace?category=${encodeURIComponent(category.label)}`}
                  className="text-center"
                >
                  <Image
                    src={category.image}
                    alt=""
                    width={72}
                    height={72}
                    className="mx-auto size-14 rounded-full object-cover"
                  />
                  <p className="mt-2 text-xs font-semibold">{category.label}</p>
                  <p className="text-[0.65rem] text-[#68717b]">
                    {category.count} services
                  </p>
                </Link>
              ))}
            </div>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
