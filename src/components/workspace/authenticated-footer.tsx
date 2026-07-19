import { ArrowRight, Headphones, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/public/brand";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { getAuthenticatedFooterLinks } from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";

export function AuthenticatedFooter({
  kind,
}: {
  kind: AuthenticatedShellKind;
}) {
  const year = new Date().getFullYear();
  const links = getAuthenticatedFooterLinks(kind);

  return (
    <footer className="mt-6 overflow-hidden rounded-[22px] border border-black/8 bg-white">
      <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <Brand compact />
        <nav
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-[#68717b]"
          aria-label="App footer"
        >
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/help"
          className="inline-flex h-11 items-center gap-3 rounded-full border border-black/8 bg-[#f7f9fa] py-1 pr-1 pl-3.5 text-sm font-semibold"
        >
          <Headphones className="size-4 text-[#5f8d11]" aria-hidden="true" />
          Need help?
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Link>
      </div>

      <div
        className={cn(
          "flex flex-col gap-3 border-t border-black/8 px-5 py-4 text-xs text-[#68717b]",
          "sm:flex-row sm:items-center sm:justify-between sm:px-7",
        )}
      >
        <p className="inline-flex items-center gap-2 font-medium text-[#3d4a2a]">
          <ShieldCheck className="size-4 text-[#5f8d11]" aria-hidden="true" />
          You&apos;re protected. We&apos;ve got your back.
        </p>
        <p>© {year} Veterans Bay. All rights reserved.</p>
        <nav className="flex flex-wrap gap-4" aria-label="Legal">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Service
          </Link>
          <Link href="/cookies" className="hover:text-foreground">
            Cookie Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
