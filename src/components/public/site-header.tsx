"use client";

import {
  Bell,
  CalendarDays,
  ChevronDown,
  Heart,
  Menu,
  MessageCircle,
  Search,
  LogOut,
  Settings,
  Building2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Brand } from "@/components/public/brand";
import { iconButtonClass } from "@/components/public/design";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { clearAllClientResourceCaches } from "@/lib/client-resource-cache";
import { cn } from "@/lib/utils";
import { getUnreadNotificationCount } from "@/components/notifications/notification-api";
import { useProfessionalDashboard } from "@/components/workspace/professional-dashboard-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

function NotificationBell({ authoritativeCount }: { authoritativeCount?: number }) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    if (authoritativeCount !== undefined) return;
    let active = true;
    const refresh = () =>
      void getUnreadNotificationCount()
        .then((result) => {
          if (active) setUnreadCount(result.unreadCount);
        })
        .catch(() => {
          if (active) setUnreadCount(null);
        });
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [authoritativeCount]);
  const count = authoritativeCount ?? unreadCount;

  return (
    <Link
      href="/notifications"
      className={cn(iconButtonClass, "relative hidden sm:grid")}
      aria-label="Notifications"
      title={
        count
          ? `${count} unread notification${count === 1 ? "" : "s"}`
          : "Notifications"
      }
    >
      <Bell className="size-[1.15rem]" aria-hidden="true" />
      {count ? (
        <span
          className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#7cb518] px-1 type-caption font-bold leading-none text-white"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function HeaderSearch({
  className,
  professional = false,
}: {
  className?: string;
  professional?: boolean;
}) {
  return (
    <form
      action="/marketplace"
      role="search"
      className={cn(
        professional ? "flex h-12 min-w-0 items-center rounded-lg border border-black/10 bg-white px-4" : "flex h-14 min-w-0 items-center rounded-full border border-black/8 bg-white py-1.5 pr-1.5 pl-5",
        className,
      )}
    >
      <input
        name="query"
        aria-label="Search services"
        placeholder={
          professional
            ? "Search services, bookings, customers..."
            : "Search services, plumbers, electricians..."
        }
        className="min-w-0 flex-1 bg-transparent type-workspace-body outline-none placeholder:text-[#7a8188]"
      />
      <button
        type="submit"
        className={cn("grid size-11 shrink-0 place-items-center text-[#071522]", professional ? "bg-transparent" : "rounded-full bg-[#071522] text-white shadow-[0_8px_22px_rgba(7,21,34,0.22)]")}
        aria-label="Search"
      >
        <Search className="size-[1.15rem]" aria-hidden="true" />
      </button>
    </form>
  );
}

function AccountChip({
  displayName,
  href,
  subtitle = "Welcome,",
}: {
  displayName: string;
  href: string;
  subtitle?: string;
}) {
  const router = useRouter();
  async function signOut() {
    clearAllClientResourceCaches();
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-2 flex h-14 items-center gap-3 rounded-full border border-black/8 bg-white px-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Image
        src="/images/header-avatar.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full object-cover"
      />
      <span className="grid min-w-[70px] type-caption leading-tight">
        <span className="type-caption text-muted-foreground">{subtitle}</span>
        <span className="truncate font-semibold">{displayName}</span>
      </span>
      <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild><Link href="/professional"><Building2 className="size-4" />Dashboard</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={href}><Settings className="size-4" />Switch workspace</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}><LogOut className="size-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GuestActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-end gap-3", className)}>
      <Link
        href="/how-it-works"
        className="hidden text-sm font-semibold text-foreground xl:inline"
      >
        How It Works
      </Link>
      <Link
        href="/become-a-professional"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "hidden h-12 rounded-full border-black/8 px-5 text-[0.8rem] lg:inline-flex",
        )}
      >
        Become a Professional
      </Link>
      <Link
        href="/login"
        className="hidden text-sm font-semibold text-foreground sm:inline"
      >
        Log In
      </Link>
      <Link
        href="/marketplace"
        className={cn(
          buttonVariants({ variant: "primary" }),
          "h-12 rounded-full px-6 text-[0.8rem] shadow-[0_8px_22px_rgba(170,212,26,0.2)]",
        )}
      >
        Find Services
      </Link>
    </div>
  );
}

function SignedInActions({
  displayName,
  className,
  subtitle,
  professional = false,
}: {
  displayName: string;
  className?: string;
  subtitle?: string;
  professional?: boolean;
}) {
  const dashboard = useProfessionalDashboard();
  const utilityBadges = professional ? dashboard?.data?.utilityBadges : undefined;
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <Link
        href="/messages"
        className={cn(iconButtonClass, "relative hidden sm:grid")}
        aria-label="Messages"
      >
        <MessageCircle className="size-[1.15rem]" aria-hidden="true" />
        {utilityBadges?.messages ? <span className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#2f7d18] px-1 type-caption font-bold leading-none text-white">{utilityBadges.messages > 99 ? "99+" : utilityBadges.messages}</span> : null}
      </Link>
      {professional ? (
        <Link
          href="/professional/calendar"
          className={cn(iconButtonClass, "hidden sm:grid")}
          aria-label="Calendar"
        >
          <CalendarDays className="size-[1.15rem]" aria-hidden="true" />
        </Link>
      ) : (
        <Link
          href="/client/saved"
          className={cn(iconButtonClass, "hidden sm:grid")}
          aria-label="Saved professionals"
        >
          <Heart className="size-[1.15rem]" aria-hidden="true" />
        </Link>
      )}
      <NotificationBell authoritativeCount={utilityBadges?.notifications} />
      <div className="hidden sm:block">
        <AccountChip
          displayName={displayName}
          href="/workspace/select"
          subtitle={subtitle}
        />
      </div>
    </div>
  );
}

/**
 * Homepage navbar used across public surfaces.
 * Guest: marketing CTAs. Signed-in: utility icons + Welcome chip.
 */
export function SiteHeader({
  workspaceContext,
}: {
  workspaceContext?: { kind: "professional"; label: string };
} = {}) {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const displayName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    session?.user?.email?.split("@")[0] ||
    "there";
  const accountLabel =
    workspaceContext?.label && workspaceContext.label !== "Workspace"
      ? workspaceContext.label
      : displayName;

  return (
    <header className={cn("grid min-h-14 items-center gap-4", workspaceContext ? "grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[360px_minmax(320px,536px)_auto]" : "lg:grid-cols-[280px_minmax(280px,1fr)_auto]")}>
      <Brand />
      <HeaderSearch
        className="hidden w-full lg:flex"
        professional={Boolean(workspaceContext)}
      />

      {isPending ? (
        <div
          className="ml-auto hidden h-14 w-[280px] animate-pulse rounded-full border border-black/8 bg-white lg:block"
          aria-hidden="true"
        />
      ) : signedIn ? (
        <SignedInActions
          displayName={accountLabel}
          subtitle={workspaceContext ? "Professional" : "Welcome,"}
          professional={Boolean(workspaceContext)}
          className="hidden lg:flex"
        />
      ) : (
        <GuestActions className="hidden lg:flex" />
      )}

      <div className="flex items-center justify-end gap-2 lg:hidden">
        {!isPending && !signedIn ? (
          <Link
            href="/marketplace"
            className={cn(
              buttonVariants({ variant: "primary" }),
              "h-11 rounded-full px-4 text-[0.78rem]",
            )}
          >
            Find Services
          </Link>
        ) : null}

        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(iconButtonClass, "border-black/8")}
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent aria-describedby="site-menu-description">
            <SheetTitle className="pr-10 text-xl font-bold tracking-title">
              Veterans Bay
            </SheetTitle>
            <SheetDescription
              id="site-menu-description"
              className="mt-2 text-sm leading-6 text-[#68717b]"
            >
              Search services or jump to your destination.
            </SheetDescription>
            <HeaderSearch className="mt-7" />
            <nav className="mt-7 grid gap-2" aria-label="Mobile navigation">
              {signedIn ? (
                <>
                  <SheetClose asChild>
                    <Link
                      href="/messages"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Messages
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/client/saved"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Saved professionals
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/notifications"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Notifications
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/account/profile"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Account
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/workspace/select"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Workspaces
                    </Link>
                  </SheetClose>
                </>
              ) : (
                <>
                  <SheetClose asChild>
                    <Link
                      href="/how-it-works"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      How It Works
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/become-a-professional"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Become a Professional
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/login"
                      className="flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]"
                    >
                      Log In
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      href="/marketplace"
                      className={buttonVariants({
                        className: "mt-2 rounded-full",
                      })}
                    >
                      Find Services
                    </Link>
                  </SheetClose>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

/** @deprecated Prefer SiteHeader — kept as an alias for existing imports. */
export const PublicHeader = SiteHeader;
