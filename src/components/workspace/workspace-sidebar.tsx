"use client";

import { ArrowRight, ChevronDown, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  getWorkspaceNav,
  shellHomeHref,
  shellKindShortLabel,
  type AuthenticatedShellKind,
} from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";
import { useProfessionalDashboard } from "@/components/workspace/professional-dashboard-context";

function isNavActive(pathname: string, href: string) {
  if (href === "/professional" || href === "/client" || href === "/admin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceSidebar({
  kind,
  workspaceLabel,
  className,
}: {
  kind: AuthenticatedShellKind;
  workspaceLabel: string;
  className?: string;
}) {
  const pathname = usePathname();
  const groups = getWorkspaceNav(kind);
  const dashboard = useProfessionalDashboard();
  const navigationBadges =
    kind === "professional" ? dashboard?.data?.navigationBadges : undefined;

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col border border-black/8 bg-white px-3 py-4",
        className,
      )}
      aria-label="Workspace"
    >
      <Link
        href={shellHomeHref[kind]}
        className="mb-3 flex items-center gap-3 rounded-xl border border-black/8 bg-[#f8fafb] p-3 lg:hidden"
      >
        <span className="grid size-10 place-items-center rounded-xl bg-[#eef7e8] text-[#287313]">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {workspaceLabel}
          </span>
          <span className="block type-caption text-muted-foreground">
            {shellKindShortLabel[kind]}
          </span>
        </span>
      </Link>

      <nav
        className="min-h-0 flex-1 overflow-y-auto pr-1"
        aria-label="Workspace navigation"
      >
        {groups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 ? (
              <div className="my-3 border-t border-black/8" />
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                const badge = badgeForHref(item.href, navigationBadges);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex min-h-10 items-center gap-3 rounded-lg px-3 type-control transition-colors",
                        active
                          ? "bg-[#edf5e7] text-[#245f14]"
                          : "text-[#27313a] hover:bg-[#f5f7f8] hover:text-foreground",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        className={cn(
                          "size-[1.05rem] shrink-0",
                          active
                            ? "text-[#2e7d18]"
                            : "text-[#59636c] group-hover:text-foreground",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {item.label}
                      </span>
                      {badge > 0 ? (
                        <span className="grid min-h-5 min-w-5 place-items-center rounded-full bg-[#2f7d18] px-1 type-caption font-semibold leading-none text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                      {item.label === "Tools & Resources" ? (
                        <ChevronDown
                          className="size-3.5 -rotate-90 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {kind !== "admin" ? (
        <Link
          href="/help"
          className="mt-4 flex min-h-10 items-center justify-between rounded-full bg-primary px-4 type-control text-primary-foreground"
        >
          Contact support
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </aside>
  );
}

function badgeForHref(
  href: string,
  badges?: {
    enquiries: number;
    quotations: number;
    invoices: number;
    reviews: number;
  },
) {
  if (!badges) return 0;
  if (href.includes("/enquiries")) return badges.enquiries;
  if (href.includes("/quotations")) return badges.quotations;
  if (href.includes("/invoices")) return badges.invoices;
  if (href.includes("/reviews")) return badges.reviews;
  return 0;
}
