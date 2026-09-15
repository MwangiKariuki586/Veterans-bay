import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function Brand({
  compact = false,
  size = "default",
}: {
  compact?: boolean;
  size?: "default" | "large";
}) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fbd00] focus-visible:ring-offset-2"
      aria-label="Veterans Bay home"
    >
      <Image
        src="/images/veterans-bay-logo.png"
        alt=""
        width={1249}
        height={389}
        className={cn(
          "h-auto object-contain",
          size === "large"
            ? compact
              ? "w-[112px] min-[380px]:w-[140px] sm:w-[250px]"
              : "w-[250px]"
            : compact
              ? "w-[108px] min-[380px]:w-[132px] sm:w-[188px]"
              : "w-[188px]",
        )}
        sizes={size === "large" ? "(max-width: 379px) 112px, (max-width: 639px) 140px, 250px" : "(max-width: 379px) 108px, (max-width: 639px) 132px, 188px"}
      />
    </Link>
  );
}
