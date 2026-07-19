import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none"
      aria-label="Veterans Bay home"
    >
      <Image
        src="/images/veterans-bay-mark.png"
        alt=""
        width={52}
        height={52}
        className="size-11 rounded-full object-cover shadow-[0_4px_14px_rgba(8,24,36,0.04)] sm:size-13"
      />
      <span className={cn("grid leading-none", compact && "hidden sm:grid")}>
        <span className="text-[1.05rem] font-bold tracking-[-0.035em]">
          Veterans Bay
        </span>
        <span className="mt-1.5 text-[0.67rem] text-muted-foreground">
          Trusted. Skilled. Reliable.
        </span>
      </span>
    </Link>
  );
}
