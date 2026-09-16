import Image from "next/image";

import { cn } from "@/lib/utils";

type ProfileAvatarProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: 40 | 56 | 64 | 80 | 96;
  variant?: "person" | "business";
  className?: string;
};

const sizeMap: Record<NonNullable<ProfileAvatarProps["size"]>, string> = {
  40: "size-10 text-sm",
  56: "size-14 text-base",
  64: "size-16 text-lg",
  80: "size-20 text-xl",
  96: "size-24 text-2xl",
};

export function ProfileAvatar({
  src,
  alt,
  fallback,
  size = 96,
  variant = "person",
  className,
}: ProfileAvatarProps) {
  const initials = fallback.trim().slice(0, 2).toUpperCase() || "VB";

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden border border-black/8 bg-[#eef1f2] font-semibold text-[#071522]",
        variant === "person" ? "rounded-full" : "rounded-[26px]",
        sizeMap[size],
        !src && variant === "business" && "bg-[#0a1930] text-white border-[#0a1930]",
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </div>
  );
}
