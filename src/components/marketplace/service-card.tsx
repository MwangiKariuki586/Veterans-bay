import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shared marketplace service-card layout, also used for managing service offers. */
export function ServiceCard({
  image,
  title,
  children,
  footer,
  action,
  listView = false,
  selected = false,
  onOpen,
}: {
  image: ReactNode;
  title: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  action?: ReactNode;
  listView?: boolean;
  selected?: boolean;
  onOpen?: () => void;
}) {
  return (
    <article onClick={onOpen ? (event) => {
      const target = event.target as HTMLElement;
      if (event.currentTarget.contains(target) && !target.closest("button, a, input, select, textarea, [role='menuitem']")) onOpen();
    } : undefined} className={cn(
      "group relative overflow-hidden rounded-2xl border border-black/8 bg-white transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,38,52,0.1)]",
      listView && "sm:grid sm:grid-cols-[220px_minmax(0,1fr)]",
      "max-sm:grid max-sm:grid-cols-[42%_58%]",
      selected && "border-success/60",
      onOpen && "cursor-pointer",
    )}>
      {action}
      {image}
      <div className="flex min-w-0 flex-col p-3 sm:p-4">
        <h2 className="pr-8 text-sm leading-5 font-semibold sm:text-[0.88rem]">{title}</h2>
        {children}
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-black/8 pt-2 max-sm:mt-2">{footer}</div>
      </div>
    </article>
  );
}

export function ServiceCardSkeleton() {
  return (
    <ServiceCard
      image={<Skeleton className="min-h-[150px] rounded-none sm:aspect-[16/9] sm:min-h-0" />}
      title={<Skeleton className="h-5 w-full" />}
      footer={<><Skeleton className="h-8 w-20" /><Skeleton className="size-8 rounded-full" /></>}
    >
      <div className="space-y-2 py-3">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </ServiceCard>
  );
}
