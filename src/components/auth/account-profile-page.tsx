"use client";

import {
  ArrowRight,
  Camera,
  ChevronRight,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicShell } from "@/components/public/public-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { loginHrefFor } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import type { PublicAccountProfile } from "@/modules/identity/types";

async function fetchProfile(): Promise<PublicAccountProfile> {
  const response = await fetch("/api/v1/account/profile", {
    credentials: "include",
  });
  const body = (await response.json()) as {
    data?: PublicAccountProfile;
    error?: { code?: string };
  };

  if (!response.ok || !body.data) {
    throw new Error(body.error?.code ?? "PROFILE_UNAVAILABLE");
  }

  return body.data;
}

export function AccountProfilePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [profile, setProfile] = useState<PublicAccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace(loginHrefFor("/account/profile"));
      return;
    }

    void fetchProfile()
      .then((data) => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load your profile.");
        setLoading(false);
      });
  }, [isPending, router, session]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) {
      return;
    }

    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);

    const response = await fetch("/api/v1/account/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: String(form.get("displayName") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim() || null,
        timezone: String(form.get("timezone") ?? "").trim(),
      }),
    });
    const body = (await response.json()) as {
      data?: PublicAccountProfile;
    };
    setSaving(false);

    if (!response.ok || !body.data) {
      setError("Unable to update your profile.");
      return;
    }

    setProfile(body.data);
    setEditing(false);
    toast.success("Profile updated.");
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

  return (
    <PublicShell>
      <main>
        <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span>Profile</span>
          <span className="mx-2">›</span>
          <span className="text-foreground">Account Profile</span>
        </nav>
        <h1 className="mt-4 text-3xl font-bold tracking-title sm:text-4xl">
          Account Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          Manage your personal information and account preferences.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/account/sessions"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-black/8",
            )}
          >
            Sessions
          </Link>
          <Link
            href="/workspace/select"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-black/8",
            )}
          >
            Dashboard
          </Link>
          <Button
            variant="outline"
            type="button"
            className="rounded-full border-black/8"
            onClick={() => void onSignOut()}
          >
            Sign out
          </Button>
        </div>

        {loading ? (
          <Surface className="mt-8 p-8">
            <StatePanel
              variant="loading"
              title="Loading profile"
              description="Fetching your account details."
            />
          </Surface>
        ) : profile ? (
          <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
            <div className="space-y-5">
              <Surface className="relative overflow-hidden p-6 sm:p-8">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="relative shrink-0">
                    <Image
                      src="/images/header-avatar.png"
                      alt=""
                      width={96}
                      height={96}
                      className="size-24 rounded-full object-cover"
                    />
                    <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border border-black/8 bg-white text-[#071522]">
                      <Camera className="size-3.5" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold tracking-title">
                        {profile.displayName}
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2.5 py-1 type-caption font-semibold text-[#5f8d11]">
                        <ShieldCheck className="size-3.5" aria-hidden="true" />
                        Verified
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-[#68717b]">
                      <p className="inline-flex items-center gap-2">
                        <Mail className="size-3.5" /> {profile.primaryEmail}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <Phone className="size-3.5" />{" "}
                        {profile.phone || "No phone on file"}
                      </p>
                      <p className="inline-flex items-center gap-2">
                        <MapPin className="size-3.5" /> {profile.timezone}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    type="button"
                    className="rounded-full border-black/8"
                    onClick={() => setEditing((value) => !value)}
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {editing ? "Cancel edit" : "Edit Profile"}
                  </Button>
                </div>
              </Surface>

              <Surface className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold">Personal Information</h3>
                </div>
                {editing ? (
                  <form className="mt-6 space-y-5" onSubmit={onSave}>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Full name</Label>
                      <Input
                        id="displayName"
                        name="displayName"
                        defaultValue={profile.displayName}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={profile.primaryEmail}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        name="phone"
                        defaultValue={profile.phone ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Location / timezone</Label>
                      <Input
                        id="timezone"
                        name="timezone"
                        defaultValue={profile.timezone}
                        required
                      />
                    </div>
                    {error ? (
                      <InlineAlert
                        variant="error"
                        title="Unable to save"
                        description={error}
                      />
                    ) : null}
                    <Button
                      className="h-12 rounded-full pr-1.5 pl-6"
                      loading={saving}
                      type="submit"
                    >
                      Save changes
                      <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </span>
                    </Button>
                  </form>
                ) : (
                  <dl className="mt-6 divide-y divide-black/8">
                    {[
                      {
                        icon: User,
                        label: "Full Name",
                        value: profile.displayName,
                      },
                      {
                        icon: Mail,
                        label: "Email",
                        value: profile.primaryEmail,
                      },
                      {
                        icon: Phone,
                        label: "Phone",
                        value: profile.phone || "—",
                      },
                      {
                        icon: MapPin,
                        label: "Location",
                        value: profile.timezone,
                      },
                      {
                        icon: ShieldCheck,
                        label: "Account Type",
                        value: "Client",
                      },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center gap-4 py-4"
                      >
                        <span className="grid size-10 place-items-center rounded-full bg-[#f7f9fa] text-[#5f8d11]">
                          <row.icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <dt className="text-xs text-[#68717b]">{row.label}</dt>
                          <dd className="mt-1 text-sm font-semibold">
                            {row.value}
                          </dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                )}
              </Surface>

              <Surface className="p-6 sm:p-8">
                <h3 className="text-lg font-bold">Security</h3>
                <div className="mt-6 space-y-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
                    <div>
                      <p className="font-semibold">Password</p>
                      <p className="mt-1 text-[#68717b]">••••••••••••</p>
                    </div>
                    <span className="text-xs font-semibold text-[#68717b]">
                      Change Password unavailable
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-4">
                    <div>
                      <p className="font-semibold">Two-Factor Authentication</p>
                      <p className="mt-1 text-[#68717b]">Not configured yet</p>
                    </div>
                    <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1 type-caption font-semibold">
                      Off
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Login devices</p>
                      <p className="mt-1 text-[#68717b]">
                        Manage active sessions separately
                      </p>
                    </div>
                    <Link
                      href="/account/sessions"
                      className="text-sm font-semibold text-[#5f8d11]"
                    >
                      View sessions
                    </Link>
                  </div>
                </div>
                <div className="mt-8">
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="danger"
                        type="button"
                        className="h-12 rounded-full"
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
            </div>

            <aside className="space-y-5">
              <Surface className="p-5">
                <h3 className="font-bold">Account Summary</h3>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    "Jobs Booked — fixture preview",
                    "Jobs Completed — fixture preview",
                    "Total Spent — fixture preview",
                    "Member since profile creation",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f9fa] px-4 py-3"
                    >
                      <span>{item}</span>
                      <ChevronRight className="size-4 text-[#68717b]" />
                    </li>
                  ))}
                </ul>
              </Surface>
              <Surface className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">Payment Methods</h3>
                  <span className="text-xs font-semibold text-[#68717b]">
                    Manage later
                  </span>
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center gap-3 rounded-2xl border border-black/8 px-4 py-3">
                    <CreditCard className="size-4 text-[#5f8d11]" />
                    <div>
                      <p className="font-semibold">Visa •••• 4242</p>
                      <p className="text-xs text-[#68717b]">Fixture card</p>
                    </div>
                    <span className="ml-auto rounded-full bg-[#eef8c8] px-2 py-0.5 type-caption font-semibold text-[#5f8d11]">
                      Default
                    </span>
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 px-4 py-3 text-sm font-semibold text-[#5f8d11]"
                  >
                    Add New Payment Method
                  </button>
                </div>
              </Surface>
              <Surface className="p-5">
                <h3 className="font-bold">Preferences</h3>
                <ul className="mt-4 space-y-3 text-sm">
                  {[
                    ["Email Notifications", "On"],
                    ["SMS Notifications", "On"],
                    ["Marketing Updates", "Off"],
                  ].map(([label, value]) => (
                    <li
                      key={label}
                      className="flex items-center justify-between rounded-2xl bg-[#f7f9fa] px-4 py-3"
                    >
                      <span>{label}</span>
                      <span className="font-semibold text-[#5f8d11]">{value}</span>
                    </li>
                  ))}
                </ul>
              </Surface>
            </aside>
          </div>
        ) : (
          <Surface className="mt-8 p-8">
            <InlineAlert
              variant="error"
              title="Profile unavailable"
              description={error ?? "Profile unavailable."}
            />
          </Surface>
        )}
      </main>
    </PublicShell>
  );
}
