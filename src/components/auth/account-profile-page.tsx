"use client";

import {
  ArrowRight,
  Calendar,
  CreditCard,
  Heart,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ProfileActionRow,
  ProfileCallout,
  ProfileField,
  ProfileFieldList,
  ProfileIdentityHeader,
  ProfilePhotoDrawer,
  ProfilePresenceItem,
  ProfileSection,
  ProfilePageSkeleton,
} from "@/components/profile";
import { uploadAvatarImage } from "@/components/profile/profile-helpers";
import { PublicShell } from "@/components/public/public-shell";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { loginHrefFor } from "@/lib/auth-redirect";
import type { PublicAccountProfile } from "@/modules/identity/types";
import type { WorkspaceSummary } from "@/modules/workspace/types";

async function fetchProfile(): Promise<PublicAccountProfile> {
  const response = await fetch("/api/v1/account/profile", {
    credentials: "include",
  });
  const body = (await response.json()) as {
    data?: PublicAccountProfile;
    error?: { code?: string };
  };
  if (!response.ok || !body.data)
    throw new Error(body.error?.code ?? "PROFILE_UNAVAILABLE");
  return body.data;
}

async function fetchWorkspaces(): Promise<WorkspaceSummary[]> {
  const response = await fetch("/api/v1/workspaces", {
    credentials: "include",
  });
  const body = (await response.json()) as {
    data?: { workspaces: WorkspaceSummary[] };
  };
  if (!response.ok || !body.data) return [];
  return body.data.workspaces;
}

async function fetchSessionsCount(): Promise<number | null> {
  try {
    const response = await fetch("/api/v1/account/sessions", {
      credentials: "include",
    });
    const body = (await response.json()) as { data?: unknown[] };
    if (!response.ok || !Array.isArray(body.data)) return null;
    return body.data.length;
  } catch {
    return null;
  }
}

export function AccountProfilePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<PublicAccountProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace(loginHrefFor("/account/profile"));
      return;
    }
    Promise.all([fetchProfile(), fetchWorkspaces(), fetchSessionsCount()])
      .then(([p, ws, sc]) => {
        setProfile(p);
        setWorkspaces(ws);
        setSessionsCount(sc);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load your profile.");
        setLoading(false);
      });
  }, [isPending, router, session]);

  const presence = useMemo(() => {
    if (!workspaces)
      return { professional: null as WorkspaceSummary | null, teamCount: 0 };
    const professional =
      workspaces.find((w) => w.kind === "organisation") ?? null;
    const extraMemberships = Math.max(
      0,
      workspaces.filter((w) => w.kind === "organisation").length -
        (professional ? 1 : 0),
    );
    return { professional, teamCount: extraMemberships };
  }, [workspaces]);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = formRef.current?.querySelector<HTMLInputElement>(
        "input, textarea, select",
      );
      firstField?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const phoneRaw = String(form.get("phone") ?? "").trim();
    const locationRaw = String(form.get("location") ?? "").trim();
    const bioRaw = String(form.get("bio") ?? "").trim();
    setSaving(true);
    setError(null);
    const response = await fetch("/api/v1/account/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName,
        phone: phoneRaw || null,
        location: locationRaw || null,
        bio: bioRaw || null,
      }),
    });
    const body = (await response.json()) as {
      data?: PublicAccountProfile;
      error?: { message?: string };
    };
    setSaving(false);
    if (!response.ok || !body.data) {
      setError(body.error?.message ?? "Unable to update your profile.");
      toast.error("Unable to save profile", {
        description: body.error?.message ?? "Please try again.",
      });
      return;
    }
    setProfile(body.data);
    setEditing(false);
    toast.success("Profile updated.");
  }

  async function handleAvatarUpload(file: File) {
    const assetId = await uploadAvatarImage(file);
    const response = await fetch("/api/v1/account/avatar", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    const body = (await response.json()) as { data?: PublicAccountProfile };
    if (!response.ok || !body.data) throw new Error("Unable to attach photo.");
    setProfile(body.data);
    toast.success("Photo updated.");
  }

  async function handleAvatarRemove() {
    const response = await fetch("/api/v1/account/avatar", {
      method: "DELETE",
      credentials: "include",
    });
    const body = (await response.json()) as { data?: PublicAccountProfile };
    if (!response.ok || !body.data) throw new Error("Unable to remove photo.");
    setProfile(body.data);
    toast.success("Photo removed.");
  }

  async function onSignOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  async function onDeactivate() {
    setDeactivating(true);
    const response = await fetch("/api/v1/account/deactivate", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "DEACTIVATE" }),
    });
    setDeactivating(false);
    if (!response.ok) {
      toast.error("Unable to deactivate the account.");
      return;
    }
    toast.success("Account deactivated.");
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <PublicShell>
        <main className="mx-auto w-full max-w-[1340px] py-6 lg:py-8">
          <div className="mt-2">
            <ProfilePageSkeleton />
          </div>
        </main>
      </PublicShell>
    );
  }

  if (!profile) {
    return (
      <PublicShell>
        <main className="mx-auto w-full max-w-[1340px] py-6 lg:py-8">
          <Surface className="mt-2 p-8">
            <InlineAlert
              variant="error"
              title="Profile unavailable"
              description={error ?? "Profile unavailable."}
            />
          </Surface>
        </main>
      </PublicShell>
    );
  }

  const meta = [
    {
      icon: "location" as const,
      value: profile.location ?? profile.timezone ?? "—",
    },
    { icon: "phone" as const, value: profile.phone ?? "No phone on file" },
    { icon: "email" as const, value: profile.primaryEmail },
  ];

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-[1340px] py-2 lg:py-4">
        <nav
          className="type-caption text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span>Profile</span>
          <span className="mx-2">›</span>
          <span className="font-semibold text-foreground">Account Profile</span>
        </nav>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="type-public-title tracking-title">
              Account Profile
            </h1>
            <p className="mt-2 max-w-2xl type-body text-muted-foreground">
              Only relevant information is shared when required to deliver a
              service.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              type="button"
              className="rounded-full border-black/8"
              onClick={() => void onSignOut()}
            >
              Sign out
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <ProfileIdentityHeader
            name={profile.displayName}
            subtitle="Client account"
            avatarUrl={profile.avatarUrl}
            avatarFallback={profile.displayName}
            avatarVariant="person"
            verified
            verifiedLabel="Verified account"
            meta={meta}
            memberSince={profile.createdAt}
            onEdit={() => setEditing((v) => !v)}
            editing={editing}
            onChangePhoto={() => setPhotoOpen(true)}
            changePhotoLabel="Change photo"
          />
        </div>

        {editing ? (
          <ProfileSection
            title="Personal Information"
            description="Update your personal identity details. Email is managed through your sign-in account."
          >
            <form
              ref={formRef}
              className="space-y-5 scroll-mt-24"
              onSubmit={onSave}
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Full name</Label>
                  <Input
                    id="displayName"
                    name="displayName"
                    defaultValue={profile.displayName}
                    required
                    minLength={1}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    value={profile.primaryEmail}
                    disabled
                    readOnly
                  />
                  <p className="type-caption text-muted-foreground">
                    Email is verified and managed via sign-in settings.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={profile.phone ?? ""}
                    placeholder="+254 ..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    name="location"
                    defaultValue={profile.location ?? ""}
                    placeholder="Nairobi, Kenya"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="bio">About me</Label>
                  <textarea
                    id="bio"
                    name="bio"
                    defaultValue={profile.bio ?? ""}
                    rows={4}
                    maxLength={2000}
                    placeholder="Tell us a little about yourself — this remains private."
                    className="min-h-24 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 type-body outline-none focus:border-foreground/15"
                  />
                  <p className="type-caption text-muted-foreground">
                    Private. Only shared where needed to deliver a service.
                  </p>
                </div>
              </div>
              {error ? (
                <InlineAlert
                  variant="error"
                  title="Unable to save"
                  description={error}
                />
              ) : null}
              <div className="flex flex-wrap gap-3 border-t border-black/8 pt-5">
                <Button
                  variant="outline"
                  type="button"
                  className="rounded-full"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-full" loading={saving}>
                  Save changes{" "}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          </ProfileSection>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="space-y-5">
            {!editing ? (
              <ProfileSection
                title="Personal Information"
                description="Private account identity details."
              >
                <ProfileFieldList>
                  <ProfileField
                    icon={User}
                    label="Full Name"
                    value={profile.displayName}
                  />
                  <ProfileField
                    icon={Mail}
                    label="Email"
                    value={profile.primaryEmail}
                  />
                  <ProfileField
                    icon={Phone}
                    label="Phone"
                    value={profile.phone ?? "—"}
                  />
                  <ProfileField
                    icon={MapPin}
                    label="Location"
                    value={profile.location ?? profile.timezone ?? "—"}
                  />
                  <ProfileField
                    icon={ShieldCheck}
                    label="About me"
                    value={profile.bio ?? "—"}
                  />
                </ProfileFieldList>
              </ProfileSection>
            ) : null}

            <ProfileSection
              title="Veterans Bay Presence"
              description="Where your account participates. This section is informational."
            >
              <div className="space-y-3">
                <ProfilePresenceItem
                  title="Client workspace"
                  subtitle="Personal account"
                  badge="Current"
                  tone="success"
                />
                {presence.professional ? (
                  <ProfilePresenceItem
                    title="Professional workspace"
                    subtitle={`${presence.professional.label} · ${presence.professional.roleKey ?? "member"}`}
                    href="/professional"
                    cta="Open workspace"
                  />
                ) : (
                  <ProfilePresenceItem
                    title="Professional workspace"
                    subtitle="Not set up yet"
                    cta="Become a professional"
                    href="/become-a-professional"
                  />
                )}
                <ProfilePresenceItem
                  title="Team memberships"
                  subtitle={
                    presence.teamCount > 0
                      ? `${presence.teamCount} organisation${presence.teamCount === 1 ? "" : "s"}`
                      : "You're not currently part of another professional team."
                  }
                  href={
                    presence.teamCount > 0 ? "/workspace/select" : undefined
                  }
                  cta={presence.teamCount > 0 ? "View teams" : undefined}
                />
              </div>
            </ProfileSection>

            <ProfileSection title="Account & Access">
              <div className="space-y-1">
                <ProfileActionRow
                  label="Password & sign-in"
                  description="Manage security and sign-in methods"
                  href="/account/sessions"
                  cta="Manage security →"
                />
                <ProfileActionRow
                  label="Active sessions"
                  description={
                    sessionsCount !== null
                      ? `${sessionsCount} device${sessionsCount === 1 ? "" : "s"}`
                      : "View and manage signed-in devices"
                  }
                  href="/account/sessions"
                  cta="View sessions →"
                />
                <ProfileActionRow label="Account status" value="Active" />
              </div>
            </ProfileSection>
          </div>

          <aside className="space-y-5">
            <ProfileSection
              title="Communication Preferences"
              action={
                <Link
                  href="/notifications"
                  className="type-control font-semibold text-[#5f8d11]"
                >
                  Manage preferences →
                </Link>
              }
              className="p-5 sm:p-6"
            >
              <div className="space-y-3 type-body">
                <div className="flex items-center justify-between rounded-2xl bg-[#f7f9fa] px-4 py-3">
                  <span className="text-sm">Email notifications</span>
                  <span className="font-semibold text-[#5f8d11]">Enabled</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#f7f9fa] px-4 py-3">
                  <span className="text-sm">In-app notifications</span>
                  <span className="font-semibold text-[#5f8d11]">Enabled</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#f7f9fa] px-4 py-3">
                  <span className="text-sm">Digest frequency</span>
                  <span className="font-semibold">Weekly</span>
                </div>
              </div>
            </ProfileSection>

            <ProfileSection title="Helpful Shortcuts" className="p-5 sm:p-6">
              <div className="grid gap-2">
                {[
                  {
                    label: "My bookings",
                    href: "/client/bookings",
                    icon: Calendar,
                  },
                  {
                    label: "My requests",
                    href: "/client/requests",
                    icon: MessageSquare,
                  },
                  { label: "Saved professionals", href: "/saved", icon: Heart },
                  {
                    label: "Invoices & payments",
                    href: "/client/invoices",
                    icon: CreditCard,
                  },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between rounded-2xl border border-black/8 px-4 py-3 type-body font-semibold hover:bg-[#f7f9fa]"
                  >
                    <span className="inline-flex items-center gap-2">
                      <item.icon
                        className="size-4 text-[#5f8d11]"
                        aria-hidden="true"
                      />{" "}
                      {item.label}
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </ProfileSection>

            <ProfileCallout
              title="Your account is your personal identity on Veterans Bay."
              description="Your personal information is private and only relevant information is shared when required to deliver a service."
              ctaLabel="Learn about privacy →"
              ctaHref="/privacy"
            />

            <Surface className="p-5">
              <h3 className="type-section-title">Danger zone</h3>
              <p className="mt-1 type-caption text-muted-foreground">
                Deactivate your account if you no longer need Veterans Bay.
              </p>
              <div className="mt-4">
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="danger"
                      type="button"
                      className="rounded-full"
                      loading={deactivating}
                    >
                      Deactivate account
                    </Button>
                  }
                  title="Deactivate this account?"
                  description="You will be signed out and cannot use protected features until an administrator restores access."
                  confirmLabel="Deactivate"
                  tone="danger"
                  onConfirm={() => void onDeactivate()}
                />
              </div>
            </Surface>
          </aside>
        </div>

        <ProfilePhotoDrawer
          open={photoOpen}
          onOpenChange={setPhotoOpen}
          currentUrl={profile.avatarUrl}
          fallback={profile.displayName}
          variant="person"
          title="Profile photo"
          description="Preview your current image, upload a new one, or remove it."
          onUpload={handleAvatarUpload}
          onRemove={handleAvatarRemove}
          allowRemove={Boolean(profile.avatarUrl)}
        />

        {editing ? (
          <div className="sr-only" aria-live="polite">
            Editing personal information
          </div>
        ) : null}
      </main>
    </PublicShell>
  );
}
