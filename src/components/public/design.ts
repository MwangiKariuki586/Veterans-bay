import { cn } from "@/lib/utils";

/** Homepage-aligned card surface used across operational and auth pages. */
export const cardSurfaceClass =
  "rounded-[22px] border border-black/8 bg-white text-foreground shadow-[0_18px_55px_rgba(20,38,52,0.07)]";

/** Soft circular control matching homepage header icon buttons. */
export const iconButtonClass =
  "grid size-12 shrink-0 place-items-center rounded-full border border-black/8 bg-white text-foreground transition-colors hover:bg-[#f7f9fa]";

/** Soft pill chrome used for avatar/workspace chips. */
export const pillChromeClass =
  "inline-flex items-center gap-3 rounded-full border border-black/8 bg-white";

/** Page backdrop used by the homepage and secondary shells. */
export const pageBackdropClass =
  "min-h-screen bg-[radial-gradient(circle_at_top,#fff_0%,#eef3f6_66%,#e7edf0_100%)]";

export function pageFrameClass(className?: string) {
  return cn("mx-auto w-full max-w-[1340px] px-4 py-6 sm:px-6 lg:px-[26px] lg:py-8", className);
}
