import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-2.5 text-sm text-foreground transition-colors placeholder:text-[#7a8188] focus-visible:border-[#071522]/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-[#f7f9fa] disabled:opacity-70 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
