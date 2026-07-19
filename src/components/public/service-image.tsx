"use client";

import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function ServiceImage({
  src,
  alt,
  className,
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn(
          "grid h-full min-h-48 place-items-center bg-gradient-to-br from-trust-soft via-surface-subtle to-muted text-trust",
          className,
        )}
        role="img"
        aria-label={`${alt} image unavailable`}
      >
        <span className="grid justify-items-center gap-2 text-sm font-semibold">
          <ImageIcon className="size-8" aria-hidden="true" />
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <div className={cn("relative min-h-48 overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
