"use client";

/* eslint-disable @next/next/no-img-element -- pending blob previews use object URLs not supported by Next Image optimization */

import { ArrowRight, EyeOff, ImagePlus, Send, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Children, cloneElement, isValidElement, useId, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { ZodError } from "zod";
import { createProfessionalServiceBodySchema, updateProfessionalServiceBodySchema } from "@/modules/professional-services/schemas";

import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import { ServiceAreaMultiPicker } from "@/components/ui/service-area-multi-picker";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";
import { cn } from "@/lib/utils";
import { parseWorkspaceId } from "@/modules/workspace/types";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";
import type {
  ManagedImageAsset,
  ProfessionalServiceSummary,
} from "@/modules/professional-services/types";
import {
  CatalogueApiError,
  catalogueApi as api,
  uploadCatalogueImage,
} from "./catalogue-api";

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-[#071522]/35";

export const SERVICE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";
export const MAX_SERVICE_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_SERVICE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_SERVICE_IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export function validateServiceImageFile(file: File): string | null {
  const type = file.type?.toLowerCase() ?? "";
  const name = file.name?.toLowerCase() ?? "";
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const typeOk = ALLOWED_SERVICE_IMAGE_TYPES.has(type);
  const extOk = ALLOWED_SERVICE_IMAGE_EXTENSIONS.has(ext);
  // Allow if either mime or extension matches (covers browsers reporting empty mime for some jpgs)
  if (!typeOk && !extOk) {
    return "Use PNG, JPG or WebP only.";
  }
  if (file.size > MAX_SERVICE_IMAGE_BYTES) {
    return "Each image must be under 10 MB.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  return null;
}

export { MyServicesPage as ServiceCatalogue } from "./my-services-page";

type EditableServiceFields = {
  name: string;
  category: string;
  description: string;
  fulfilmentModel: string;
  serviceType: string;
  pricingModel: string;
  price: string;
  duration: string;
  serviceAreas: string[];
  includedItems: string;
  excludedItems: string;
  requirements: string;
  warrantyDays: string;
  warrantyTerms: string;
  directBookingEnabled: boolean;
};

function editableFields(service: ProfessionalServiceSummary): EditableServiceFields {
  return {
    name: service.name,
    category: service.category ?? "",
    description: service.description ?? "",
    fulfilmentModel: service.fulfilmentModel ?? "",
    serviceType: (service.serviceType as string | null) ?? "",
    pricingModel: service.pricingModel ?? "",
    price: service.priceMinor == null ? "" : String(service.priceMinor / 100),
    duration: service.estimatedDurationMinutes == null ? "" : String(service.estimatedDurationMinutes),
    serviceAreas: [...service.serviceAreas],
    includedItems: (service.includedItems ?? []).join("\n"),
    excludedItems: (service.excludedItems ?? []).join("\n"),
    requirements: service.requirements.join("\n"),
    warrantyDays: service.warrantyDurationDays == null ? "" : String(service.warrantyDurationDays),
    warrantyTerms: service.warrantyTerms ?? "",
    directBookingEnabled: service.directBookingEnabled,
  };
}

export function ServiceEditor({ serviceId, embedded = false, onSaved }: { serviceId: string; embedded?: boolean; onSaved?: (service: ProfessionalServiceSummary) => void }) {
  const [service, setService] = useState<ProfessionalServiceSummary | null>(null);
  const [form, setForm] = useState<EditableServiceFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<ManagedImageAsset[]>([]);
  const [imageAction, setImageAction] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    void Promise.all([
      api<ProfessionalServiceSummary>(`/api/v1/professional/services/${serviceId}`),
      api<ManagedImageAsset[]>(`/api/v1/professional/services/${serviceId}/images`),
    ])
      .then(([loaded, loadedImages]) => {
        setService(loaded);
        setForm(editableFields(loaded));
        setImages(loadedImages);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load this service."))
      .finally(() => setLoading(false));
  }, [serviceId]);

  function update<K extends keyof EditableServiceFields>(key: K, value: EditableServiceFields[K]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setFieldErrors((current) => ({
      ...current,
      [key === "price" ? "priceMinor" : key]: "",
    }));
  }

  function applyFailure(cause: unknown, fallback: string) {
    const message = cause instanceof ZodError ? "Check the highlighted service details." : cause instanceof Error ? cause.message : fallback;
    setError(message);
    if (cause instanceof ZodError) setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [String(issue.path[0]), issue.message])));
    if (cause instanceof CatalogueApiError) {
      setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [issue.path, "Required before publishing."])));
    }
    toast.error(fallback, { description: message });
  }

  function payload() {
    if (!form || !service) throw new Error("Service details are unavailable.");
    return updateProfessionalServiceBodySchema.parse({
      version: service.version,
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      fulfilmentModel: form.fulfilmentModel || null,
      serviceType: form.serviceType || null,
      pricingModel: form.pricingModel || null,
      priceMinor: form.pricingModel === "custom_quote" || !form.price ? null : Math.round(Number(form.price) * 100),
      estimatedDurationMinutes: form.duration ? Number(form.duration) : null,
      serviceAreas: form.serviceAreas,
      includedItems: form.includedItems.split("\n").map((item) => item.trim()).filter(Boolean),
      excludedItems: form.excludedItems.split("\n").map((item) => item.trim()).filter(Boolean),
      requirements: form.requirements.split("\n").map((item) => item.trim()).filter(Boolean),
      warrantyDurationDays: form.warrantyDays ? Number(form.warrantyDays) : null,
      warrantyTerms: form.warrantyTerms || null,
      directBookingEnabled: form.directBookingEnabled,
    });
  }

  async function save() {
    if (!service) return;
    setAction("save"); setError(null); setFieldErrors({});
    try {
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${service.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()),
      });
      setService(updated); setForm(editableFields(updated)); onSaved?.(updated); toast.success("Service draft saved");
    } catch (cause) { applyFailure(cause, "Couldn’t save service"); } finally { setAction(null); }
  }

  async function transition(next: "publish" | "unpublish") {
    if (!service) return;
    setAction(next); setError(null); setFieldErrors({});
    try {
      let transitionSource = service;
      if (next === "publish" && form && JSON.stringify(form) !== JSON.stringify(editableFields(service))) {
        transitionSource = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${service.id}`, {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()),
        });
        setService(transitionSource);
        setForm(editableFields(transitionSource));
      }
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${service.id}/${next}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: transitionSource.version }),
      });
      setService(updated); setForm(editableFields(updated)); onSaved?.(updated);
      toast.success(next === "publish" ? "Service published" : "Service unpublished");
    } catch (cause) { applyFailure(cause, next === "publish" ? "Couldn’t publish service" : "Couldn’t unpublish service"); } finally { setAction(null); }
  }

  async function addImage(file: File) {
    if (!service) return;
    const validation = validateServiceImageFile(file);
    if (validation) {
      setImageError(validation);
      toast.error("Image not added", { description: validation });
      return;
    }
    if (images.length >= 6) {
      const msg = "You can add up to 6 images.";
      setImageError(msg);
      toast.error(msg);
      return;
    }
    setImageAction("upload");
    setImageError(null);
    setError(null);
    try {
      const assetId = await uploadCatalogueImage({
        file,
        purpose: "SERVICE_IMAGE",
        organisationId: service.organisationId,
      });
      const image = await api<ManagedImageAsset>(
        `/api/v1/professional/services/${service.id}/images`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ assetId }),
        },
      );
      setImages((current) => [...current, image]);
      toast.success("Service image added");
    } catch (cause) {
      applyFailure(cause, "Couldn’t add service image");
    } finally {
      setImageAction(null);
    }
  }

  async function addImages(files: File[]) {
    if (!service || files.length === 0) return;
    const remaining = 6 - images.length;
    if (remaining <= 0) {
      const msg = "You can add up to 6 images.";
      setImageError(msg);
      toast.error(msg);
      return;
    }
    const slice = files.slice(0, remaining);
    const valid: File[] = [];
    const rejected: string[] = [];
    for (const file of slice) {
      const v = validateServiceImageFile(file);
      if (v) rejected.push(`${file.name}: ${v}`);
      else valid.push(file);
    }
    if (rejected.length > 0) {
      const msg = rejected[0];
      setImageError(msg);
      toast.error(rejected.length === 1 ? "Image not added" : `${rejected.length} images not added`, { description: msg });
    }
    if (valid.length === 0) return;
    // Upload sequentially to preserve position order and avoid burst
    for (const file of valid) {
      await addImage(file);
    }
    if (slice.length < files.length || files.length > remaining) {
      toast.error("Some images were not added", { description: "You can add up to 6 images." });
    }
  }

  function handleEditorDragOver(event: DragEvent<HTMLDivElement>) {
    if (published || imageAction) return;
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleEditorDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
  }

  function handleEditorDrop(event: DragEvent<HTMLDivElement>) {
    if (published || imageAction) return;
    event.preventDefault();
    setIsDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void addImages(files);
  }

  async function removeImage(image: ManagedImageAsset) {
    if (!service) return;
    setImageAction(image.id);
    try {
      await api(`/api/v1/professional/services/${service.id}/images/${image.id}`, {
        method: "DELETE",
      });
      setImages((current) => current.filter((item) => item.id !== image.id));
      void api(`/api/v1/storage/assets/${image.assetId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
      toast.success("Service image removed");
    } catch (cause) {
      applyFailure(cause, "Couldn’t remove service image");
    } finally {
      setImageAction(null);
    }
  }

  if (loading) return <DetailPageSkeleton />;
  if (!service || !form) return <StatePanel variant="error" title="Service unavailable" description={error ?? "This service could not be found."} />;
  const published = service.status === "published";
  const busy = action !== null;

  return <div className="space-y-7">
    {!embedded ? <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#5f8d11]">Service catalogue</p><h1 className="mt-2 text-3xl font-semibold tracking-title">{service.name}</h1><p className="mt-2 text-sm text-[#68717b]">Version {service.version} &middot; <span className="capitalize">{service.status}</span></p></div>
      <Link href="/professional/services" className={buttonVariants({ variant: "outline" })}>Back to services</Link>
    </div> : null}
    {published ? <InlineAlert variant="success" title="This service is public" description="Unpublish it before changing public details. The current publication snapshot remains preserved." /> : null}
    {error ? <InlineAlert title="Action unsuccessful" description={error} /> : null}
    <section className={cn("grid gap-5", !embedded && "sm:grid-cols-2", embedded && "[&>label]:col-span-1")}>
      <EditorField label="Service name" error={fieldErrors.name}><Input value={form.name} onChange={(e) => update("name", e.target.value)} disabled={published} /></EditorField>
      <ServiceCategoryField value={form.category} onChange={(value) => update("category", value)} disabled={published} error={fieldErrors.category} />
      <EditorField label="Description" full error={fieldErrors.description}><textarea className={cn(fieldClass, "min-h-32 resize-y disabled:opacity-60")} value={form.description} onChange={(e) => update("description", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Fulfilment model" error={fieldErrors.fulfilmentModel}><select className={fieldClass} value={form.fulfilmentModel} onChange={(e) => update("fulfilmentModel", e.target.value)} disabled={published}><option value="">Select a model</option><option value="on_site">On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></EditorField>
      <EditorField label="Service type" error={fieldErrors.serviceType}><select className={fieldClass} value={form.serviceType} onChange={(e) => update("serviceType", e.target.value)} disabled={published}><option value="">Select a type</option><option value="repairs_maintenance">Repairs & maintenance</option><option value="installation">Installation</option><option value="inspection">Inspection</option><option value="emergency">Emergency</option><option value="maintenance">Maintenance</option></select></EditorField>
      <EditorField label="Pricing model" error={fieldErrors.pricingModel}><select className={fieldClass} value={form.pricingModel} onChange={(e) => { update("pricingModel", e.target.value); if (e.target.value === "custom_quote") update("price", ""); }} disabled={published}><option value="">Select a model</option><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="custom_quote">Custom quotation</option></select></EditorField>
      <EditorField label="Price (KES)" error={fieldErrors.priceMinor}><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} disabled={published || form.pricingModel === "custom_quote"} /></EditorField>
      <EditorField label="Estimated duration (minutes)" error={fieldErrors.estimatedDurationMinutes}><Input type="number" min="1" max="43200" value={form.duration} onChange={(e) => update("duration", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Service areas" error={fieldErrors.serviceAreas}>
        <ServiceAreaMultiPicker value={form.serviceAreas} onChange={(value) => update("serviceAreas", value)} disabled={published} />
      </EditorField>
      <EditorField label="What's included" error={fieldErrors.includedItems}><textarea className={cn(fieldClass, "min-h-28 resize-y disabled:opacity-60")} value={form.includedItems} onChange={(e) => update("includedItems", e.target.value)} disabled={published} placeholder="One included item per line" /></EditorField>
      <EditorField label="What's excluded" error={fieldErrors.excludedItems}><textarea className={cn(fieldClass, "min-h-28 resize-y disabled:opacity-60")} value={form.excludedItems} onChange={(e) => update("excludedItems", e.target.value)} disabled={published} placeholder="One excluded item per line" /></EditorField>
      <EditorField label="Client requirements" error={fieldErrors.requirements}><textarea className={cn(fieldClass, "min-h-28 resize-y disabled:opacity-60")} value={form.requirements} onChange={(e) => update("requirements", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Warranty duration (days)" error={fieldErrors.warrantyDurationDays}><Input type="number" min="0" max="3650" value={form.warrantyDays} onChange={(e) => update("warrantyDays", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Warranty terms" full error={fieldErrors.warrantyTerms}><textarea className={cn(fieldClass, "min-h-24 resize-y disabled:opacity-60")} value={form.warrantyTerms} onChange={(e) => update("warrantyTerms", e.target.value)} disabled={published} /></EditorField>
    </section>
    <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6"><input type="checkbox" className="mt-1" checked={form.directBookingEnabled} onChange={(e) => update("directBookingEnabled", e.target.checked)} disabled={published} /><span>Allow clients to book this service directly.</span></label>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Service images</h2><p className="mt-1 text-sm text-[#68717b]">The first image becomes the public cover. Add up to six clear examples. PNG, JPG or WebP, up to 10 MB each.</p></div>
        {!published && images.length < 6 ? <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative focus-within:outline-2 focus-within:outline-offset-2")}><input className="sr-only left-1/2 top-1/2" type="file" accept={SERVICE_IMAGE_ACCEPT} multiple disabled={imageAction !== null} onChange={(event) => { const files = event.target.files ? Array.from(event.target.files) : []; if (files.length === 1) void addImage(files[0]); else if (files.length > 1) void addImages(files); event.currentTarget.value = ""; }} /><ImagePlus className="size-4" />{imageAction === "upload" ? "Uploading…" : "Add image"}</label> : null}
      </div>
      {imageError ? <InlineAlert className="mt-3" title="Image not added" description={imageError} /> : null}
      <div
        onDragOver={handleEditorDragOver}
        onDragEnter={handleEditorDragOver}
        onDragLeave={handleEditorDragLeave}
        onDrop={handleEditorDrop}
        className={cn(
          "mt-4 rounded-3xl transition-colors",
          !published && isDragOver && "ring-2 ring-success ring-offset-2 bg-success-soft/30",
          !published && !isDragOver && images.length === 0 && "border border-dashed border-black/10 bg-[#fbfcfd]",
        )}
        aria-label="Service images drop zone"
      >
        {images.length === 0 ? (
          <div className={cn("p-2", isDragOver && "bg-success-soft/20 rounded-3xl")}>
            <StatePanel
              title={isDragOver ? "Drop images here" : "No service images"}
              description={
                isDragOver
                  ? "Release to upload PNG, JPG or WebP (up to 10 MB each)."
                  : "Drag & drop images here or use Add image. First image is the cover."
              }
              icon={isDragOver ? <UploadCloud className="size-5" /> : undefined}
            />
            {!published ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Supports drag & drop and multiselect. {images.length}/6 used.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <div key={image.id} className="overflow-hidden rounded-3xl border border-black/8 bg-white">
                  <div className="relative aspect-[4/3] bg-[#eef1f2]">
                    {image.imageUrl ? <Image src={image.imageUrl} alt={`Service image ${index + 1}`} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" /> : null}
                    {index === 0 ? <span className="absolute left-3 top-3 rounded-full bg-[#071522] px-3 py-1 text-xs font-semibold text-white">Cover</span> : null}
                  </div>
                  {!published ? (
                    <div className="flex justify-end p-3">
                      <Button type="button" size="sm" variant="ghost" onClick={() => void removeImage(image)} loading={imageAction === image.id}>
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {!published && isDragOver ? (
              <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-success bg-success-soft/40 p-4 text-sm font-medium text-success">
                <UploadCloud className="size-4" /> Drop to add more images
              </div>
            ) : !published && images.length < 6 ? (
              <p className="mt-3 text-center text-xs text-muted-foreground">Drag & drop more images here or use Add image. {images.length}/6 used.</p>
            ) : null}
          </>
        )}
      </div>
    </section>
    <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-6">
      {published ? <Link href={`/services/${service.slug}`} className={buttonVariants({ variant: "outline" })}>View public page</Link> : null}
      {!published ? <Button type="button" variant="outline" onClick={save} loading={action === "save"} disabled={busy}>Save changes</Button> : null}
      {published ? <Button type="button" variant="outline" onClick={() => void transition("unpublish")} loading={action === "unpublish"} disabled={busy}><EyeOff className="size-4" /> Unpublish</Button> : <Button type="button" variant="secondary" onClick={() => void transition("publish")} loading={action === "publish"} disabled={busy}><Send className="size-4" /> Publish service</Button>}
    </div>
  </div>;
}

function ServiceCategoryField({ value, onChange, disabled = false, error }: { value: string; onChange: (value: string) => void; disabled?: boolean; error?: string }) {
  const [categories, setCategories] = useState<MarketplaceCategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void api<MarketplaceCategorySummary[]>("/api/v1/public/categories", { signal: controller.signal })
      .then((items) => {
        if (!controller.signal.aborted) setCategories(items.filter((item) => item.status === "active"));
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);

  const existingValue = value && !categories.some((item) => item.name === value);
  return <div>
    <Field label="Category" error={error}>
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled || loading || loadError || categories.length === 0} aria-busy={loading}>
        <option value="">{loading ? "Loading categories?" : loadError ? "Categories unavailable" : categories.length ? "Select a category" : "No categories available"}</option>
        {existingValue ? <option value={value}>{value} (current)</option> : null}
        {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
      </select>
    </Field>
    {loadError ? <div className="mt-2 text-xs text-danger" role="alert">Could not load categories. <button type="button" className="underline" onClick={() => { setLoading(true); setLoadError(false); setAttempt((current) => current + 1); }}>Try again</button></div> : null}
  </div>;
}

function EditorField({ label, children, full = false, error }: { label: string; children: React.ReactNode; full?: boolean; error?: string }) {
  return <Field label={label} full={full} error={error}>{children}</Field>;
}

export function CreateServiceForm({ embedded = false, onCreated, onCancel }: { embedded?: boolean; onCreated?: (service: ProfessionalServiceSummary) => void; onCancel?: () => void } = {}) {
  const router = useRouter();
  const { workspaceId } = useWorkspaceShell();
  const organisationId = (() => {
    if (!workspaceId) return null;
    const parsed = parseWorkspaceId(workspaceId);
    return parsed?.kind === "organisation" ? parsed.referenceId : null;
  })();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [fulfilmentModel, setFulfilmentModel] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [includedItems, setIncludedItems] = useState("");
  const [excludedItems, setExcludedItems] = useState("");
  const [requirements, setRequirements] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [directBookingEnabled, setDirectBookingEnabled] = useState(false);
  const [pendingImages, setPendingImages] = useState<Array<{ id: string; file: File; preview: string }>>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [pendingImageError, setPendingImageError] = useState<string | null>(null);
  const [isPendingDragOver, setIsPendingDragOver] = useState(false);

  function createPendingId() {
    try {
      if (typeof crypto !== "undefined" && typeof (crypto as { randomUUID?: () => string }).randomUUID === "function") {
        return (crypto as { randomUUID: () => string }).randomUUID();
      }
    } catch {
      // fallback below
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function addPendingFiles(files: FileList | File[] | null) {
    if (!files) return;
    const list = Array.from(files as unknown as FileList & Iterable<File>);
    const remaining = 6 - pendingImages.length;
    if (remaining <= 0) {
      const msg = "You can add up to 6 images.";
      setPendingImageError(msg);
      toast.error(msg);
      return;
    }
    const slice = list.slice(0, remaining);
    const valid: File[] = [];
    const rejected: string[] = [];
    for (const file of slice) {
      const v = validateServiceImageFile(file);
      if (v) rejected.push(`${file.name}: ${v}`);
      else valid.push(file);
    }
    if (rejected.length > 0) {
      const msg = rejected[0];
      setPendingImageError(msg);
      toast.error(rejected.length === 1 ? "Image not added" : `${rejected.length} images not added`, { description: msg });
    } else {
      setPendingImageError(null);
    }
    if (list.length > slice.length) {
      toast.error("Some images were not added", { description: "You can add up to 6 images." });
    }
    if (valid.length === 0) return;
    const next = valid.map((file) => ({ id: createPendingId(), file, preview: URL.createObjectURL(file) }));
    setPendingImages((prev) => [...prev, ...next]);
  }

  function handlePendingDragOver(event: DragEvent<HTMLDivElement>) {
    if (saving || imageUploading) return;
    event.preventDefault();
    setIsPendingDragOver(true);
  }

  function handlePendingDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsPendingDragOver(false);
  }

  function handlePendingDrop(event: DragEvent<HTMLDivElement>) {
    if (saving || imageUploading) return;
    event.preventDefault();
    setIsPendingDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) addPendingFiles(files);
  }

  function removePending(id: string) {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  }

  const pendingImagesRef = useRef(pendingImages);
  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);
  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  function resetForm(formElement?: HTMLFormElement | null) {
    setName("");
    setCategory("");
    setDescription("");
    setFulfilmentModel("");
    setServiceType("");
    setPricingModel("");
    setPrice("");
    setDuration("");
    setServiceAreas([]);
    setIncludedItems("");
    setExcludedItems("");
    setRequirements("");
    setWarrantyDays("");
    setWarrantyTerms("");
    setDirectBookingEnabled(false);
    setFieldErrors({});
    setError(null);
    setPendingImageError(null);
    setIsPendingDragOver(false);
    setPendingImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.preview));
      return [];
    });
    setImageUploading(false);
    formElement?.reset();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const created = await api<ProfessionalServiceSummary>("/api/v1/professional/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(createProfessionalServiceBodySchema.parse({
          name,
          category: category || null,
          description: description || null,
          fulfilmentModel: fulfilmentModel || null,
          serviceType: serviceType || null,
          pricingModel: pricingModel || null,
          priceMinor: pricingModel === "custom_quote" || !price ? null : Math.round(Number(price) * 100),
          estimatedDurationMinutes: duration ? Number(duration) : null,
          serviceAreas,
          includedItems: includedItems.split("\n").map((item) => item.trim()).filter(Boolean),
          excludedItems: excludedItems.split("\n").map((item) => item.trim()).filter(Boolean),
          requirements: requirements.split("\n").map((item) => item.trim()).filter(Boolean),
          warrantyDurationDays: warrantyDays ? Number(warrantyDays) : null,
          warrantyTerms: warrantyTerms || null,
          directBookingEnabled,
        })),
      });
      const imagesToUpload = [...pendingImages];
      if (imagesToUpload.length > 0) {
        if (!organisationId) {
          toast.error("Service draft created but images were not uploaded", { description: "Workspace unavailable for image upload. Add images from the editor." });
        } else {
          setImageUploading(true);
          for (const item of imagesToUpload) {
            try {
              const assetId = await uploadCatalogueImage({
                file: item.file,
                purpose: "SERVICE_IMAGE",
                organisationId,
              });
              await api<ManagedImageAsset>(`/api/v1/professional/services/${created.id}/images`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ assetId }),
              });
            } catch (cause) {
              const message = cause instanceof Error ? cause.message : "Image upload failed.";
              toast.error("Service draft created but an image failed", { description: message });
            }
          }
          setImageUploading(false);
        }
      }
      resetForm(event.currentTarget as HTMLFormElement);
      toast.success("Service draft created");
      if (onCreated) onCreated(created);
      else router.push("/professional/services");
    } catch (cause) {
      const message = cause instanceof ZodError ? "Check the highlighted service details." : cause instanceof Error ? cause.message : "Unable to create the service draft.";
      if (cause instanceof ZodError) setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [String(issue.path[0]), issue.message])));
      if (cause instanceof CatalogueApiError) setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [issue.path.split(".")[0], "Check this value and try again."])));
      setError(message);
      toast.error("Couldn’t create service", { description: message });
    } finally {
      setSaving(false);
      setImageUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      {!embedded ? <div>
        <p className="text-sm font-semibold text-[#5f8d11]">New service</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-title">Create a service draft</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">Start with what you know. This remains private until it passes publication checks and you choose to publish it.</p>
      </div> : null}
      {error ? <InlineAlert title="Check the service details" description={error} /> : null}
      <section className={cn("grid gap-5", !embedded && "sm:grid-cols-2", embedded && "[&>label]:col-span-1")}>
        <Field error={fieldErrors.name} label="Service name" required><Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Plumbing inspection" /></Field>
        <ServiceCategoryField value={category} onChange={setCategory} error={fieldErrors.category} />
        <Field error={fieldErrors.description} label="Description" full><textarea className={cn(fieldClass, "min-h-32 resize-y")} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the work, outcome, and who this service is for." /></Field>
        <Field error={fieldErrors.fulfilmentModel} label="Fulfilment model"><select className={fieldClass} value={fulfilmentModel} onChange={(event) => setFulfilmentModel(event.target.value)}><option value="">Select a model</option><option value="on_site">On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></Field>
        <Field error={fieldErrors.serviceType} label="Service type"><select className={fieldClass} value={serviceType} onChange={(event) => setServiceType(event.target.value)}><option value="">Select a type</option><option value="repairs_maintenance">Repairs & maintenance</option><option value="installation">Installation</option><option value="inspection">Inspection</option><option value="emergency">Emergency</option><option value="maintenance">Maintenance</option></select></Field>
        <Field error={fieldErrors.pricingModel} label="Pricing model"><select className={fieldClass} value={pricingModel} onChange={(event) => { setPricingModel(event.target.value); if (event.target.value === "custom_quote") setPrice(""); }}><option value="">Select a model</option><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="custom_quote">Custom quotation</option></select></Field>
        <Field error={fieldErrors.priceMinor} label="Price (KES)"><Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} disabled={pricingModel === "custom_quote"} placeholder={pricingModel === "custom_quote" ? "Not shown for custom quotations" : "0.00"} /></Field>
        <Field error={fieldErrors.estimatedDurationMinutes} label="Estimated duration (minutes)"><Input type="number" min="1" max="43200" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="120" /></Field>
        <Field error={fieldErrors.serviceAreas} label="Service areas">
          <ServiceAreaMultiPicker value={serviceAreas} onChange={setServiceAreas} />
        </Field>
        <Field error={fieldErrors.includedItems} label="What's included"><textarea className={cn(fieldClass, "min-h-28 resize-y")} value={includedItems} onChange={(event) => setIncludedItems(event.target.value)} placeholder="One included item per line" /></Field>
        <Field error={fieldErrors.excludedItems} label="What's excluded"><textarea className={cn(fieldClass, "min-h-28 resize-y")} value={excludedItems} onChange={(event) => setExcludedItems(event.target.value)} placeholder="One excluded item per line" /></Field>
        <Field error={fieldErrors.requirements} label="Client requirements"><textarea className={cn(fieldClass, "min-h-28 resize-y")} value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="One requirement per line" /></Field>
        <Field error={fieldErrors.warrantyDurationDays} label="Warranty duration (days)"><Input type="number" min="0" max="3650" value={warrantyDays} onChange={(event) => setWarrantyDays(event.target.value)} placeholder="30" /></Field>
        <Field error={fieldErrors.warrantyTerms} label="Warranty terms" full><textarea className={cn(fieldClass, "min-h-24 resize-y")} value={warrantyTerms} onChange={(event) => setWarrantyTerms(event.target.value)} placeholder="Describe what is covered and any exclusions." /></Field>
      </section>
      <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6"><input type="checkbox" className="mt-1" checked={directBookingEnabled} onChange={(event) => setDirectBookingEnabled(event.target.checked)} /><span>Allow direct booking after this service is complete and published.</span></label>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Service images</h2><p className="mt-1 text-sm text-[#68717b]">The first image becomes the public cover. Add up to six clear examples. PNG, JPG or WebP, up to 10 MB each.</p></div>
          {pendingImages.length < 6 ? <label className={cn(buttonVariants({ variant: "outline", size: "sm" }), "relative focus-within:outline-2 focus-within:outline-offset-2")}><input className="sr-only left-1/2 top-1/2" type="file" accept={SERVICE_IMAGE_ACCEPT} multiple disabled={saving || imageUploading} onChange={(event) => { addPendingFiles(event.target.files); event.currentTarget.value = ""; }} /><ImagePlus className="size-4" />{imageUploading ? "Uploading…" : "Add image"}</label> : null}
        </div>
        {pendingImageError ? <InlineAlert className="mt-3" title="Image not added" description={pendingImageError} /> : null}
        <div
          onDragOver={handlePendingDragOver}
          onDragEnter={handlePendingDragOver}
          onDragLeave={handlePendingDragLeave}
          onDrop={handlePendingDrop}
          className={cn(
            "mt-4 rounded-3xl transition-colors",
            isPendingDragOver && "ring-2 ring-success ring-offset-2 bg-success-soft/30",
            !isPendingDragOver && pendingImages.length === 0 && "border border-dashed border-black/10 bg-[#fbfcfd]",
          )}
          aria-label="Service pending images drop zone"
        >
          {pendingImages.length === 0 ? (
            <div className={cn("p-2", isPendingDragOver && "bg-success-soft/20 rounded-3xl")}>
              <StatePanel
                title={isPendingDragOver ? "Drop images here" : "No service images"}
                description={
                  isPendingDragOver
                    ? "Release to upload PNG, JPG or WebP (up to 10 MB each)."
                    : "Drag & drop images here or use Add image. First image is the cover."
                }
                icon={isPendingDragOver ? <UploadCloud className="size-5" /> : undefined}
              />
              <p className="mt-3 text-center text-xs text-muted-foreground">Supports drag & drop and multiselect. 0/6 images.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pendingImages.map((item, index) => (
                  <div key={item.id} className="overflow-hidden rounded-3xl border border-black/8 bg-white">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#eef1f2]">
                      <img src={item.preview} alt={`Service image ${index + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                      {index === 0 ? <span className="absolute left-3 top-3 rounded-full bg-[#071522] px-3 py-1 text-xs font-semibold text-white">Cover</span> : null}
                    </div>
                    <div className="flex justify-end p-3">
                      <Button type="button" size="sm" variant="ghost" onClick={() => removePending(item.id)} disabled={saving || imageUploading}>
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {isPendingDragOver ? (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-success bg-success-soft/40 p-4 text-sm font-medium text-success">
                  <UploadCloud className="size-4" /> Drop to add more images
                </div>
              ) : pendingImages.length < 6 ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">Drag & drop more images here or use Add image. {pendingImages.length}/6 used.</p>
              ) : null}
            </>
          )}
        </div>
      </section>
      <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-6">{onCancel ? <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button> : <Link href="/professional/services" className={buttonVariants({ variant: "outline" })}>Cancel</Link>}<Button type="submit" variant="secondary" loading={saving || imageUploading} disabled={saving || imageUploading}>Save draft <ArrowRight className="size-4" /></Button></div>
    </form>
  );
}

function Field({ label, children, full = false, required = false, error }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean; error?: string }) {
  const errorId = useId();
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-2 block text-sm font-semibold">{label}{required ? <span className="text-danger"> *</span> : null}</span>{Children.map(children, (child) => {
    if (!isValidElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>(child)) return child;
    if (child.type !== Input && !["input", "textarea", "select"].includes(String(child.type))) return child;
    return cloneElement(child, { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined });
  })}{error ? <span id={errorId} role="alert" className="mt-1 block text-xs font-medium text-danger">{error}</span> : null}</label>;
}
