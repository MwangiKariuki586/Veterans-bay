import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type ProfileSectionProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ProfileSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: ProfileSectionProps) {
  return (
    <Surface className={cn("p-6 sm:p-8", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="type-section-title tracking-title">{title}</h3>
          {description ? (
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-6", contentClassName)}>{children}</div>
    </Surface>
  );
}
