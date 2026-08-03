"use client";

import {
  ArrowRight,
  ChevronDown,
  Headphones,
  ShieldCheck,
  Store,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import {
  getWorkspaceNav,
  shellContextLabel,
  type AuthenticatedShellKind,
} from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";

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
  const year = new Date().getFullYear();

  if (kind === "professional") {
    return (
      <aside
        className={cn(
          "flex h-full min-h-0 flex-col border border-black/8 bg-white p-4",
          className,
        )}
        aria-label="Workspace"
      >
        <Link
          href="/workspace/select"
          className="mb-3 flex items-center gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-3 lg:hidden"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[#eef7e8] text-[#287313]">
            <Store className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{workspaceLabel}</span>
            <span className="block text-[0.7rem] text-muted-foreground">Professional</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
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
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.78rem] font-semibold transition-all",
                          active
                            ? "bg-[#edf5e7] text-[#245f14]"
                            : "text-[#27313a] hover:bg-[#f5f7f8] hover:text-foreground",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon
                          className={cn(
                            "size-[1.05rem] shrink-0",
                            active ? "text-[#2e7d18]" : "text-[#59636c] group-hover:text-foreground",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-4 overflow-hidden rounded-[18px] bg-[#07142d] p-4 text-white shadow-[0_14px_30px_rgba(7,20,45,0.18)]">
          <Image
            src="/images/veterans-bay-logo.png"
            alt=""
            width={1249}
            height={389}
            className="h-auto w-[150px] rounded-lg bg-white px-2 py-1.5 object-contain"
            sizes="150px"
          />
          <h2 className="mt-3 text-sm font-bold">Need help?</h2>
          <p className="mt-1.5 text-[0.72rem] leading-5 text-white/70">
            Our support team is here for you.
          </p>
          <Link
            href="/help"
            className="mt-4 flex min-h-10 items-center justify-between rounded-full bg-primary px-4 text-[0.72rem] font-bold text-primary-foreground"
          >
            Contact support
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[22px] border border-black/8 bg-[#f7f9fa] p-4",
        className,
      )}
      aria-label="Workspace"
    >
      <Link
        href="/workspace/select"
        className="mt-3 flex items-center gap-3 rounded-[18px] border border-black/8 bg-white p-3"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
          <Store className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {workspaceLabel}
          </span>
          <span className="block truncate text-[0.7rem] text-[#68717b]">
            {shellContextLabel[kind]}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-[#68717b]"
          aria-hidden="true"
        />
      </Link>

      <nav
        className="mt-5 flex-1 space-y-4 overflow-y-auto"
        aria-label="Workspace navigation"
      >
        {groups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 ? (
              <div className="mb-4 border-t border-black/8" />
            ) : null}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-[#3d4750] hover:bg-white",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 rounded-[18px] bg-[#eef8c8] p-4">
        <div className="flex items-start gap-3">
          <Headphones
            className="mt-0.5 size-4 shrink-0 text-[#5f8d11]"
            aria-hidden="true"
          />
          <p className="flex-1 text-[0.78rem] leading-5 text-[#3d4a2a]">
            Need help? Our support team is here for you.
          </p>
          <Link
            href="/help"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-foreground"
            aria-label="Open help center"
          >
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 px-1 text-[0.68rem] text-[#68717b]">
        <p className="inline-flex items-center gap-1.5 font-medium text-[#3d4a2a]">
          <ShieldCheck className="size-3.5 text-[#5f8d11]" aria-hidden="true" />
          You&apos;re covered with Veterans Bay
        </p>
        <p>© {year} Veterans Bay. All rights reserved.</p>
      </div>
    </aside>
  );
}
