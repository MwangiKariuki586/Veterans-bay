"use client";

import {
  Bell,
  ChevronDown,
  Heart,
  Menu,
  MessageCircle,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
import { cn } from "@/lib/utils";

function HeaderSearch({ className }: { className?: string }) {
  return (
    <form
      action="/marketplace"
      role="search"
      className={cn(
        "flex h-14 min-w-0 items-center rounded-full border border-black/8 bg-white py-1.5 pr-1.5 pl-5",
        className,
      )}
    >
      <input
        name="query"
        aria-label="Search services"
        placeholder="Search services, plumbers, electricians..."
        className="min-w-0 flex-1 bg-transparent text-[0.78rem] outline-none placeholder:text-[#7a8188]"
      />
      <button
        type="submit"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[#071522] text-white shadow-[0_8px_22px_rgba(7,21,34,0.22)]"
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
}: {
  displayName: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="ml-2 flex h-14 items-center gap-3 rounded-full border border-black/8 bg-white px-2.5 pr-4"
    >
      <Image
        src="/images/header-avatar.png"
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full object-cover"
      />
      <span className="grid min-w-[70px] text-[0.76rem] leading-tight">
        <span className="text-[0.64rem] text-muted-foreground">Welcome,</span>
        <span className="truncate font-semibold">{displayName}</span>
      </span>
      <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
    </Link>
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
}: {
  displayName: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <Link
        href="/messages"
        className={cn(iconButtonClass, "hidden sm:grid")}
        aria-label="Messages"
      >
        <MessageCircle className="size-[1.15rem]" aria-hidden="true" />
      </Link>
      <Link
        href="/client/saved"
        className={cn(iconButtonClass, "hidden sm:grid")}
        aria-label="Saved professionals"
      >
        <Heart className="size-[1.15rem]" aria-hidden="true" />
      </Link>
      <Link
        href="/notifications"
        className={cn(iconButtonClass, "relative hidden sm:grid")}
        aria-label="Notifications"
      >
        <Bell className="size-[1.15rem]" aria-hidden="true" />
        <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-white bg-[#7cb518]" />
      </Link>
      <div className="hidden sm:block">
        <AccountChip displayName={displayName} href="/account/profile" />
      </div>
    </div>
  );
}

/**
 * Homepage navbar used across public surfaces.
 * Guest: marketing CTAs. Signed-in: utility icons + Welcome chip.
 */
export function SiteHeader() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session?.user);
  const displayName =
    session?.user?.name?.trim().split(/\s+/)[0] ||
    session?.user?.email?.split("@")[0] ||
    "there";

  return (
    <header className="grid min-h-14 items-center gap-5 lg:grid-cols-[280px_minmax(280px,1fr)_auto]">
      <Brand />
      <HeaderSearch className="hidden w-full lg:flex" />

      {isPending ? (
        <div
          className="ml-auto hidden h-14 w-[280px] animate-pulse rounded-full border border-black/8 bg-white lg:block"
          aria-hidden="true"
        />
      ) : signedIn ? (
        <SignedInActions displayName={displayName} className="hidden lg:flex" />
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
            <SheetTitle className="pr-10 text-xl font-bold tracking-[-0.03em]">
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
