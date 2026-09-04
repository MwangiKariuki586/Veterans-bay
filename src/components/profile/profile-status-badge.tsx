import { BadgeCheck, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProfileStatusBadgeProps = {
  children: React.ReactNode;
  tone?: "success" | "trust" | "neutral" | "info" | "warning";
  icon?: "verified" | "shield" | "none";
  className?: string;
};

export function ProfileStatusBadge({
  children,
  tone = "neutral",
  icon = "none",
  className,
}: ProfileStatusBadgeProps) {
  const variantMap = {
    success: "success" as const,
    trust: "trust" as const,
    neutral: "neutral" as const,
    info: "info" as const,
    warning: "warning" as const,
  };

  const Icon = icon === "verified" ? BadgeCheck : icon === "shield" ? ShieldCheck : null;

  return (
    <Badge variant={variantMap[tone]} className={cn("font-semibold", className)}>
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {children}
    </Badge>
  );
}
