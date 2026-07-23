"use client";

import { ArrowRight, EyeOff, ImagePlus, Plus, Send, Store, Trash2, Wrench } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
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

export function ServiceCatalogue() {
  const [services, setServices] = useState<ProfessionalServiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<ProfessionalServiceSummary[]>("/api/v1/professional/services")
      .then(setServices)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Unable to load services."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <StatePanel variant="loading" title="Loading services" description="Retrieving the organisation’s service catalogue." />;
  }
  if (error) {
    return <StatePanel variant="error" title="Services unavailable" description={error} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">Service catalogue</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">Services clients can request</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">Create clear service offers, keep incomplete work as drafts, and publish only when every required detail is ready.</p>
        </div>
        <Link href="/professional/services/new" className={buttonVariants({ variant: "secondary" })}>
          <Plus className="size-4" /> Add service
        </Link>
      </div>

      {services.length === 0 ? (
        <StatePanel title="No services yet" description="Create your first service as a private draft. Nothing appears publicly until you explicitly publish it." icon={<Store className="size-5" />}>
          <Link href="/professional/services/new" className={buttonVariants({ variant: "secondary", size: "sm" })}>Create first service</Link>
        </StatePanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <Surface key={service.id} className="p-5 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#eef8c8] text-[#5f8d11]"><Wrench className="size-5" /></span>
                <span className={cn("rounded-full px-3 py-1 text-xs font-semibold capitalize", service.status === "published" ? "bg-success-soft text-success" : "bg-[#edf1f3] text-[#68717b]")}>{service.status}</span>
              </div>
              <h2 className="mt-5 text-xl font-bold">{service.name}</h2>
              <p className="mt-1 text-xs text-[#68717b]">{service.category ?? "Category not set"}</p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#68717b]">{service.description ?? "Add a description before publishing this service."}</p>
              <Link href={`/professional/services/${service.id}`} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#5f8d11]">Manage service <ArrowRight className="size-3.5" /></Link>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}

type EditableServiceFields = {
  name: string;
  category: string;
  description: string;
  fulfilmentModel: string;
  pricingModel: string;
  price: string;
  duration: string;
  serviceAreas: string;
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
    pricingModel: service.pricingModel ?? "",
    price: service.priceMinor == null ? "" : String(service.priceMinor / 100),
    duration: service.estimatedDurationMinutes == null ? "" : String(service.estimatedDurationMinutes),
    serviceAreas: service.serviceAreas.join(", "),
    requirements: service.requirements.join("\n"),
    warrantyDays: service.warrantyDurationDays == null ? "" : String(service.warrantyDurationDays),
    warrantyTerms: service.warrantyTerms ?? "",
    directBookingEnabled: service.directBookingEnabled,
  };
}

export function ServiceEditor({ serviceId }: { serviceId: string }) {
  const [service, setService] = useState<ProfessionalServiceSummary | null>(null);
  const [form, setForm] = useState<EditableServiceFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"save" | "publish" | "unpublish" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [images, setImages] = useState<ManagedImageAsset[]>([]);
  const [imageAction, setImageAction] = useState<string | null>(null);

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
    const message = cause instanceof Error ? cause.message : fallback;
    setError(message);
    if (cause instanceof CatalogueApiError) {
      setFieldErrors(Object.fromEntries(cause.issues.map((issue) => [issue.path, "Required before publishing."])));
    }
    toast.error(fallback, { description: message });
  }

  function payload() {
    if (!form || !service) throw new Error("Service details are unavailable.");
    return {
      version: service.version,
      name: form.name,
      category: form.category || null,
      description: form.description || null,
      fulfilmentModel: form.fulfilmentModel || null,
      pricingModel: form.pricingModel || null,
      priceMinor: form.pricingModel === "custom_quote" || !form.price ? null : Math.round(Number(form.price) * 100),
      estimatedDurationMinutes: form.duration ? Number(form.duration) : null,
      serviceAreas: form.serviceAreas.split(",").map((item) => item.trim()).filter(Boolean),
      requirements: form.requirements.split("\n").map((item) => item.trim()).filter(Boolean),
      warrantyDurationDays: form.warrantyDays ? Number(form.warrantyDays) : null,
      warrantyTerms: form.warrantyTerms || null,
      directBookingEnabled: form.directBookingEnabled,
    };
  }

  async function save() {
    if (!service) return;
    setAction("save"); setError(null); setFieldErrors({});
    try {
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${service.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload()),
      });
      setService(updated); setForm(editableFields(updated)); toast.success("Service draft saved");
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
      setService(updated); setForm(editableFields(updated));
      toast.success(next === "publish" ? "Service published" : "Service unpublished");
    } catch (cause) { applyFailure(cause, next === "publish" ? "Couldn’t publish service" : "Couldn’t unpublish service"); } finally { setAction(null); }
  }

  async function addImage(file: File) {
    if (!service) return;
    setImageAction("upload");
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

  if (loading) return <StatePanel variant="loading" title="Loading service" description="Retrieving the latest service details." />;
  if (!service || !form) return <StatePanel variant="error" title="Service unavailable" description={error ?? "This service could not be found."} />;
  const published = service.status === "published";
  const busy = action !== null;

  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-sm font-semibold text-[#5f8d11]">Service catalogue</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">{service.name}</h1><p className="mt-2 text-sm text-[#68717b]">Version {service.version} &middot; <span className="capitalize">{service.status}</span></p></div>
      <Link href="/professional/services" className={buttonVariants({ variant: "outline" })}>Back to services</Link>
    </div>
    {published ? <InlineAlert variant="success" title="This service is public" description="Unpublish it before changing public details. The current publication snapshot remains preserved." /> : null}
    {error ? <InlineAlert title="Action unsuccessful" description={error} /> : null}
    <section className="grid gap-5 sm:grid-cols-2">
      <EditorField label="Service name" error={fieldErrors.name}><Input value={form.name} onChange={(e) => update("name", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Category" error={fieldErrors.category}><Input value={form.category} onChange={(e) => update("category", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Description" full error={fieldErrors.description}><textarea className={cn(fieldClass, "min-h-32 resize-y disabled:opacity-60")} value={form.description} onChange={(e) => update("description", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Fulfilment model" error={fieldErrors.fulfilmentModel}><select className={fieldClass} value={form.fulfilmentModel} onChange={(e) => update("fulfilmentModel", e.target.value)} disabled={published}><option value="">Select a model</option><option value="on_site">On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></EditorField>
      <EditorField label="Pricing model" error={fieldErrors.pricingModel}><select className={fieldClass} value={form.pricingModel} onChange={(e) => { update("pricingModel", e.target.value); if (e.target.value === "custom_quote") update("price", ""); }} disabled={published}><option value="">Select a model</option><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="custom_quote">Custom quotation</option></select></EditorField>
      <EditorField label="Price (KES)" error={fieldErrors.priceMinor}><Input type="number" min="0" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} disabled={published || form.pricingModel === "custom_quote"} /></EditorField>
      <EditorField label="Estimated duration (minutes)"><Input type="number" min="1" max="43200" value={form.duration} onChange={(e) => update("duration", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Service areas"><Input value={form.serviceAreas} onChange={(e) => update("serviceAreas", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Client requirements"><textarea className={cn(fieldClass, "min-h-28 resize-y disabled:opacity-60")} value={form.requirements} onChange={(e) => update("requirements", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Warranty duration (days)"><Input type="number" min="0" max="3650" value={form.warrantyDays} onChange={(e) => update("warrantyDays", e.target.value)} disabled={published} /></EditorField>
      <EditorField label="Warranty terms" full><textarea className={cn(fieldClass, "min-h-24 resize-y disabled:opacity-60")} value={form.warrantyTerms} onChange={(e) => update("warrantyTerms", e.target.value)} disabled={published} /></EditorField>
    </section>
    <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6"><input type="checkbox" className="mt-1" checked={form.directBookingEnabled} onChange={(e) => update("directBookingEnabled", e.target.checked)} disabled={published} /><span>Allow clients to book this service directly.</span></label>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold">Service images</h2><p className="mt-1 text-sm text-[#68717b]">The first image becomes the public cover. Add up to six clear examples.</p></div>
        {!published && images.length < 6 ? <label className={buttonVariants({ variant: "outline", size: "sm" })}><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={imageAction !== null} onChange={(event) => { const file = event.target.files?.[0]; if (file) void addImage(file); event.currentTarget.value = ""; }} /><ImagePlus className="size-4" />{imageAction === "upload" ? "Uploading…" : "Add image"}</label> : null}
      </div>
      {images.length === 0 ? <StatePanel className="mt-4" title="No service images" description="Add an image before publishing to give clients a clearer view of the service." /> : <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((image, index) => <div key={image.id} className="overflow-hidden rounded-3xl border border-black/8 bg-white"><div className="relative aspect-[4/3] bg-[#eef1f2]">{image.imageUrl ? <Image src={image.imageUrl} alt={`Service image ${index + 1}`} fill className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" /> : null}{index === 0 ? <span className="absolute left-3 top-3 rounded-full bg-[#071522] px-3 py-1 text-xs font-semibold text-white">Cover</span> : null}</div>{!published ? <div className="flex justify-end p-3"><Button type="button" size="sm" variant="ghost" onClick={() => void removeImage(image)} loading={imageAction === image.id}><Trash2 className="size-4" /> Remove</Button></div> : null}</div>)}</div>}
    </section>
    <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-6">
      {published ? <Link href={`/services/${service.slug}`} className={buttonVariants({ variant: "outline" })}>View public page</Link> : null}
      {!published ? <Button type="button" variant="outline" onClick={save} loading={action === "save"} disabled={busy}>Save changes</Button> : null}
      {published ? <Button type="button" variant="outline" onClick={() => void transition("unpublish")} loading={action === "unpublish"} disabled={busy}><EyeOff className="size-4" /> Unpublish</Button> : <Button type="button" variant="secondary" onClick={() => void transition("publish")} loading={action === "publish"} disabled={busy}><Send className="size-4" /> Publish service</Button>}
    </div>
  </div>;
}

function EditorField({ label, children, full = false, error }: { label: string; children: React.ReactNode; full?: boolean; error?: string }) {
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}{error ? <span className="mt-1 block text-xs font-medium text-danger">{error}</span> : null}</label>;
}

export function CreateServiceForm() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [fulfilmentModel, setFulfilmentModel] = useState("");
  const [pricingModel, setPricingModel] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [requirements, setRequirements] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [directBookingEnabled, setDirectBookingEnabled] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api<ProfessionalServiceSummary>("/api/v1/professional/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          category: category || null,
          description: description || null,
          fulfilmentModel: fulfilmentModel || null,
          pricingModel: pricingModel || null,
          priceMinor: pricingModel === "custom_quote" || !price ? null : Math.round(Number(price) * 100),
          estimatedDurationMinutes: duration ? Number(duration) : null,
          serviceAreas: serviceAreas.split(",").map((item) => item.trim()).filter(Boolean),
          requirements: requirements.split("\n").map((item) => item.trim()).filter(Boolean),
          warrantyDurationDays: warrantyDays ? Number(warrantyDays) : null,
          warrantyTerms: warrantyTerms || null,
          directBookingEnabled,
        }),
      });
      toast.success("Service draft created");
      router.push("/professional/services");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to create the service draft.";
      setError(message);
      toast.error("Couldn’t create service", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-7">
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">New service</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">Create a service draft</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">Start with what you know. This remains private until it passes publication checks and you choose to publish it.</p>
      </div>
      {error ? <InlineAlert title="Check the service details" description={error} /> : null}
      <section className="grid gap-5 sm:grid-cols-2">
        <Field label="Service name" required><Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="e.g. Plumbing inspection" /></Field>
        <Field label="Category"><Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Plumbing, electrical, cleaning…" /></Field>
        <Field label="Description" full><textarea className={cn(fieldClass, "min-h-32 resize-y")} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the work, outcome, and who this service is for." /></Field>
        <Field label="Fulfilment model"><select className={fieldClass} value={fulfilmentModel} onChange={(event) => setFulfilmentModel(event.target.value)}><option value="">Select a model</option><option value="on_site">On-site</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></Field>
        <Field label="Pricing model"><select className={fieldClass} value={pricingModel} onChange={(event) => { setPricingModel(event.target.value); if (event.target.value === "custom_quote") setPrice(""); }}><option value="">Select a model</option><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="custom_quote">Custom quotation</option></select></Field>
        <Field label="Price (KES)"><Input type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} disabled={pricingModel === "custom_quote"} placeholder={pricingModel === "custom_quote" ? "Not shown for custom quotations" : "0.00"} /></Field>
        <Field label="Estimated duration (minutes)"><Input type="number" min="1" max="43200" value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="120" /></Field>
        <Field label="Service areas"><Input value={serviceAreas} onChange={(event) => setServiceAreas(event.target.value)} placeholder="Westlands, Kilimani" /><p className="mt-1 text-xs text-[#68717b]">Separate areas with commas.</p></Field>
        <Field label="Client requirements"><textarea className={cn(fieldClass, "min-h-28 resize-y")} value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="One requirement per line" /></Field>
        <Field label="Warranty duration (days)"><Input type="number" min="0" max="3650" value={warrantyDays} onChange={(event) => setWarrantyDays(event.target.value)} placeholder="30" /></Field>
        <Field label="Warranty terms" full><textarea className={cn(fieldClass, "min-h-24 resize-y")} value={warrantyTerms} onChange={(event) => setWarrantyTerms(event.target.value)} placeholder="Describe what is covered and any exclusions." /></Field>
      </section>
      <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6"><input type="checkbox" className="mt-1" checked={directBookingEnabled} onChange={(event) => setDirectBookingEnabled(event.target.checked)} /><span>Allow direct booking after this service is complete and published.</span></label>
      <div className="flex flex-wrap justify-end gap-3 border-t border-black/8 pt-6"><Link href="/professional/services" className={buttonVariants({ variant: "outline" })}>Cancel</Link><Button type="submit" variant="secondary" loading={saving}>Save draft <ArrowRight className="size-4" /></Button></div>
    </form>
  );
}

function Field({ label, children, full = false, required = false }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean }) {
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-2 block text-sm font-semibold">{label}{required ? <span className="text-danger"> *</span> : null}</span>{children}</label>;
}
