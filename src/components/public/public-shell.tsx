"use client";

import type { ReactNode } from "react";

import { pageBackdropClass, pageFrameClass } from "@/components/public/design";
import { PublicFooter } from "@/components/public/public-footer";
import { SiteHeader } from "@/components/public/site-header";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export { SiteHeader as PublicHeader } from "@/components/public/site-header";
export { PublicFooter } from "@/components/public/public-footer";

export function PublicShell({
  children,
  marketplace = false,
}: {
  children: ReactNode;
  marketplace?: boolean;
}) {
  return (
    <div className={pageBackdropClass}>
      <div
        className={pageFrameClass(
          marketplace
            ? "max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5"
            : undefined,
        )}
      >
        <SiteHeader marketplace={marketplace} />
        <div className={marketplace ? "mt-5 sm:mt-7" : "mt-8"}>{children}</div>
        <PublicFooter marketplace={marketplace} />
      </div>
    </div>
  );
}

export function PublicPageIntro({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-3xl text-center", className)}>
      <span className="inline-flex items-center gap-2 rounded-full border border-black/7 bg-white/92 px-4 py-2 text-[0.78rem] text-[#626b75]">
        <ShieldCheck
          className="size-4 fill-primary text-[#5f8d11]"
          aria-hidden="true"
        />
        {eyebrow}
      </span>
      <h1 className="mt-6 text-4xl leading-[1.05] font-bold tracking-title sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 text-base leading-7 text-[#68717b] sm:text-lg">
        {description}
      </p>
    </div>
  );
}
