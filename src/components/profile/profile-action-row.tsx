import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ProfileActionRowProps = {
  label: string;
  description?: string;
  value?: React.ReactNode;
  href?: string;
  cta?: string;
  onClick?: () => void;
  className?: string;
};

export function ProfileActionRow({
  label,
  description,
  value,
  href,
  cta,
  onClick,
  className,
}: ProfileActionRowProps) {
  const trailing = cta ? (
    <span className="inline-flex items-center gap-1 type-control font-semibold text-[#5f8d11]">
      {cta} <ChevronRight className="size-3.5" aria-hidden="true" />
    </span>
  ) : value ? (
    <span className="type-caption font-semibold text-muted-foreground">{value}</span>
  ) : null;

  const inner = (
    <>
      <div className="min-w-0">
        <p className="type-body font-semibold text-foreground">{label}</p>
        {description ? (
          <p className="type-caption mt-0.5 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  const base = cn(
    "flex flex-wrap items-center justify-between gap-3 border-b border-black/8 py-4 last:border-0 last:pb-0 first:pt-0",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cn(base, "hover:opacity-80")}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, "w-full text-left hover:opacity-80")}>
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}
