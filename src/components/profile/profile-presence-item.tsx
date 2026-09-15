import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProfilePresenceItemProps = {
  title: string;
  subtitle: string;
  badge?: string;
  href?: string;
  cta?: string;
  tone?: "neutral" | "success";
  className?: string;
};

export function ProfilePresenceItem({
  title,
  subtitle,
  badge,
  href,
  cta,
  tone = "neutral",
  className,
}: ProfilePresenceItemProps) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="type-body font-semibold text-foreground">{title}</p>
        <p className="type-caption text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge ? (
          <Badge
            variant={tone === "success" ? "success" : "neutral"}
            className="font-semibold"
          >
            {badge}
          </Badge>
        ) : null}
        {cta ? (
          <span className="inline-flex items-center gap-1 type-control font-semibold text-[#5f8d11]">
            {cta} <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </>
  );

  const classes = cn(
    "flex items-center justify-between gap-3 rounded-2xl bg-[#f7f9fa] px-4 py-3 transition-colors",
    href && "hover:bg-muted",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return <div className={classes}>{content}</div>;
}
