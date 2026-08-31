import { ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const tones = {
  purple: "bg-[#f1eaff] text-[#6335e9]",
  blue: "bg-[#eaf1ff] text-[#245eea]",
  green: "bg-[#edf7dd] text-[#6d9f16]",
  orange: "bg-[#fff0df] text-[#e26e17]",
  yellow: "bg-[#fff7e8] text-[#b77900]",
} as const;

export function WorkspaceMetricCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  hintTone = "muted",
  href,
  action,
  layout = "stacked",
  className,
}: {
  icon: LucideIcon;
  tone: keyof typeof tones;
  label: string;
  value: number | string;
  hint?: string;
  hintTone?: "muted" | "danger";
  href?: string;
  action?: string;
  layout?: "stacked" | "horizontal";
  className?: string;
}) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString() : value;

  if (layout === "horizontal") {
    return (
      <Surface
        className={cn(
          "flex min-h-[84px] items-center gap-4 rounded-[16px] p-4 shadow-[0_4px_16px_rgba(15,31,43,0.035)]",
          className,
        )}
      >
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-[14px]", tones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block type-card-label text-muted-foreground">{label}</span>
          <span className="mt-0.5 block text-xl font-semibold leading-none text-foreground numeric-tabular">
            {displayValue}
          </span>
        </span>
      </Surface>
    );
  }

  return (
    <Surface className={cn("flex h-[128px] flex-col rounded-[16px] p-3 shadow-[0_4px_16px_rgba(15,31,43,0.04)]", className)}>
      <div className="grid grid-cols-[36px_minmax(0,1fr)] gap-x-2.5">
        <span className={cn("grid size-9 place-items-center rounded-[10px]", tones[tone])}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 min-h-7 text-[0.72rem] font-medium leading-3.5 text-muted-foreground">{label}</span>
          <span className="mt-0.5 block type-metric font-semibold leading-none text-foreground">{displayValue}</span>
          {hint ? (
            <span className={cn("mt-0.5 block truncate text-[0.67rem] leading-none", hintTone === "danger" ? "font-medium text-danger" : "text-muted-foreground")}>
              {hint}
            </span>
          ) : null}
        </span>
      </div>
      {href && action ? (
        <Link href={href} className="ml-[46px] mt-1.5 inline-flex w-fit items-center gap-1 py-0.5 text-[0.7rem] font-semibold text-trust underline-offset-4 transition-colors hover:text-foreground hover:underline">
          {action}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </Surface>
  );
}
