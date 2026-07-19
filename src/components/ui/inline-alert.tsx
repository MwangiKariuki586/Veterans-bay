import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const alertVariants = {
  error: {
    Icon: AlertCircle,
    className: "border-danger/30 bg-danger-soft text-danger",
    live: "assertive" as const,
  },
  warning: {
    Icon: TriangleAlert,
    className: "border-warning/30 bg-warning-soft text-warning",
    live: "assertive" as const,
  },
  success: {
    Icon: CheckCircle2,
    className: "border-success/30 bg-success-soft text-success",
    live: "polite" as const,
  },
  info: {
    Icon: Info,
    className: "border-info/30 bg-info-soft text-info",
    live: "polite" as const,
  },
};

export type InlineAlertVariant = keyof typeof alertVariants;

interface InlineAlertProps {
  title: string;
  description?: string;
  variant?: InlineAlertVariant;
  className?: string;
  children?: ReactNode;
  /** Correlation / request id for support when safe to show. */
  requestId?: string;
}

/**
 * Critical feedback that must appear inline — not only as a toast.
 */
export function InlineAlert({
  children,
  className,
  description,
  requestId,
  title,
  variant = "error",
}: InlineAlertProps) {
  const config = alertVariants[variant];
  const Icon = config.Icon;

  return (
    <div
      role={variant === "error" || variant === "warning" ? "alert" : "status"}
      aria-live={config.live}
      className={cn(
        "grid gap-2 rounded-lg border px-4 py-3 text-left",
        config.className,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="font-bold text-foreground">{title}</p>
          {description ? (
            <p className="text-sm leading-6 text-foreground/80">{description}</p>
          ) : null}
          {requestId ? (
            <p className="font-mono text-xs text-muted-foreground">
              Reference: {requestId}
            </p>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
