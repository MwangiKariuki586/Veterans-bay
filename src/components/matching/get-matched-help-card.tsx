"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { GetMatchedDrawer } from "./get-matched-drawer";

/**
 * Marketplace help card. Keeps the approved visual treatment and opens the
 * guided Get matched drawer instead of the generic support page, so guests
 * and clients can narrow down a service before requesting or booking.
 */
export function GetMatchedHelpCard({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className={className ?? "rounded-2xl border border-[#e8ecd7] bg-[#fbfdf4] p-5"}>
        <span className="grid size-11 place-items-center rounded-full bg-[#eff8cf] text-[#648f12]">?</span>
        <h2 className="mt-3 text-base font-semibold">Need help choosing?</h2>
        <p className="mt-2 text-sm leading-6 text-[#425671]">
          Tell us what you need and we&apos;ll help you find the right professional.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 flex h-10 w-full items-center justify-between rounded-xl bg-primary px-4 text-xs font-semibold"
        >
          Get matched <ArrowRight className="size-4" />
        </button>
      </aside>
      <GetMatchedDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
