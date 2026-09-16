"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type ProfilePhotoDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUrl?: string | null;
  fallback: string;
  variant?: "person" | "business";
  title?: string;
  description?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
  allowRemove?: boolean;
};

export function ProfilePhotoDrawer({
  open,
  onOpenChange,
  currentUrl,
  fallback,
  variant = "person",
  title = "Update photo",
  description = "Choose a clear photo. JPG, PNG or WebP, up to 2MB.",
  onUpload,
  onRemove,
  allowRemove = true,
}: ProfilePhotoDrawerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const displayUrl = preview ?? currentUrl ?? null;

  const canSave = useMemo(() => file !== null, [file]);

  function handleFile(next: File | null) {
    setError(null);
    if (!next) {
      setFile(null);
      setPreview(null);
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(next.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (next.size > 2 * 1024 * 1024) {
      setError("Image must be under 2MB.");
      return;
    }
    setFile(next);
    const url = URL.createObjectURL(next);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  async function handleSave() {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      await onUpload(file);
      setFile(null);
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save photo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!onRemove) return;
    setRemoving(true);
    setError(null);
    try {
      await onRemove();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to remove photo.");
    } finally {
      setRemoving(false);
    }
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setFile(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex w-[min(31rem,94vw)] flex-col p-0 sm:w-[31rem]"
        aria-describedby={undefined}
      >
        <div className="border-b border-black/8 px-6 py-5">
          <SheetTitle className="type-section-title tracking-title">{title}</SheetTitle>
          <SheetDescription className="mt-1 type-body text-muted-foreground">
            {description}
          </SheetDescription>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <ProfileAvatar
              src={displayUrl}
              alt="Preview"
              fallback={fallback}
              size={96}
              variant={variant}
              className="size-28"
            />
            {currentUrl ? (
              <p className="type-caption text-muted-foreground">Current photo</p>
            ) : (
              <p className="inline-flex items-center gap-2 type-caption text-muted-foreground">
                <ImageIcon className="size-3.5" aria-hidden="true" /> No photo yet
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="type-caption font-semibold text-foreground" htmlFor="profile-photo">
              Upload new photo
            </label>
            <Input
              id="profile-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            <p className="type-caption text-muted-foreground">PNG, JPG or WebP, max 2MB.</p>
          </div>

          {error ? <InlineAlert variant="error" title="Unable to save" description={error} /> : null}

          {allowRemove && currentUrl && onRemove ? (
            <div className="rounded-2xl border border-black/8 bg-[#f7f9fa] p-4">
              <p className="type-body font-semibold">Remove current photo</p>
              <p className="mt-1 type-caption text-muted-foreground">
                This will revert to initials until you add a new photo.
              </p>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="mt-3"
                loading={removing}
                onClick={() => void handleRemove()}
              >
                <Trash2 className="size-4" aria-hidden="true" /> Remove photo
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/8 bg-white px-6 py-4">
          <Button variant="ghost" type="button" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={saving}
            disabled={!canSave}
            onClick={() => void handleSave()}
          >
            <Upload className="size-4" aria-hidden="true" /> Save photo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
