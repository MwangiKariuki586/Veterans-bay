"use client";

import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceContentReady } from "@/components/workspace/workspace-chrome";
import { cn } from "@/lib/utils";

function SkeletonBlock({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return <Skeleton className={cn("rounded-2xl", className)} {...props} />;
}

function BusyFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  useWorkspaceContentReady(false);
  return (
    <div aria-busy="true" className={className}>
      {children}
    </div>
  );
}

export function PageHeaderSkeleton({
  actions = 0,
  className,
}: {
  actions?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="grid gap-2">
        <SkeletonBlock className="h-3 w-28 rounded-full" />
        <SkeletonBlock className="h-9 w-56" />
        <SkeletonBlock className="h-4 w-80 max-w-full" />
      </div>
      {actions > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }).map((_, index) => (
            <SkeletonBlock key={index} className="h-10 w-32 rounded-xl" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FilterChipSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="mt-6 flex gap-2 overflow-hidden pb-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonBlock
          key={index}
          className="h-10 w-24 shrink-0 rounded-full"
        />
      ))}
    </div>
  );
}

export function ListPageSkeleton({
  rows = 4,
  actions = 0,
  className,
}: {
  rows?: number;
  actions?: number;
  className?: string;
}) {
  return (
    <BusyFrame className={cn(className)}>
      <PageHeaderSkeleton actions={actions} />
      <FilterChipSkeleton />
      <div className="mt-5 grid gap-4">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonBlock key={index} className="h-28 w-full rounded-[22px]" />
        ))}
      </div>
    </BusyFrame>
  );
}

export function DetailPageSkeleton({ className }: { className?: string }) {
  return (
    <BusyFrame className={cn("grid gap-4", className)}>
      <div className="grid gap-2">
        <SkeletonBlock className="h-3 w-24 rounded-full" />
        <SkeletonBlock className="h-9 w-72 max-w-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-4">
          <SkeletonBlock className="h-48 w-full rounded-[22px]" />
          <SkeletonBlock className="h-64 w-full rounded-[22px]" />
        </div>
        <div className="grid gap-4">
          <SkeletonBlock className="h-40 w-full rounded-[22px]" />
          <SkeletonBlock className="h-32 w-full rounded-[22px]" />
        </div>
      </div>
    </BusyFrame>
  );
}

export function ProfessionalDashboardSkeleton() {
  return (
    <BusyFrame className="space-y-3">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="grid gap-2">
          <SkeletonBlock className="h-8 w-72 max-w-full" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
          <SkeletonBlock className="h-11 w-full rounded-xl" />
        </div>
      </section>

      <section className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
        <div className="grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock key={index} className="h-36 w-full rounded-[22px]" />
          ))}
        </div>
        <SkeletonBlock className="h-36 w-full rounded-[22px]" />
      </section>

      <div className="grid items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(260px,1fr)_minmax(0,0.55fr)]">
        <SkeletonBlock className="h-72 w-full rounded-[22px]" />
        <SkeletonBlock className="h-72 w-full rounded-[22px] xl:col-span-2" />
        <div className="grid gap-3">
          <SkeletonBlock className="h-40 w-full rounded-[22px]" />
          <SkeletonBlock className="h-28 w-full rounded-[22px]" />
        </div>
        <SkeletonBlock className="h-56 w-full rounded-[22px] xl:col-span-2" />
        <SkeletonBlock className="h-56 w-full rounded-[22px]" />
      </div>
    </BusyFrame>
  );
}

export function WorkspaceMainSkeleton({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <BusyFrame className="grid gap-4">
      {children ?? (
        <>
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-80 max-w-full" />
          <SkeletonBlock className="mt-2 h-64 w-full rounded-[22px]" />
        </>
      )}
    </BusyFrame>
  );
}
