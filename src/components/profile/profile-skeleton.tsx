import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";

export function ProfileHeroSkeleton() {
  return (
    <Surface className="p-6 sm:p-8" aria-busy="true" aria-label="Loading profile">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Skeleton className="size-24 shrink-0 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-28 rounded-full max-sm:w-full" />
      </div>
    </Surface>
  );
}

export function ProfileSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Surface className="p-6 sm:p-8" aria-busy="true" aria-label="Loading section">
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 py-2">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading profile page">
      <ProfileHeroSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <div className="space-y-5">
          <ProfileSectionSkeleton rows={5} />
          <ProfileSectionSkeleton rows={3} />
        </div>
        <div className="space-y-5">
          <ProfileSectionSkeleton rows={3} />
          <ProfileSectionSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}
