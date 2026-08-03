import { Headphones } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/public/brand";
import { cn } from "@/lib/utils";

export function GuestHeader({
  brandSize = "default",
  className,
  trailing = "support",
}: {
  brandSize?: "default" | "large";
  className?: string;
  trailing?: "login" | "support";
}) {
  return (
    <header className={cn("flex items-center justify-between gap-5", className)}>
      <Brand size={brandSize} compact />
      <nav className="flex items-center gap-4 text-sm" aria-label="Guest navigation">
        <Link
          href="/how-it-works"
          className="whitespace-nowrap font-semibold text-[#071733] transition-colors hover:text-[#5f7f00]"
        >
          How It Works
        </Link>
        <span className="hidden h-5 w-px bg-[#d4ddea] sm:block" aria-hidden="true" />
        {trailing === "login" ? (
          <Link
            href="/login"
            className="whitespace-nowrap font-semibold text-[#071733] transition-colors hover:text-[#5f7f00]"
          >
            Log In
          </Link>
        ) : (
          <p className="hidden items-center gap-2 text-[#526580] sm:flex">
            <Headphones className="size-5 text-[#071733]" aria-hidden="true" /> Need help?
            <Link href="/contact" className="font-semibold text-[#0068e8]">
              Contact support
            </Link>
          </p>
        )}
      </nav>
    </header>
  );
}
