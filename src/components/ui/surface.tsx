import type { HTMLAttributes } from "react";

import { cardSurfaceClass } from "@/components/public/design";
import { cn } from "@/lib/utils";

export function Surface({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(cardSurfaceClass, className)} {...props} />;
}
