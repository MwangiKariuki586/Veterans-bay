import {
  AlertCircle,
  Ban,
  CheckCircle2,
  FilterX,
  Inbox,
  LoaderCircle,
  Lock,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Spinner } from "./spinner";

export const feedbackStateVariants = [
  "loading",
  "empty",
  "filtered",
  "error",
  "permission",
  "stale",
  "unavailable",
  "success",
  "processing",
] as const;

export type FeedbackStateVariant = (typeof feedbackStateVariants)[number];

const variantConfig: Record<
  FeedbackStateVariant,
  {
    Icon: typeof Inbox;
    toneClass: string;
    live?: "polite" | "assertive";
    actionVariant: "outline" | "secondary" | "primary";
  }
> = {
  loading: {
    Icon: LoaderCircle,
    toneClass: "bg-info-soft text-info",
    live: "polite",
    actionVariant: "outline",
  },
  empty: {
    Icon: Inbox,
    toneClass: "bg-trust-soft text-trust",
    actionVariant: "secondary",
  },
  filtered: {
    Icon: FilterX,
    toneClass: "bg-info-soft text-info",
    actionVariant: "outline",
  },
  error: {
    Icon: AlertCircle,
    toneClass: "bg-danger-soft text-danger",
    live: "assertive",
    actionVariant: "outline",
  },
  permission: {
    Icon: Lock,
    toneClass: "bg-warning-soft text-warning",
    live: "assertive",
    actionVariant: "outline",
  },
  stale: {
    Icon: RefreshCw,
    toneClass: "bg-warning-soft text-warning",
    live: "assertive",
    actionVariant: "secondary",
  },
  unavailable: {
    Icon: Ban,
    toneClass: "bg-muted text-muted-foreground",
    live: "polite",
    actionVariant: "outline",
  },
  success: {
    Icon: CheckCircle2,
    toneClass: "bg-success-soft text-success",
    live: "polite",
    actionVariant: "primary",
  },
  processing: {
    Icon: ShieldAlert,
    toneClass: "bg-info-soft text-info",
    live: "polite",
    actionVariant: "outline",
  },
};

interface StatePanelProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** @deprecated Prefer `variant="empty"` or another feedback state. */
  variant?: "empty" | "error" | FeedbackStateVariant;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
  headingLevel?: 1 | 2 | 3;
}

export function StatePanel({
  actionLabel,
  children,
  className,
  description,
  icon,
  headingLevel = 3,
  onAction,
  title,
  variant = "empty",
}: StatePanelProps) {
  const resolvedVariant =
    variant === "empty" || variant === "error"
      ? variant
      : (variant as FeedbackStateVariant);
  const config = variantConfig[resolvedVariant] ?? variantConfig.empty;
  const Icon = config.Icon;
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  const showSpinner = resolvedVariant === "loading" || resolvedVariant === "processing";

  return (
    <section
      aria-busy={showSpinner || undefined}
      aria-live={config.live}
      className={cn(
        "grid justify-items-center gap-3 rounded-[22px] border border-dashed border-black/10 bg-[#f7f9fa] px-5 py-8 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-full",
          config.toneClass,
        )}
      >
        {icon ??
          (showSpinner ? (
            <Spinner className="size-5" />
          ) : (
            <Icon className="size-5" aria-hidden="true" />
          ))}
      </span>
      <div className="grid max-w-sm gap-1">
        <Heading className="type-section-title">{title}</Heading>
        <p className="type-body text-muted-foreground">{description}</p>
      </div>
      {children}
      {actionLabel ? (
        <Button
          type="button"
          variant={config.actionVariant}
          size="sm"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
