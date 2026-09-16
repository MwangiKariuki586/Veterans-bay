import { Camera, Mail, MapPin, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

import { ProfileAvatar } from "./profile-avatar";
import { ProfileStatusBadge } from "./profile-status-badge";

type IdentityMeta = {
  icon: "email" | "phone" | "location";
  value: string;
};

const iconMap = {
  email: Mail,
  phone: Phone,
  location: MapPin,
} as const;

type ProfileIdentityHeaderProps = {
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  avatarFallback: string;
  avatarVariant?: "person" | "business";
  verified?: boolean;
  verifiedLabel?: string;
  meta?: IdentityMeta[];
  memberSince?: string | null;
  onEdit?: () => void;
  editLabel?: string;
  editing?: boolean;
  onChangePhoto?: () => void;
  changePhotoLabel?: string;
  className?: string;
  children?: React.ReactNode;
};

function formatMemberSince(value?: string | null) {
  if (!value) return null;
  try {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

export function ProfileIdentityHeader({
  name,
  subtitle,
  avatarUrl,
  avatarFallback,
  avatarVariant = "person",
  verified,
  verifiedLabel = "Verified",
  meta = [],
  memberSince,
  onEdit,
  editLabel = "Edit profile",
  editing = false,
  onChangePhoto,
  changePhotoLabel = "Change photo",
  className,
  children,
}: ProfileIdentityHeaderProps) {
  const memberSinceLabel = formatMemberSince(memberSince);

  return (
    <Surface className={cn("relative overflow-hidden p-6 sm:p-8", className)}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <ProfileAvatar
            src={avatarUrl}
            alt={`${name} profile photo`}
            fallback={avatarFallback}
            size={96}
            variant={avatarVariant}
          />
          {onChangePhoto ? (
            <button
              type="button"
              onClick={onChangePhoto}
              aria-label={changePhotoLabel}
              className="absolute bottom-0 right-0 grid size-8 place-items-center rounded-full border border-black/8 bg-white text-[#071522] shadow-sm transition-colors hover:bg-[#f7f9fa]"
            >
              <Camera className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="type-workspace-title tracking-title">{name}</h2>
            {verified ? (
              <ProfileStatusBadge tone="success" icon="verified">
                {verifiedLabel}
              </ProfileStatusBadge>
            ) : null}
          </div>
          <p className="mt-1 type-caption font-semibold text-muted-foreground">{subtitle}</p>

          {meta.length > 0 ? (
            <div className="mt-3 grid gap-2 type-body text-muted-foreground">
              {meta.map((row) => {
                const Icon = iconMap[row.icon];
                return (
                  <p key={`${row.icon}-${row.value}`} className="inline-flex items-center gap-2">
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 truncate">{row.value}</span>
                  </p>
                );
              })}
            </div>
          ) : null}

          {memberSinceLabel ? (
            <p className="mt-2 type-caption text-muted-foreground">
              Member since {memberSinceLabel}
            </p>
          ) : null}

          {children ? <div className="mt-4">{children}</div> : null}
        </div>

        {onEdit ? (
          <Button
            variant="outline"
            type="button"
            className="shrink-0 rounded-full border-black/8 max-sm:w-full"
            onClick={onEdit}
            aria-pressed={editing}
          >
            {editing ? "Cancel" : editLabel}
          </Button>
        ) : null}
      </div>
    </Surface>
  );
}
