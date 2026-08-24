"use client";

import { BadgeCheck, ExternalLink, ImagePlus, MapPin, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

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
  operatingLocation: string;
  experienceStartedYear: string;
  serviceAreas: string;
};

function toForm(profile: ManagedProfessionalProfile): ProfileForm {
  return {
    businessName: profile.businessName,
    description: profile.description ?? "",
    primaryCategory: profile.primaryCategory ?? "",
    operatingLocation: profile.operatingLocation ?? "",
    experienceStartedYear: profile.experienceStartedYear?.toString() ?? "",
    serviceAreas: profile.serviceAreas.join(", "),
  };
}

export function ProfessionalProfileManager() {
  const [profile, setProfile] = useState<ManagedProfessionalProfile | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void catalogueApi<ManagedProfessionalProfile>("/api/v1/professional/profile")
      .then((loaded) => {
        setProfile(loaded);
        setForm(toForm(loaded));
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Unable to load the profile."),
      )
      .finally(() => setLoading(false));
  }, []);

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
    setAction("save");
    setError(null);
    try {
      const updated = await catalogueApi<ManagedProfessionalProfile>(
        "/api/v1/professional/profile",
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            businessName: form.businessName,
            description: form.description,
            primaryCategory: form.primaryCategory,
            operatingLocation: form.operatingLocation,
            experienceStartedYear: form.experienceStartedYear
              ? Number(form.experienceStartedYear)
              : null,
            serviceAreas: form.serviceAreas
              .split(",")
              .map((area) => area.trim())
              .filter(Boolean),
          }),
        },
      );
      setProfile(updated);
      setForm(toForm(updated));
      toast.success("Public profile saved");
    } catch (cause) {
      showFailure(cause, "Couldn’t save profile");
    } finally {
      setAction(null);
    }
  }

  async function uploadLogo(file: File) {
    if (!profile) return;
    const previousAssetId = profile.logoAssetId;
    setAction("logo");
    setError(null);
    try {
      const assetId = await uploadCatalogueImage({
        file,
        purpose: "PROFESSIONAL_LOGO",
        organisationId: profile.organisationId,
      });
      const updated = await catalogueApi<ManagedProfessionalProfile>(
        "/api/v1/professional/profile/logo",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId }),
        },
      );
      setProfile(updated);
      if (previousAssetId && previousAssetId !== updated.logoAssetId) {
        void catalogueApi(`/api/v1/storage/assets/${previousAssetId}`, {
          method: "DELETE",
        }).catch(() => undefined);
      }
      toast.success("Professional logo updated");
    } catch (cause) {
      showFailure(cause, "Couldn’t update logo");
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
      const assetId = await uploadCatalogueImage({
        file,
        purpose: "PORTFOLIO_IMAGE",
        organisationId: profile.organisationId,
      });
      const item = await catalogueApi<ManagedPortfolioItem>(
        "/api/v1/professional/profile/portfolio",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            assetId,
            title: String(data.get("title") ?? ""),
            description: String(data.get("description") ?? "").trim() || null,
          }),
        },
      );
      setProfile((current) =>
        current ? { ...current, portfolio: [...current.portfolio, item] } : current,
      );
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
      await catalogueApi(`/api/v1/professional/profile/portfolio/${item.id}`, {
        method: "DELETE",
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              portfolio: current.portfolio.filter((entry) => entry.id !== item.id),
            }
          : current,
      );
      void catalogueApi(`/api/v1/storage/assets/${item.assetId}`, {
        method: "DELETE",
      }).catch(() => undefined);
      toast.success("Portfolio item removed");
    } catch (cause) {
      showFailure(cause, "Couldn’t remove portfolio item");
    } finally {
      setAction(null);
    }
  }

  if (loading) {
    return (
      <StatePanel
        variant="loading"
        title="Loading business profile"
        description="Retrieving the current public profile and portfolio."
      />
    );
  }
  if (!profile || !form) {
    return (
      <StatePanel
        variant="error"
        title="Profile unavailable"
        description={error ?? "This professional profile could not be loaded."}
      />
    );
  }

  const suspended = profile.organisationStatus === "suspended";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">Public presence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            Business profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Keep the profile clients use to understand your expertise, coverage, and
            recent work accurate.
          </p>
        </div>
        {!suspended ? (
          <Link
            href={`/professionals/${profile.slug}`}
            className={buttonVariants({ variant: "outline" })}
          >
            View public profile <ExternalLink className="size-4" />
          </Link>
        ) : null}
      </div>

      {suspended ? (
        <InlineAlert
          title="Public profile suspended"
          description="This organisation is not visible publicly. Profile and catalogue changes remain unavailable until suspension is resolved."
        />
      ) : null}
      {error ? <InlineAlert title="Action unsuccessful" description={error} /> : null}

      <Surface className="overflow-hidden p-0 shadow-none">
        <div className="bg-[#071522] p-6 text-white sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-[26px] border border-white/15 bg-[#b8f52a] text-2xl font-semibold text-[#071522]">
              {profile.logoUrl ? (
                <Image
                  src={profile.logoUrl}
                  alt={`${profile.businessName} logo`}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                profile.businessName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold">{profile.businessName}</h2>
                {profile.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#b8f52a]">
                    <BadgeCheck className="size-3.5" /> Verified
                  </span>
                ) : null}
              </div>
              {profile.operatingLocation ? (
                <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/65">
                  <MapPin className="size-4" /> {profile.operatingLocation}
                </p>
              ) : null}
            </div>
            {!suspended ? (
              <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-white/20 bg-white/10 text-white hover:bg-white/15")}>
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={action !== null}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                    event.currentTarget.value = "";
                  }}
                />
                <Upload className="size-4" /> {action === "logo" ? "Uploading…" : "Change logo"}
              </label>
            ) : null}
          </div>
        </div>

        <form onSubmit={saveProfile} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          <Field label="Business name">
            <Input
              value={form.businessName}
              minLength={2}
              maxLength={120}
              required
              disabled={suspended}
              onChange={(event) => update("businessName", event.target.value)}
            />
          </Field>
          <Field label="Primary category">
            <Input
              value={form.primaryCategory}
              minLength={2}
              maxLength={100}
              required
              disabled={suspended}
              onChange={(event) => update("primaryCategory", event.target.value)}
            />
          </Field>
          <Field label="Public description" full>
            <textarea
              className={cn(fieldClass, "min-h-36 resize-y")}
              value={form.description}
              minLength={40}
              maxLength={2_000}
              required
              disabled={suspended}
              onChange={(event) => update("description", event.target.value)}
            />
            <p className="mt-1 text-xs text-[#68717b]">
              Describe your expertise, typical work, and what clients can expect.
            </p>
          </Field>
          <Field label="Operating location">
            <Input
              value={form.operatingLocation}
              minLength={2}
              maxLength={160}
              required
              disabled={suspended}
              onChange={(event) => update("operatingLocation", event.target.value)}
            />
          </Field>
          <Field label="Working professionally since">
            <Input
              type="number"
              value={form.experienceStartedYear}
              min={1900}
              max={new Date().getFullYear()}
              disabled={suspended}
              placeholder="e.g. 2018"
              onChange={(event) =>
                update("experienceStartedYear", event.target.value)
              }
            />
            <p className="mt-1 text-xs text-[#68717b]">
              Used to keep your years of experience accurate automatically.
            </p>
          </Field>
          <Field label="Service areas">
            <Input
              value={form.serviceAreas}
              required
              disabled={suspended}
              onChange={(event) => update("serviceAreas", event.target.value)}
            />
            <p className="mt-1 text-xs text-[#68717b]">Separate areas with commas.</p>
          </Field>
          <div className="flex justify-end border-t border-black/8 pt-5 sm:col-span-2">
            <Button
              type="submit"
              variant="secondary"
              loading={action === "save"}
              disabled={suspended || action !== null}
            >
              Save public profile
            </Button>
          </div>
        </form>
      </Surface>

      <section>
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">Portfolio</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-title">
            Show recent work
          </h2>
          <p className="mt-2 text-sm text-[#68717b]">
            Add concise, client-safe examples. Do not include private customer details.
          </p>
        </div>

        {profile.portfolio.length === 0 ? (
          <StatePanel
            className="mt-5"
            title="No portfolio work yet"
            description="Add the first image and a short description to strengthen the public profile."
            icon={<ImagePlus className="size-5" />}
          />
        ) : (
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profile.portfolio.map((item) => (
              <Surface key={item.id} className="overflow-hidden p-0 shadow-none">
                <div className="relative aspect-[4/3] bg-[#eef1f2]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 33vw"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-[#68717b]">
                      {item.description}
                    </p>
                  ) : null}
                  {!suspended ? (
                    <div className="mt-4 flex justify-end">
                      <ConfirmDialog
                        title="Remove portfolio item?"
                        description="This image will stop appearing on the public profile."
                        confirmLabel="Remove"
                        tone="danger"
                        onConfirm={() => void removePortfolioItem(item)}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            loading={action === item.id}
                          >
                            <Trash2 className="size-4" /> Remove
                          </Button>
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </Surface>
            ))}
          </div>
        )}

        {!suspended && profile.portfolio.length < 12 ? (
          <Surface className="mt-5 p-6 shadow-none">
            <form
              onSubmit={addPortfolioItem}
              className="grid gap-5 sm:grid-cols-2"
            >
              <Field label="Project title">
                <Input name="title" minLength={2} maxLength={120} required />
              </Field>
              <Field label="Project image">
                <Input
                  name="image"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                />
              </Field>
              <Field label="Short description" full>
                <textarea
                  name="description"
                  className={cn(fieldClass, "min-h-24 resize-y")}
                  maxLength={500}
                />
              </Field>
              <div className="flex justify-end sm:col-span-2">
                <Button
                  type="submit"
                  variant="outline"
                  loading={action === "portfolio"}
                  disabled={action !== null}
                >
                  <ImagePlus className="size-4" /> Add portfolio item
                </Button>
              </div>
            </form>
          </Surface>
        ) : profile.portfolio.length >= 12 ? (
          <InlineAlert
            className="mt-5"
            variant="success"
            title="Portfolio is full"
            description="Remove an older item before adding another. Up to 12 public examples are supported."
          />
        ) : null}
      </section>
    </div>
  );
}

function Field({
  children,
  full = false,
  label,
}: {
  children: React.ReactNode;
  full?: boolean;
  label: string;
}) {
  return (
    <label className={cn("block", full && "sm:col-span-2")}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
