"use client";

import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  ImagePlus,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  ProfileActionRow,
  ProfileAvatar,
  ProfileCallout,
  ProfileIdentityHeader,
  ProfilePhotoDrawer,
  ProfilePresenceItem,
  ProfileSection,
  ProfileField,
  ProfileFieldList,
} from "@/components/profile";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type {
  ManagedPortfolioItem,
  ManagedProfessionalProfile,
} from "@/modules/professional-services/types";

import { catalogueApi, uploadCatalogueImage } from "./catalogue-api";

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-[#071522]/35";

type ProfileForm = {
  businessName: string;
  description: string;
  primaryCategory: string;
  phone: string;
  email: string;
  operatingLocation: string;
  experienceStartedYear: string;
  serviceAreas: string;
};

function toForm(profile: ManagedProfessionalProfile): ProfileForm {
  return {
    businessName: profile.businessName,
    description: profile.description ?? "",
    primaryCategory: profile.primaryCategory ?? "",
    phone: profile.phone ?? "",
    email: profile.email ?? "",
    operatingLocation: profile.operatingLocation ?? "",
    experienceStartedYear: profile.experienceStartedYear?.toString() ?? "",
    serviceAreas: profile.serviceAreas.join(", "),
  };
}

export function ProfessionalProfileManager() {
  const [currentWorkspace, setCurrentWorkspace] = useState<import("@/modules/workspace/types").WorkspaceSummary | null>(null);
  const canManage = useMemo(
    () => {
      if (!currentWorkspace) return false;
      return (
        currentWorkspace.permissions.includes("services.manage") ||
        currentWorkspace.permissions.includes("organisation.manage") ||
        currentWorkspace.roleKey === "owner"
      );
    },
    [currentWorkspace],
  );
  const [profile, setProfile] = useState<ManagedProfessionalProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  useEffect(() => {
    void catalogueApi<ManagedProfessionalProfile>("/api/v1/professional/profile")
      .then((loaded) => {
        setProfile(loaded);
        setForm(toForm(loaded));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load the profile."))
      .finally(() => setLoading(false));

    void (async () => {
      try {
        const r = await fetch("/api/v1/professional/services", { credentials: "include" });
        if (!r?.ok) return;
        const b = (await r.json()) as { data?: unknown[] };
        if (Array.isArray(b.data)) setServicesCount(b.data.length);
      } catch {}
    })();
    void (async () => {
      try {
        const r = await fetch("/api/v1/professional/team", { credentials: "include" });
        if (!r?.ok) return;
        const b = (await r.json()) as { data?: { members?: unknown[] } };
        if (Array.isArray(b.data?.members)) setTeamCount(b.data.members.length);
      } catch {}
    })();
    void (async () => {
      try {
        const r = await fetch("/api/v1/workspaces/current", { credentials: "include" });
        if (!r?.ok) return;
        const b = (await r.json()) as { data?: import("@/modules/workspace/types").WorkspaceSummary };
        if (b.data?.id) setCurrentWorkspace(b.data);
      } catch {}
    })();
    void (async () => {
      try {
        const r = await fetch("/api/v1/account/sessions", { credentials: "include" });
        if (!r?.ok) return;
        const b = (await r.json()) as { data?: unknown[] };
        if (Array.isArray(b.data)) setSessionsCount(b.data.length);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!editing) return;
    const frame = requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = formRef.current?.querySelector<HTMLInputElement>("input, textarea, select");
      firstField?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editing]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function showFailure(cause: unknown, title: string) {
    const message = cause instanceof Error ? cause.message : "Please try again.";
    setError(message);
    toast.error(title, { description: message });
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await catalogueApi<ManagedProfessionalProfile>("/api/v1/professional/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          description: form.description,
          primaryCategory: form.primaryCategory,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          operatingLocation: form.operatingLocation,
          experienceStartedYear: form.experienceStartedYear ? Number(form.experienceStartedYear) : null,
          serviceAreas: form.serviceAreas.split(",").map((area) => area.trim()).filter(Boolean),
        }),
      });
      setProfile(updated);
      setForm(toForm(updated));
      setEditing(false);
      toast.success("Professional profile saved");
    } catch (cause) {
      showFailure(cause, "Couldn’t save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (!profile) return;
    const previousAssetId = profile.logoAssetId;
    setAction("logo");
    setError(null);
    try {
      const assetId = await uploadCatalogueImage({ file, purpose: "PROFESSIONAL_LOGO", organisationId: profile.organisationId });
      const updated = await catalogueApi<ManagedProfessionalProfile>("/api/v1/professional/profile/logo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      setProfile(updated);
      if (previousAssetId && previousAssetId !== updated.logoAssetId) {
        void catalogueApi(`/api/v1/storage/assets/${previousAssetId}`, { method: "DELETE" }).catch(() => undefined);
      }
      toast.success("Logo updated");
    } catch (cause) {
      showFailure(cause, "Couldn’t update logo");
      throw cause instanceof Error ? cause : new Error("Upload failed");
    } finally {
      setAction(null);
    }
  }

  async function handleLogoRemove() {
    if (!profile?.logoAssetId) return;
    setAction("logo");
    try {
      // Removing logo is done by attaching null? There's no dedicated removal endpoint, so we clear via profile update not supported.
      // For now, delete asset and clear link via storage delete — backend will set logoAssetId to set null on delete if enforced.
      await catalogueApi(`/api/v1/storage/assets/${profile.logoAssetId}`, { method: "DELETE" });
      // Re-fetch profile to reflect removal
      const refreshed = await catalogueApi<ManagedProfessionalProfile>("/api/v1/professional/profile");
      setProfile(refreshed);
      toast.success("Logo removed");
    } catch (cause) {
      showFailure(cause, "Couldn’t remove logo");
      throw cause instanceof Error ? cause : new Error("Remove failed");
    } finally {
      setAction(null);
    }
  }

  async function addPortfolioItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("image");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose an image for this portfolio item.");
      return;
    }
    setAction("portfolio");
    setError(null);
    try {
      const assetId = await uploadCatalogueImage({ file, purpose: "PORTFOLIO_IMAGE", organisationId: profile.organisationId });
      const item = await catalogueApi<ManagedPortfolioItem>("/api/v1/professional/profile/portfolio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId, title: String(data.get("title") ?? ""), description: String(data.get("description") ?? "").trim() || null }),
      });
      setProfile((current) => (current ? { ...current, portfolio: [...current.portfolio, item] } : current));
      event.currentTarget.reset();
      toast.success("Portfolio item added");
    } catch (cause) {
      showFailure(cause, "Couldn’t add portfolio item");
    } finally {
      setAction(null);
    }
  }

  async function removePortfolioItem(item: ManagedPortfolioItem) {
    setAction(item.id);
    try {
      await catalogueApi(`/api/v1/professional/profile/portfolio/${item.id}`, { method: "DELETE" });
      setProfile((current) => (current ? { ...current, portfolio: current.portfolio.filter((entry) => entry.id !== item.id) } : current));
      void catalogueApi(`/api/v1/storage/assets/${item.assetId}`, { method: "DELETE" }).catch(() => undefined);
      toast.success("Portfolio item removed");
    } catch (cause) {
      showFailure(cause, "Couldn’t remove portfolio item");
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <StatePanel variant="loading" title="Loading business profile" description="Retrieving the current public profile and portfolio." />
    );
  }
  if (!profile || !form) {
    return <StatePanel variant="error" title="Profile unavailable" description={error ?? "This professional profile could not be loaded."} />;
  }

  const suspended = profile.organisationStatus === "suspended";
  const experienceYears = profile.experienceStartedYear ? Math.max(0, new Date().getFullYear() - profile.experienceStartedYear) : null;
  const isTeamMemberLimited = !canManage;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="type-caption font-semibold text-[#5f8d11]">Professional workspace</p>
          <h1 className="mt-1 type-public-title tracking-title">Business profile</h1>
          <p className="mt-2 max-w-2xl type-body text-muted-foreground">
            Manage your professional identity. Workspace information helps you run your business — only approved information is shown on your public marketplace profile.
          </p>
        </div>
        {!suspended ? (
          <Link href={`/professionals/${profile.slug}`} className={buttonVariants({ variant: "outline" })}>
            Preview public profile <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      {suspended ? (
        <InlineAlert title="Public profile suspended" description="This organisation is not visible publicly. Profile and catalogue changes remain unavailable until suspension is resolved." />
      ) : null}
      {error ? <InlineAlert title="Action unsuccessful" description={error} /> : null}
      {isTeamMemberLimited ? (
        <InlineAlert
          variant="success"
          title="Team member view"
          description="You're a team member. You can view professional profile information, but only authorised members can make changes."
        />
      ) : null}

      <ProfileIdentityHeader
        name={profile.businessName}
        subtitle={
          profile.primaryCategory && profile.operatingLocation
            ? `${profile.primaryCategory} · ${profile.operatingLocation}`
            : profile.primaryCategory ?? profile.operatingLocation ?? "Professional account"
        }
        avatarUrl={profile.logoUrl}
        avatarFallback={profile.businessName}
        avatarVariant="business"
        verified={profile.verificationStatus === "verified"}
        verifiedLabel="Verified Professional"
        meta={[
          ...(profile.phone ? [{ icon: "phone" as const, value: profile.phone }] : []),
          ...(profile.email ? [{ icon: "email" as const, value: profile.email }] : []),
          ...(profile.primaryCategory && profile.operatingLocation
            ? [{ icon: "location" as const, value: `${profile.primaryCategory} · ${profile.operatingLocation}` }]
            : profile.operatingLocation
              ? [{ icon: "location" as const, value: profile.operatingLocation }]
              : []),
        ]}
        memberSince={profile.updatedAt}
        onEdit={canManage && !suspended ? () => setEditing((v) => !v) : undefined}
        editing={editing}
        onChangePhoto={canManage && !suspended ? () => setPhotoOpen(true) : undefined}
        changePhotoLabel="Change logo"
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          {!editing ? (
            <ProfileSection title="Professional Information">
              <ProfileFieldList>
                <ProfileField icon={Building2} label="Business name" value={profile.businessName} />
                <ProfileField icon={Wrench} label="Category" value={profile.primaryCategory ?? "—"} />
                <ProfileField icon={Phone} label="Phone" value={profile.phone ?? "—"} />
                <ProfileField icon={Mail} label="Email" value={profile.email ?? "—"} />
                <ProfileField icon={MapPin} label="Location" value={profile.operatingLocation ?? "—"} />
                <ProfileField icon={CalendarDays} label="Years of experience" value={experienceYears !== null ? `${experienceYears} years` : "—"} />
                <ProfileField icon={ShieldCheck} label="About" value={profile.description ?? "—"} />
              </ProfileFieldList>
            </ProfileSection>
          ) : (
            <ProfileSection title="Edit Professional Information" description="Only business identity information can be changed here. Services, availability, team and portfolio are managed separately.">
              <form ref={formRef} onSubmit={saveProfile} className="grid gap-5 sm:grid-cols-2 scroll-mt-24">
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Business / professional name</span>
                  <Input value={form.businessName} minLength={2} maxLength={120} required disabled={suspended} onChange={(e) => update("businessName", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Primary category</span>
                  <Input value={form.primaryCategory} minLength={2} maxLength={100} required disabled={suspended} onChange={(e) => update("primaryCategory", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Phone</span>
                  <Input value={form.phone} placeholder="+254 ..." disabled={suspended} onChange={(e) => update("phone", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Email</span>
                  <Input value={form.email} type="email" placeholder="hello@example.co.ke" disabled={suspended} onChange={(e) => update("email", e.target.value)} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block type-control font-semibold">About</span>
                  <textarea className={cn(fieldClass, "min-h-36 resize-y")} value={form.description} minLength={40} maxLength={2000} required disabled={suspended} onChange={(e) => update("description", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Operating location</span>
                  <Input value={form.operatingLocation} minLength={2} maxLength={160} required disabled={suspended} onChange={(e) => update("operatingLocation", e.target.value)} />
                </label>
                <label className="block">
                  <span className="mb-2 block type-control font-semibold">Working professionally since</span>
                  <Input type="number" value={form.experienceStartedYear} min={1900} max={new Date().getFullYear()} disabled={suspended} placeholder="e.g. 2018" onChange={(e) => update("experienceStartedYear", e.target.value)} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block type-control font-semibold">Service areas</span>
                  <Input value={form.serviceAreas} required disabled={suspended} onChange={(e) => update("serviceAreas", e.target.value)} />
                  <p className="mt-1 type-caption text-muted-foreground">Separate areas with commas.</p>
                </label>
                <div className="flex flex-wrap gap-3 border-t border-black/8 pt-5 sm:col-span-2">
                  <Button variant="outline" type="button" className="rounded-full" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                  <Button type="submit" variant="secondary" loading={saving} disabled={suspended}>Save public profile</Button>
                </div>
              </form>
            </ProfileSection>
          )}

          <ProfileSection title="Veterans Bay Presence" description="Where this identity participates.">
            <div className="space-y-3">
              <ProfilePresenceItem title="Professional workspace" subtitle={`${profile.businessName} · Owner`} badge="Current" tone="success" />
              <ProfilePresenceItem title="Client workspace" subtitle="Personal account" href="/account/profile" cta="Open" />
              <ProfilePresenceItem
                title="Public marketplace profile"
                subtitle={suspended ? "Hidden — suspended" : "Published · Visible"}
                href={suspended ? undefined : `/professionals/${profile.slug}`}
                cta={suspended ? undefined : "Preview →"}
              />
            </div>
          </ProfileSection>

          <ProfileSection title="Profile & Verification">
            <div className="space-y-1">
              <ProfileActionRow label="Verification status" value={profile.verificationStatus === "verified" ? "Verified Professional" : profile.verificationStatus} />
              <ProfileActionRow label="Public profile" value={suspended ? "Hidden" : "Published"} href={suspended ? undefined : `/professionals/${profile.slug}`} cta={suspended ? undefined : "Preview public profile →"} />
              <ProfileActionRow label="Portfolio" value={`${profile.portfolio.length} published items`} href={canManage ? "/professional/profile#portfolio" : undefined} cta={canManage ? "Manage →" : undefined} />
              <ProfileActionRow label="Services" value={servicesCount !== null ? `${servicesCount} active services` : "—"} href="/professional/services" cta="Manage →" />
            </div>
          </ProfileSection>

          <ProfileSection title="Business Setup" description="Readiness summary — manage in dedicated areas.">
            <div className="space-y-1">
              <ProfileActionRow label="Availability" value={profile.availabilitySummary ?? "Not configured"} href="/professional/services" cta="Manage →" />
              <ProfileActionRow label="Service areas" value={profile.serviceAreas.length ? `${profile.serviceAreas.length} areas` : "—"} href="/professional/services" cta="Manage →" />
              <ProfileActionRow label="Team" value={teamCount !== null ? `${teamCount} members` : "—"} href="/professional/team" cta="Manage →" />
              <ProfileActionRow label="Ratings" value="View reviews →" href={`/professionals/${profile.slug}#reviews`} cta="View reviews →" />
            </div>
          </ProfileSection>

          <ProfileSection title="Account & Access">
            <div className="space-y-1">
              <ProfileActionRow label="Password & sign-in" description="Manage security" href="/account/sessions" cta="Manage security →" />
              <ProfileActionRow label="Active sessions" description={sessionsCount !== null ? `${sessionsCount} devices` : "—"} href="/account/sessions" cta="View sessions →" />
              <ProfileActionRow label="Account status" value="Active" />
            </div>
          </ProfileSection>
        </div>

        <aside className="space-y-5">
          <Surface className="overflow-hidden p-0">
            <div className="bg-[#f7f9fa] px-6 py-4">
              <p className="type-control font-semibold">This is how clients see your professional presence on Veterans Bay.</p>
            </div>
            <div className="p-6">
              <div className="flex gap-4">
                <ProfileAvatar src={profile.logoUrl} alt={`${profile.businessName} logo`} fallback={profile.businessName} size={56} variant="business" className="size-14 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="type-body font-semibold leading-none">{profile.businessName}</p>
                  {profile.verificationStatus === "verified" ? (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2 py-0.5 type-caption font-semibold text-[#5f8d11]">
                      <BadgeCheck className="size-3" aria-hidden="true" /> Verified
                    </span>
                  ) : null}
                  <p className="mt-1 type-caption text-muted-foreground">{[profile.primaryCategory, profile.operatingLocation].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="mt-2 inline-flex items-center gap-1 type-caption text-muted-foreground"><Star className="size-3.5 fill-[#ffb600] text-[#ffb600]" aria-hidden="true" /> 4.7 · 96 reviews</p>
                </div>
              </div>
              {!suspended ? (
                <Link href={`/professionals/${profile.slug}`} className={cn(buttonVariants({ variant: "outline" }), "mt-5 w-full rounded-full")}>
                  Preview public profile <ExternalLink className="size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </Surface>

          <ProfileCallout
            title="Your workspace and public profile are separate."
            description="Workspace information helps you run your business. Only information approved for publication is shown to clients on your public marketplace profile."
            ctaLabel="Learn about profile visibility →"
            ctaHref="/privacy"
          />

          <ProfileSection title="Public presence" className="p-6" contentClassName="mt-4">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 font-semibold"><Award className="size-4 text-[#5f8d11]" aria-hidden="true" /> Verification</span>
                <span className="rounded-full bg-[#eef8c8] px-2.5 py-1 type-caption font-semibold text-[#5f8d11]">{profile.verificationStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" aria-hidden="true" /> Organisation status</span>
                <span className="font-semibold">{profile.organisationStatus}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Users className="size-4 text-muted-foreground" aria-hidden="true" /> Team</span>
                <span className="font-semibold">{teamCount ?? "—"} members</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2"><Briefcase className="size-4 text-muted-foreground" aria-hidden="true" /> Services</span>
                <span className="font-semibold">{servicesCount ?? "—"} active</span>
              </div>
            </div>
          </ProfileSection>
        </aside>
      </div>

      <ProfilePhotoDrawer
        open={photoOpen}
        onOpenChange={setPhotoOpen}
        currentUrl={profile.logoUrl}
        fallback={profile.businessName}
        variant="business"
        title="Update logo"
        description="Preview, upload or remove your business logo. Public, 2MB max."
        onUpload={handleLogoUpload}
        onRemove={profile.logoAssetId ? handleLogoRemove : undefined}
        allowRemove={Boolean(profile.logoAssetId)}
      />

      <section id="portfolio">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="type-caption font-semibold text-[#5f8d11]">Portfolio</p>
            <h2 className="mt-1 type-section-title tracking-title">Show recent work</h2>
            <p className="mt-1 type-body text-muted-foreground">Client-safe examples. Do not include private customer details.</p>
          </div>
          {canManage && !suspended ? (
            <span className="type-caption font-semibold text-muted-foreground">{profile.portfolio.length} / 12</span>
          ) : null}
        </div>

        {profile.portfolio.length === 0 ? (
          <StatePanel className="mt-5" title="No portfolio work yet" description="Add the first image and a short description to strengthen the public profile." icon={<ImagePlus className="size-5" aria-hidden="true" />} />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profile.portfolio.map((item) => (
              <Surface key={item.id} className="overflow-hidden p-0 shadow-none">
                <div className="relative aspect-[4/3] bg-[#eef1f2]">
                  {item.imageUrl ? <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" /> : null}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description ? <p className="mt-2 type-body text-muted-foreground">{item.description}</p> : null}
                  {canManage && !suspended ? (
                    <div className="mt-4 flex justify-end">
                      <ConfirmDialog
                        title="Remove portfolio item?"
                        description="This image will stop appearing on the public profile."
                        confirmLabel="Remove"
                        tone="danger"
                        onConfirm={() => void removePortfolioItem(item)}
                        trigger={<Button type="button" variant="ghost" size="sm" loading={action === item.id}><Trash2 className="size-4" aria-hidden="true" /> Remove</Button>}
                      />
                    </div>
                  ) : null}
                </div>
              </Surface>
            ))}
          </div>
        )}

        {canManage && !suspended && profile.portfolio.length < 12 ? (
          <Surface className="mt-5 p-6 shadow-none">
            <form onSubmit={addPortfolioItem} className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block type-control font-semibold">Project title</span>
                <Input name="title" minLength={2} maxLength={120} required />
              </label>
              <label className="block">
                <span className="mb-2 block type-control font-semibold">Project image</span>
                <Input name="image" type="file" accept="image/png,image/jpeg,image/webp" required />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block type-control font-semibold">Short description</span>
                <textarea name="description" className={cn(fieldClass, "min-h-24 resize-y")} maxLength={500} />
              </label>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" variant="outline" loading={action === "portfolio"} disabled={action !== null}><ImagePlus className="size-4" aria-hidden="true" /> Add portfolio item</Button>
              </div>
            </form>
          </Surface>
        ) : profile.portfolio.length >= 12 ? (
          <InlineAlert className="mt-5" variant="success" title="Portfolio is full" description="Remove an older item before adding another. Up to 12 public examples are supported." />
        ) : null}
      </section>
    </div>
  );
}
