import {
  SiteHeader,
  type FocusedHeaderTrailing,
} from "@/components/public/site-header";

export function GuestHeader({
  brandSize = "default",
  className,
  trailing = "support",
}: {
  brandSize?: "default" | "large";
  className?: string;
  trailing?: FocusedHeaderTrailing;
}) {
  return (
    <SiteHeader
      variant="focused"
      brandSize={brandSize}
      className={className}
      trailing={trailing}
    />
  );
}
