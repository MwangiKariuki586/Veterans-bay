import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function PageContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
