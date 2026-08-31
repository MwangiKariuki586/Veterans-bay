"use client";

import {
  Bell,
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  Heart,
  Headphones,
  Menu,
  MessageCircle,
  Search,
  LogOut,
  Settings,
  Building2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
import {
  shellHomeHref,
  type AuthenticatedShellKind,
} from "@/components/workspace/workspace-nav";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type FocusedHeaderTrailing = "login" | "support";

type SiteHeaderProps =
  | {
      variant?: "marketing";
      marketplace?: boolean;
    }
  | {
      variant: "focused";
      brandSize?: "default" | "large";
      className?: string;
      trailing?: FocusedHeaderTrailing;
    }
  | {
      variant: "workspace";
      workspaceContext: { kind: AuthenticatedShellKind; label: string };
    };

function isCurrentDestination(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
          className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#7cb518] px-1 type-caption font-semibold leading-none text-white"
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
  workspace = false,
}: {
  className?: string;
  workspace?: boolean;
}) {
  return (
    <form
      action="/marketplace"
      role="search"
      className={cn(
        workspace
          ? "flex h-12 min-w-0 items-center rounded-lg border border-black/10 bg-white px-4 focus-within:border-black/20"
          : "flex h-14 min-w-0 items-center rounded-full border border-black/8 bg-white py-1.5 pr-1.5 pl-5 focus-within:border-black/20",
        className,
      )}
    >
      <input
        name="q"
        aria-label="Search services"
        placeholder={
          workspace
            ? "Search services, bookings, customers..."
            : "Search services, plumbers, electricians..."
        }
        className="min-w-0 flex-1 bg-transparent type-workspace-body placeholder:text-[#7a8188] outline-none focus:outline-none focus-visible:outline-none"
      />
      <button
        type="submit"
        className={cn(
          "grid size-11 shrink-0 place-items-center text-[#071522] outline-none focus-visible:outline-none",
          workspace
            ? "bg-transparent"
            : "rounded-full bg-[#071522] text-white shadow-[0_8px_22px_rgba(7,21,34,0.22)]",
        )}
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
  subtitle,
  dashboardHref = "/workspace/select",
}: {
  displayName: string;
  href: string;
  subtitle?: string;
  dashboardHref?: string;
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
      <DropdownMenuTrigger className="ml-2 flex h-14 max-w-[220px] items-center gap-3 rounded-full border border-black/8 bg-white px-2.5 pr-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Image
        src="/images/header-avatar.png"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0 rounded-full object-cover"
      />
      <span className="min-w-0 flex-1 leading-tight">
        {subtitle ? (
          <span className="block type-caption text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
        <span className="block truncate font-semibold">{displayName}</span>
      </span>
      <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href={dashboardHref}>
            <Building2 className="size-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={href}>
            <ArrowLeftRight className="size-4" />
            Switch workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account/profile">
            <Settings className="size-4" />
            Account settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GuestActions({
  className,
  marketplace,
  pathname,
}: {
  className?: string;
  marketplace: boolean;
  pathname: string;
}) {
  const showHowItWorks = !isCurrentDestination(pathname, "/how-it-works");
  const showProfessional = !isCurrentDestination(
    pathname,
    "/become-a-professional",
  );

  return (
    <div className={cn("flex items-center justify-end gap-3", className)}>
      {showHowItWorks ? (
        <Link
          href="/how-it-works"
          className="hidden text-sm font-semibold text-foreground transition-colors hover:text-[#5f7f00] xl:inline"
        >
          How It Works
        </Link>
      ) : null}
      {showProfessional ? (
        <Link
          href="/become-a-professional"
          className="hidden text-sm font-semibold text-foreground transition-colors hover:text-[#5f7f00] lg:inline"
        >
          Become a Professional
        </Link>
      ) : null}
      <Link
        href="/login"
        className="hidden text-sm font-semibold text-foreground transition-colors hover:text-[#5f7f00] sm:inline"
      >
        Log In
      </Link>
      {!marketplace ? (
        <Link
          href="/marketplace"
          className={cn(
            buttonVariants({ variant: "primary" }),
            "h-12 rounded-full px-6 text-[0.8rem] shadow-[0_8px_22px_rgba(170,212,26,0.2)]",
          )}
        >
          Find Services
        </Link>
      ) : null}
    </div>
  );
}

function SignedInActions({
  displayName,
  className,
  subtitle,
  workspaceKind,
}: {
  displayName: string;
  className?: string;
  subtitle?: string;
  workspaceKind?: AuthenticatedShellKind;
}) {
  const dashboard = useProfessionalDashboard();
  const utilityBadges =
    workspaceKind === "professional"
      ? dashboard?.data?.utilityBadges
      : undefined;
  const dashboardHref = workspaceKind
    ? shellHomeHref[workspaceKind]
    : "/workspace/select";
  const showWorkspaceMessages =
    workspaceKind === "client" || workspaceKind === "professional";

  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      {!workspaceKind ? (
        <Link
          href={dashboardHref}
          className="hidden text-sm font-semibold text-foreground transition-colors hover:text-[#5f7f00] sm:inline"
        >
          Dashboard
        </Link>
      ) : null}
      {showWorkspaceMessages ? (
        <Link
          href="/messages"
          className={cn(iconButtonClass, "relative hidden sm:grid")}
          aria-label="Messages"
        >
          <MessageCircle className="size-[1.15rem]" aria-hidden="true" />
          {utilityBadges?.messages ? (
            <span className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#2f7d18] px-1 type-caption font-semibold leading-none text-white">
              {utilityBadges.messages > 99 ? "99+" : utilityBadges.messages}
            </span>
          ) : null}
        </Link>
      ) : null}
      {workspaceKind === "professional" ? (
        <Link
          href="/professional/calendar"
          className={cn(iconButtonClass, "hidden sm:grid")}
          aria-label="Calendar"
        >
          <CalendarDays className="size-[1.15rem]" aria-hidden="true" />
        </Link>
      ) : workspaceKind === "client" ? (
        <Link
          href="/client/saved"
          className={cn(iconButtonClass, "hidden sm:grid")}
          aria-label="Saved professionals"
        >
          <Heart className="size-[1.15rem]" aria-hidden="true" />
        </Link>
      ) : null}
      <NotificationBell authoritativeCount={utilityBadges?.notifications} />
      <div className="hidden sm:block">
        <AccountChip
          displayName={displayName}
          href="/workspace/select"
          subtitle={subtitle}
          dashboardHref={dashboardHref}
        />
      </div>
    </div>
  );
}

function MobileNavLink({
  children,
  className,
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className={cn(
          "flex min-h-12 items-center rounded-2xl px-4 font-semibold hover:bg-[#f7f9fa]",
          className,
        )}
      >
        {children}
      </Link>
    </SheetClose>
  );
}

function MobileSignedInNavigation({
  workspaceKind,
}: {
  workspaceKind?: AuthenticatedShellKind;
}) {
  const dashboardHref = workspaceKind
    ? shellHomeHref[workspaceKind]
    : "/workspace/select";

  return (
    <>
      {workspaceKind === "client" || workspaceKind === "professional" ? (
        <MobileNavLink href="/messages">Messages</MobileNavLink>
      ) : null}
      {workspaceKind === "client" ? (
        <MobileNavLink href="/client/saved">Saved professionals</MobileNavLink>
      ) : null}
      {workspaceKind === "professional" ? (
        <MobileNavLink href="/professional/calendar">Calendar</MobileNavLink>
      ) : null}
      <MobileNavLink href="/notifications">Notifications</MobileNavLink>
      <MobileNavLink href="/account/profile">Account</MobileNavLink>
      <MobileNavLink href={dashboardHref}>Dashboard</MobileNavLink>
    </>
  );
}

function MobileGuestNavigation({
  marketplace,
  pathname,
}: {
  marketplace: boolean;
  pathname: string;
}) {
  return (
    <>
      {!isCurrentDestination(pathname, "/how-it-works") ? (
        <MobileNavLink href="/how-it-works">How It Works</MobileNavLink>
      ) : null}
      {!isCurrentDestination(pathname, "/become-a-professional") ? (
        <MobileNavLink href="/become-a-professional">
          Become a Professional
        </MobileNavLink>
      ) : null}
      <MobileNavLink href="/login">Log In</MobileNavLink>
      {!marketplace ? (
        <MobileNavLink
          href="/marketplace"
          className={buttonVariants({ className: "mt-2 rounded-full" })}
        >
          Find Services
        </MobileNavLink>
      ) : null}
    </>
  );
}

function FocusedSiteHeader({
  brandSize = "default",
  className,
  trailing = "support",
}: {
  brandSize?: "default" | "large";
  className?: string;
  trailing?: FocusedHeaderTrailing;
}) {
  return (
    <header className={cn("flex items-center justify-between gap-5", className)}>
      <Brand size={brandSize} compact />
      <nav
        className="flex items-center gap-4 text-sm"
        aria-label="Guest navigation"
      >
        <Link
          href="/how-it-works"
          className="whitespace-nowrap font-semibold text-[#071733] transition-colors hover:text-[#5f7f00]"
        >
          How It Works
        </Link>
        <span
          className="hidden h-5 w-px bg-[#d4ddea] sm:block"
          aria-hidden="true"
        />
        {trailing === "login" ? (
          <Link
            href="/login"
            className="whitespace-nowrap font-semibold text-[#071733] transition-colors hover:text-[#5f7f00]"
          >
            Log In
          </Link>
        ) : (
          <p className="hidden items-center gap-2 text-[#526580] sm:flex">
            <Headphones className="size-5 text-[#071733]" aria-hidden="true" />
            Need help?
            <Link href="/contact" className="font-semibold text-[#0068e8]">
              Contact support
            </Link>
          </p>
        )}
      </nav>
    </header>
  );
}

function AdaptiveSiteHeader({
  workspaceContext,
  marketplace = false,
}: {
  workspaceContext?: { kind: AuthenticatedShellKind; label: string };
  marketplace?: boolean;
}) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
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
    <header className={cn("grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-4", workspaceContext ? "lg:grid-cols-[360px_minmax(320px,536px)_auto]" : "lg:grid-cols-[280px_minmax(280px,1fr)_auto]")}>
      <Brand />
      <HeaderSearch
        className="hidden w-full lg:flex"
        workspace={Boolean(workspaceContext)}
      />

      {isPending ? (
        <div
          className="ml-auto hidden h-14 w-[280px] animate-pulse rounded-full border border-black/8 bg-white lg:block"
          aria-hidden="true"
        />
      ) : signedIn ? (
        <SignedInActions
          displayName={accountLabel}
          subtitle={workspaceContext ? undefined : "Welcome,"}
          workspaceKind={workspaceContext?.kind}
          className="hidden lg:flex"
        />
      ) : (
        <GuestActions
          className="hidden lg:flex"
          marketplace={marketplace}
          pathname={pathname}
        />
      )}

      <div className="flex items-center justify-end gap-2 lg:hidden">
        {!isPending && !signedIn && !marketplace ? (
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
            <SheetTitle className="pr-10 text-xl font-semibold tracking-title">
              Veterans Bay
            </SheetTitle>
            <SheetDescription
              id="site-menu-description"
              className="mt-2 text-sm leading-6 text-[#68717b]"
            >
              Search services or jump to your destination.
            </SheetDescription>
            <HeaderSearch className="mt-7" />
            <nav
              className="mt-7 grid gap-2"
              aria-busy={isPending}
              aria-label="Mobile navigation"
            >
              {isPending ? (
                <p className="px-4 py-3 text-sm text-[#68717b]">
                  Loading account navigation…
                </p>
              ) : signedIn ? (
                <MobileSignedInNavigation
                  workspaceKind={workspaceContext?.kind}
                />
              ) : (
                <MobileGuestNavigation
                  marketplace={marketplace}
                  pathname={pathname}
                />
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      {marketplace ? (
        <HeaderSearch className="col-span-2 mt-1 flex w-full lg:hidden" />
      ) : null}
    </header>
  );
}

/**
 * Shared navigation with explicit marketing, focused-guest, and workspace
 * variants. Marketing actions are route-aware; workspace actions are
 * role-aware on desktop and mobile.
 */
export function SiteHeader(props: SiteHeaderProps = {}) {
  if (props.variant === "focused") {
    return (
      <FocusedSiteHeader
        brandSize={props.brandSize}
        className={props.className}
        trailing={props.trailing}
      />
    );
  }

  return (
    <AdaptiveSiteHeader
      marketplace={props.variant === "marketing" ? props.marketplace : false}
      workspaceContext={
        props.variant === "workspace" ? props.workspaceContext : undefined
      }
    />
  );
}

/** @deprecated Prefer SiteHeader — kept as an alias for existing imports. */
export const PublicHeader = SiteHeader;
