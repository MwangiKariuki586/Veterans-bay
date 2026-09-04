import { Shield } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ProfileCalloutProps = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  className?: string;
};

export function ProfileCallout({
  title,
  description,
  ctaLabel,
  ctaHref,
  className,
}: ProfileCalloutProps) {
  return (
    <div
      className={cn(
        "rounded-[22px] border border-black/8 bg-[#f7f9fa] p-6 sm:p-7",
        className,
      )}
    >
      <div className="flex gap-4">
        <span className="hidden size-10 shrink-0 place-items-center rounded-full bg-white text-[#5f8d11] sm:grid">
          <Shield className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="type-body font-semibold text-foreground">{title}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex items-center gap-1 type-control font-semibold text-[#5f8d11] hover:underline"
          >
            {ctaLabel} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
