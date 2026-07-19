"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Headphones,
  ShieldCheck,
  Star,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Brand } from "@/components/public/brand";
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

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col rounded-[22px] border border-black/8 bg-[#f7f9fa] p-4",
        className,
      )}
      aria-label="Workspace"
    >
      <Brand compact />

      <Link
        href="/workspace/select"
        className="mt-5 flex items-center gap-3 rounded-[18px] border border-black/8 bg-white p-3"
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
        <ChevronDown className="size-4 shrink-0 text-[#68717b]" aria-hidden="true" />
      </Link>

      {kind === "professional" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef8c8] px-2.5 py-1 text-[0.68rem] font-semibold text-[#5f8d11]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Verified Pro
          </span>
          <span className="inline-flex items-center gap-1 text-[0.72rem] font-semibold">
            <Star className="size-3.5 fill-[#ffb81c] text-[#ffb81c]" aria-hidden="true" />
            4.9
          </span>
        </div>
      ) : null}

      <nav className="mt-5 flex-1 space-y-4 overflow-y-auto" aria-label="Workspace navigation">
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
          <Headphones className="mt-0.5 size-4 shrink-0 text-[#5f8d11]" aria-hidden="true" />
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
