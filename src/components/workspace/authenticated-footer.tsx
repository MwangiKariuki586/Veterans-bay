import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";

export function AuthenticatedFooter({
  className,
}: {
  kind: AuthenticatedShellKind;
  className?: string;
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "overflow-hidden rounded-[22px] border border-black/8 bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3 px-5 py-4 text-xs text-[#68717b]",
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
        </nav>
      </div>
    </footer>
  );
}
