import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ProfileFieldProps = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  className?: string;
};

export function ProfileField({ icon: Icon, label, value, className }: ProfileFieldProps) {
  return (
    <div className={cn("flex items-center gap-4 py-4", className)}>
      <span className="grid size-10 place-items-center rounded-full bg-[#f7f9fa] text-[#5f8d11]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="type-caption text-muted-foreground">{label}</dt>
        <dd className="mt-1 type-body font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

type ProfileFieldListProps = {
  children: React.ReactNode;
  className?: string;
};

export function ProfileFieldList({ children, className }: ProfileFieldListProps) {
  return <dl className={cn("divide-y divide-black/8", className)}>{children}</dl>;
}
