"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  ImageIcon,
  ImagePlus,
  MapPin,
  MoreHorizontal,
  Settings2,
  Share2,
  ShieldCheck,
  Tag,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { WorkspaceDrawer, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ManagedImageAsset, ProfessionalServiceSummary } from "@/modules/professional-services/types";
import { catalogueApi as api, uploadCatalogueImage } from "./catalogue-api";
import { SERVICE_IMAGE_ACCEPT, validateServiceImageFile } from "./service-catalogue";
import { ServiceEditor } from "./service-catalogue";

function priceLabel(service: ProfessionalServiceSummary) {
  if (service.pricingModel === "custom_quote") return "Custom quote";
  if (service.priceMinor === null) return "Price not set";
  const price = new Intl.NumberFormat("en-KE", { style: "currency", currency: service.currency, maximumFractionDigits: 0 }).format(service.priceMinor / 100);
  return service.pricingModel === "starting_from" ? `From ${price}` : price;
}

function durationLabel(minutes: number | null) {
  if (!minutes) return "Not set";
  return minutes < 60 ? `${minutes} min` : `${Number((minutes / 60).toFixed(1))} hours`;
}

function fulfilmentLabel(value: string | null) {
  if (value === "on_site") return "On-site";
  if (value === "remote") return "Remote";
  if (value === "hybrid") return "Hybrid";
  return "Not set";
}

function serviceTypeLabel(value: string | null) {
  if (!value) return "Not set";
  const map: Record<string, string> = {
    repairs_maintenance: "Repairs & maintenance",
    installation: "Installation",
    inspection: "Inspection",
    emergency: "Emergency",
    maintenance: "Maintenance",
  };
  return map[value] ?? value.replace(/_/g, " ");
}

const sectionTabs = ["Overview", "Pricing & booking", "Service areas", "Media", "Activity"] as const;

function readiness(service: ProfessionalServiceSummary, images: ManagedImageAsset[]) {
  const items: Array<{ label: string; done: boolean }> = [
    { label: "Service details", done: Boolean(service.category && service.description && service.fulfilmentModel) },
    { label: "Pricing configured", done: Boolean(service.pricingModel && (service.pricingModel === "custom_quote" || service.priceMinor !== null)) },
    { label: "Service areas added", done: service.serviceAreas.length > 0 || service.fulfilmentModel === "remote" },
    { label: "Booking setup complete", done: true },
    { label: "Warranty information", done: service.warrantyDurationDays !== null && service.warrantyDurationDays >= 0 },
    { label: "Images uploaded", done: images.length > 0 && images.some((i) => Boolean(i.imageUrl)) },
  ];
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  return { items, pct, done };
}

export function ProfessionalServiceDetailsPage({ serviceId }: { serviceId: string }) {
  const router = useRouter();
  const [service, setService] = useState<ProfessionalServiceSummary | null>(null);
  const [images, setImages] = useState<ManagedImageAsset[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof sectionTabs)[number]>("Overview");
  const [selectedImage, setSelectedImage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<ProfessionalServiceSummary>(`/api/v1/professional/services/${serviceId}`, { signal: controller.signal }),
      api<ManagedImageAsset[]>(`/api/v1/professional/services/${serviceId}/images`, { signal: controller.signal }),
    ])
      .then(([loaded, loadedImages]) => {
        if (!controller.signal.aborted) {
          setService(loaded);
          setImages(loadedImages);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load this service.");
      });
    return () => controller.abort();
  }, [serviceId]);

  const refresh = async () => {
    try {
      const [loaded, loadedImages] = await Promise.all([
        api<ProfessionalServiceSummary>(`/api/v1/professional/services/${serviceId}`),
        api<ManagedImageAsset[]>(`/api/v1/professional/services/${serviceId}/images`),
      ]);
      setService(loaded);
      setImages(loadedImages);
      setSelectedImage((prev) => Math.min(prev, Math.max(0, loadedImages.length - 1)));
    } catch {
      // keep existing state, surface via toast if needed
    }
  };

  if (error)
    return (
      <StatePanel variant="error" title="Service unavailable" description={error}>
        <Link href="/professional/services" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to services
        </Link>
      </StatePanel>
    );
  if (!service) return <DetailPageSkeleton />;

  const cover = images[selectedImage]?.imageUrl ?? images[0]?.imageUrl;
  const published = service.status === "published";
  const { items: readinessItems, pct } = readiness(service, images);
  const visibleThumbs = images.slice(0, 4);
  const overflow = images.length - 4;

  const config: ReadonlyArray<readonly [string, string, React.ElementType]> = [
    ["Category", service.category ?? "Not set", Tag],
    ["Fulfilment model", fulfilmentLabel(service.fulfilmentModel), MapPin],
    ["Service type", serviceTypeLabel(service.serviceType ?? null), Wrench],
    ["Skills required", service.requirements.length ? service.requirements.join(", ") : "Not set", Settings2],
    ["Starting price", priceLabel(service), Tag],
    ["Estimated duration", durationLabel(service.estimatedDurationMinutes), Clock3],
    ["Direct booking", service.directBookingEnabled ? "Enabled" : "Disabled", CalendarDays],
    ["Warranty", service.warrantyDurationDays ? `${service.warrantyDurationDays}-day workmanship warranty` : "Not offered", ShieldCheck],
  ] as const;

  const updatedAt = new Date(service.updatedAt);
  const updatedLabel = updatedAt.toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  async function handlePublish() {
    if (!service) return;
    const target = service;
    setBusy("publish");
    try {
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${target.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: target.version }),
      });
      setService(updated);
      toast.success("Service published");
    } catch (cause) {
      toast.error("Could not publish service", { description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleUnpublish() {
    if (!service) return;
    const target = service;
    setBusy("unpublish");
    try {
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${target.id}/unpublish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: target.version }),
      });
      setService(updated);
      toast.success("Service unpublished");
    } catch (cause) {
      toast.error("Could not unpublish service", { description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function ensureUnpublishedForEdit(): Promise<ProfessionalServiceSummary | null> {
    if (!service || service.status !== "published") return service;
    setBusy("unpublish");
    try {
      const updated = await api<ProfessionalServiceSummary>(`/api/v1/professional/services/${service.id}/unpublish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: service.version }),
      });
      setService(updated);
      toast.success("Service unpublished for editing");
      return updated;
    } catch (cause) {
      toast.error("Could not unpublish for editing", { description: cause instanceof Error ? cause.message : "Please try again." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function handleOpenEditor() {
    if (!service) return;
    if (service.status === "published") {
      const ok = await ensureUnpublishedForEdit();
      if (!ok) return;
    }
    setEditorOpen(true);
  }

  async function handleShare() {
    if (!service) return;
    const target = service;
    const url = typeof window !== "undefined" ? `${window.location.origin}/services/${target.slug}` : `/services/${target.slug}`;
    setShareBusy(true);
    try {
      if (navigator.share && published) {
        await navigator.share({ title: target.name, url });
        toast.success("Share sheet opened");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Service link copied");
      } else {
        toast.error("Sharing is not supported in this browser");
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      toast.error("Could not share link");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleDelete() {
    if (!service) return;
    const target = service;
    setBusy("delete");
    try {
      await api(`/api/v1/professional/services/${target.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version: target.version }),
      });
      toast.success("Service deleted");
      router.push("/professional/services");
      router.refresh();
    } catch (cause) {
      toast.error("Could not delete service", { description: cause instanceof Error ? cause.message : "Please try again." });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleDirectImageUpload(files: FileList | null) {
    if (!service || !files || files.length === 0) return;
    let currentService: ProfessionalServiceSummary | null = service;
    if (currentService.status === "published") {
      const unpublished = await ensureUnpublishedForEdit();
      if (!unpublished) {
        if (imageInputRef.current) imageInputRef.current.value = "";
        return;
      }
      currentService = unpublished;
    }
    if (images.length >= 6) {
      toast.error("You can add up to 6 images.");
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    const file = files[0];
    const validation = validateServiceImageFile(file);
    if (validation) {
      toast.error("Image not added", { description: validation });
      if (imageInputRef.current) imageInputRef.current.value = "";
      return;
    }
    setImageUploading(true);
    try {
      const assetId = await uploadCatalogueImage({
        file,
        purpose: "SERVICE_IMAGE",
        organisationId: currentService.organisationId,
      });
      const created = await api<ManagedImageAsset>(`/api/v1/professional/services/${currentService.id}/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      setImages((prev) => [...prev, created]);
      setSelectedImage(images.length);
      toast.success("Service image added");
    } catch (cause) {
      toast.error("Could not add service image", { description: cause instanceof Error ? cause.message : "Please try again." });
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1260px] space-y-5 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/professional/services" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Back to services
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="type-workspace-title">{service.name}</h1>
            <Badge variant={published ? "success" : "neutral"} className="text-[10px] font-semibold uppercase tracking-wide">
              {service.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {service.category ?? "Category not set"} <span className="mx-1">•</span> {fulfilmentLabel(service.fulfilmentModel)}
          </p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{service.description ?? "Complete the service description before publishing."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published ? (
            <Link href={`/services/${service.slug}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Eye className="size-4" />
              Preview public service
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled title="Publish the service to preview it">
              <Eye className="size-4" />
              Preview public service
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More service actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onSelect={() => void handleOpenEditor()}
                disabled={busy === "unpublish"}
              >
                <Edit3 className="size-4" /> Edit service
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleShare()} disabled={shareBusy}>
                <Share2 className="size-4" /> Share service link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/professional/bookings?serviceId=${encodeURIComponent(service.id)}`}>
                  <CalendarDays className="size-4" /> View bookings for this service
                </Link>
              </DropdownMenuItem>
              {published ? (
                <DropdownMenuItem onSelect={() => void handleUnpublish()} disabled={busy === "unpublish"}>
                  <EyeOff className="size-4" /> Unpublish service
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void handlePublish()} disabled={busy === "publish"}>
                  <Globe className="size-4" /> Publish service
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-danger focus:text-danger"
                onSelect={(e) => e.preventDefault()}
                disabled={published}
                title={published ? "Unpublish before deleting" : undefined}
              >
                <ConfirmDialog
                  title="Delete this service?"
                  description="This will permanently delete the draft service and its images. This cannot be undone."
                  confirmLabel="Delete service"
                  tone="danger"
                  onConfirm={() => void handleDelete()}
                  trigger={
                    <button className="flex w-full items-center gap-2 text-left" disabled={published || busy === "delete"}>
                      <Trash2 className="size-4" /> Delete service
                    </button>
                  }
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="min-w-0 space-y-4">
          <section className="relative overflow-hidden rounded-xl border border-black/8 bg-muted shadow-soft">
            <div className="relative aspect-[16/7] min-h-[280px] sm:min-h-[320px]">
              {cover ? (
                <Image src={cover} alt={service.name} fill priority className="object-cover" sizes="(max-width: 1024px) 100vw, 860px" />
              ) : (
                <div className="grid h-full place-items-center gap-3 bg-muted p-6 text-sm text-muted-foreground">
                  <div className="grid place-items-center gap-2">
                    <ImageIcon className="size-6" />
                    <span>No service image yet</span>
                  </div>
                  <input ref={imageInputRef} type="file" accept={SERVICE_IMAGE_ACCEPT} className="hidden" onChange={(e) => void handleDirectImageUpload(e.target.files)} />
                  <Button size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={imageUploading || busy === "unpublish"}>
                    <ImagePlus className="size-4" /> {imageUploading || busy === "unpublish" ? "Uploading…" : "Upload image"}
                  </Button>
                </div>
              )}
              {images.length > 1 ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous image"
                    className="absolute left-3 top-1/2 size-8 -translate-y-1/2 rounded-full border-white/50 bg-black/35 text-white backdrop-blur transition-colors hover:bg-accent hover:text-white active:translate-y-0 sm:left-4"
                    onClick={() => setSelectedImage((prev) => (prev - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next image"
                    className="absolute right-3 top-1/2 size-8 -translate-y-1/2 rounded-full border-white/50 bg-black/35 text-white backdrop-blur transition-colors hover:bg-accent hover:text-white active:translate-y-0 sm:right-4"
                    onClick={() => setSelectedImage((prev) => (prev + 1) % images.length)}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </>
              ) : null}
              {images.length ? (
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  {visibleThumbs.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImage(index)}
                      className={cn("relative size-12 overflow-hidden rounded-md border-2 shadow-sm transition", selectedImage === index ? "border-success ring-2 ring-success/30" : "border-white/85 hover:border-white")}
                      aria-label={`Show image ${index + 1}`}
                      aria-pressed={selectedImage === index}
                    >
                      {image.imageUrl ? <Image src={image.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
                    </button>
                  ))}
                  {overflow > 0 ? (
                    <span className="grid size-12 place-items-center rounded-md border-2 border-white/85 bg-black/55 text-xs font-semibold text-white backdrop-blur">+{overflow}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <Surface className="grid gap-3 rounded-xl p-4 sm:grid-cols-5">
            <Info icon={<Tag className="size-4" />} label="From" value={priceLabel(service)} />
            <Info icon={<Clock3 className="size-4" />} label="Estimated duration" value={durationLabel(service.estimatedDurationMinutes)} />
            <Info icon={<CalendarDays className="size-4" />} label="Direct booking" value={service.directBookingEnabled ? "Enabled" : "Disabled"} dot={service.directBookingEnabled} />
            <Info icon={<ShieldCheck className="size-4" />} label="Warranty" value={service.warrantyDurationDays ? `30-day warranty` : "Not offered"} fallback={service.warrantyDurationDays ? `${service.warrantyDurationDays} days` : undefined} />
            <Info icon={<MapPin className="size-4" />} label="Service areas" value={service.serviceAreas.length ? `${service.serviceAreas.length} service areas` : "No areas"} />
          </Surface>

          <div className="flex overflow-x-auto border-b border-border" aria-label="Service detail sections">
            {sectionTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "shrink-0 border-b-2 px-4 py-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success",
                  activeTab === tab ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab}
                {tab === "Media" ? ` (${images.length})` : ""}
              </button>
            ))}
          </div>

          {activeTab === "Overview" ? <Overview service={service} config={config} onEdit={() => void handleOpenEditor()} /> : null}
          {activeTab === "Pricing & booking" ? (
            <Surface className="rounded-xl p-5">
              <h2 className="text-base font-semibold">Pricing & booking</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Row label="Pricing" value={priceLabel(service)} />
                <Row label="Booking" value={service.directBookingEnabled ? "Clients can book directly" : "Direct booking is disabled"} />
                <Row label="Currency" value={service.currency} />
                <Row label="Estimated duration" value={durationLabel(service.estimatedDurationMinutes)} />
              </dl>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleOpenEditor()}>
                  <Edit3 className="size-4" /> Edit pricing
                </Button>
              </div>
            </Surface>
          ) : null}
          {activeTab === "Service areas" ? <Areas service={service} onEdit={() => void handleOpenEditor()} /> : null}
          {activeTab === "Media" ? <Media images={images} serviceName={service.name} /> : null}
          {activeTab === "Activity" ? (
            <Surface className="rounded-xl p-5">
              <h2 className="text-base font-semibold">Activity</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Last updated {updatedLabel}
                {service.updatedByName ? ` by ${service.updatedByName}` : ""}.
              </p>
              <div className="mt-6 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                Full audit timeline and history will appear here. For now, edits and publish transitions are recorded in the outbox and workspace history.
              </div>
            </Surface>
          ) : null}
        </main>

        <aside className="space-y-4">
          <Surface className="rounded-xl p-5">
            <h2 className="text-sm font-semibold">Publication</h2>
            <div className={cn("mt-3 flex gap-2.5 rounded-lg p-3", published ? "bg-success-soft text-success" : "bg-muted text-muted-foreground")}>
              <span className={cn("mt-1 size-2.5 shrink-0 rounded-full", published ? "bg-success" : "bg-muted-foreground")} aria-hidden />
              <div>
                <strong className="block text-sm font-semibold">{published ? "Published" : "Draft"}</strong>
                <span className="text-xs">{published ? "Visible in the marketplace" : "Only your team can see this service"}</span>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-xs">
              <p className="text-muted-foreground">Last updated</p>
              <p className="font-medium text-foreground">{updatedLabel}</p>
              {service.updatedByName ? (
                <p className="flex items-center gap-2 pt-1 text-muted-foreground">
                  {service.updatedByAvatarUrl ? (
                    <span className="relative size-5 overflow-hidden rounded-full bg-muted">
                      <Image src={service.updatedByAvatarUrl} alt={service.updatedByName} fill className="object-cover" sizes="20px" />
                    </span>
                  ) : (
                    <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {service.updatedByName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  Updated by {service.updatedByName}
                </p>
              ) : null}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Marketplace readiness</p>
                <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <span className="block h-full bg-success transition-all" style={{ width: `${pct}%` }} />
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {readinessItems.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <span className={cn("grid size-4 place-items-center rounded-full border", item.done ? "border-success bg-success text-white" : "border-border bg-white")}>
                      {item.done ? <Check className="size-3" /> : <X className="size-3 text-muted-foreground" />}
                    </span>
                    <span className={item.done ? "text-foreground" : ""}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              {published ? (
                <ConfirmDialog
                  title="Unpublish this service?"
                  description="Clients will no longer discover or book this service from the marketplace. Existing bookings are preserved."
                  confirmLabel="Unpublish service"
                  tone="danger"
                  onConfirm={() => void handleUnpublish()}
                  trigger={
                    <Button variant="outline" className="w-full justify-center gap-2 bg-danger-soft text-danger hover:bg-danger-soft hover:text-danger" loading={busy === "unpublish"}>
                      <EyeOff className="size-4" /> Unpublish service
                    </Button>
                  }
                />
              ) : (
                <Button className="w-full justify-center gap-2" onClick={() => void handlePublish()} loading={busy === "publish"}>
                  <Globe className="size-4" /> Publish service
                </Button>
              )}
            </div>
          </Surface>

          <Surface className="rounded-xl p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Service areas</h2>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => void handleOpenEditor()}>
                <Edit3 className="size-3.5" /> Edit
              </Button>
            </div>
            {service.serviceAreas.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {service.serviceAreas.map((area) => (
                  <Badge key={area} variant="success" className="gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-medium text-success">
                    <MapPin className="size-3" />
                    {area}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No service areas configured.</p>
            )}
            <div className="relative mt-3 overflow-hidden rounded-lg border border-black/8 bg-[#eaf5d8]">
              <div className="aspect-[16/9] w-full p-2">
                <div className="relative h-full w-full overflow-hidden rounded-md bg-[#f4f9e8]">
                  <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden>
                    <rect width="320" height="180" fill="#f4f9e8" />
                    <path d="M0 120 H320 M0 60 H320 M80 0 V180 M160 0 V180 M240 0 V180" stroke="#e6ecd8" strokeWidth="1" />
                    <path d="M70 30 L110 25 L135 45 L125 75 L95 90 L55 70 Z" fill="#cfe8a8" stroke="#b7d68a" strokeWidth="1.2" />
                    <path d="M120 85 L165 70 L195 95 L185 135 L130 140 L105 110 Z" fill="#d9ecb6" stroke="#b7d68a" strokeWidth="1.2" />
                    <path d="M175 25 L225 20 L250 40 L240 65 L190 70 L165 45 Z" fill="#e2f0c2" stroke="#b7d68a" strokeWidth="1.2" />
                    <text x="80" y="60" fontSize="9" fill="#5f8d11" fontWeight="600">Kilimani</text>
                    <text x="135" y="115" fontSize="9" fill="#5f8d11" fontWeight="600">Lavington</text>
                    <text x="190" y="45" fontSize="8" fill="#6b8a3a">Lavingtos</text>
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2 gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium shadow"
                onClick={() => {
                  if (!service.serviceAreas.length) {
                    toast.info("No service areas to view on map");
                    return;
                  }
                  const q = encodeURIComponent(service.serviceAreas.join(", "));
                  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, "_blank", "noreferrer");
                }}
              >
                View on map <ExternalLink className="size-3.5" />
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Coverage areas shown here are visible to clients when this service is published.</p>
          </Surface>

          <Surface className="rounded-xl p-5">
            <h2 className="text-sm font-semibold">Quick actions</h2>
            <div className="mt-3 grid gap-1">
              <Link href={`/professional/bookings?serviceId=${encodeURIComponent(service.id)}`} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm hover:bg-muted">
                <CalendarDays className="size-4 text-muted-foreground" /> View bookings for this service
              </Link>
              <button type="button" onClick={() => void handleShare()} disabled={shareBusy} className="flex items-center gap-2.5 rounded-md px-2 py-2.5 text-left text-sm hover:bg-muted disabled:opacity-60">
                <Share2 className="size-4 text-muted-foreground" /> Share service link
              </button>
              <ConfirmDialog
                title="Delete this service?"
                description={published ? "Unpublish the service before deleting it." : "This will permanently delete this service."}
                confirmLabel="Delete service"
                tone="danger"
                onConfirm={() => void handleDelete()}
                trigger={
                  <button type="button" disabled={published || busy === "delete"} title={published ? "Unpublish before deleting" : undefined} className="flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-left text-sm text-danger hover:bg-danger-soft disabled:opacity-50">
                    <Trash2 className="size-4" /> Delete service
                  </button>
                }
              />
            </div>
          </Surface>
        </aside>
      </div>

      {editorOpen ? (
        <WorkspaceDrawer onClose={() => setEditorOpen(false)} aria-describedby="service-editor-description">
          <header className="shrink-0 border-b border-border px-6 py-5 pr-16">
            <SheetTitle className="text-xl font-semibold">Edit service</SheetTitle>
            <SheetDescription id="service-editor-description" className="mt-1 text-xs text-muted-foreground">Manage service details, pricing, coverage and publication.</SheetDescription>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <ServiceEditor
              key={service.id}
              serviceId={service.id}
              embedded
              onSaved={async () => {
                await refresh();
                toast.success("Service updated");
              }}
            />
          </div>
        </WorkspaceDrawer>
      ) : null}
    </div>
  );
}

function Info({
  icon,
  label,
  value,
  dot,
  fallback,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  dot?: boolean;
  fallback?: string;
}) {
  return (
    <div className="flex gap-2.5 border-border py-1 sm:border-r sm:pr-3 sm:py-0 last:border-0 last:pr-0">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold">
          {dot ? <span className="size-2 rounded-full bg-success" aria-hidden /> : null}
          <span className="truncate">{fallback ?? value}</span>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function Areas({ service, onEdit }: { service: ProfessionalServiceSummary; onEdit?: () => void }) {
  return (
    <Surface className="rounded-xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Service areas</h2>
        {onEdit ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
            <MapPin className="size-3.5" /> Edit
          </Button>
        ) : null}
      </div>
      {service.serviceAreas.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {service.serviceAreas.map((area) => (
            <Badge key={area} variant="success" className="gap-1 text-[10px]">
              <MapPin className="size-3" />
              {area}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No service areas configured.</p>
      )}
      {!onEdit ? <p className="mt-4 text-xs text-muted-foreground">Coverage areas shown here are visible to clients when this service is published.</p> : null}
    </Surface>
  );
}

function Media({ images, serviceName }: { images: ManagedImageAsset[]; serviceName: string }) {
  return (
    <Surface className="rounded-xl p-5">
      <h2 className="text-base font-semibold">Media</h2>
      {images.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              {image.imageUrl ? <Image src={image.imageUrl} alt={`${serviceName}, image ${index + 1}`} fill sizes="240px" className="object-cover" /> : <ImageIcon className="m-4 size-5 text-muted-foreground" />}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No service images added yet.</p>
      )}
    </Surface>
  );
}

function Overview({
  service,
  config,
  onEdit,
}: {
  service: ProfessionalServiceSummary;
  config: readonly (readonly [string, string, React.ElementType])[];
  onEdit: () => void;
}) {
  return (
    <Surface id="overview" className="overflow-hidden rounded-xl">
      <section className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-muted-foreground" /> About this service
          </h2>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onEdit}>
            <Edit3 className="size-3.5" /> Edit
          </Button>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description ?? "No description added yet."}</p>
      </section>

      <section className="border-t border-border p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="size-4 text-muted-foreground" /> Service configuration
          </h2>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onEdit}>
            <Edit3 className="size-3.5" /> Edit
          </Button>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {config.map(([label, value, Icon]) => (
            <div key={label} className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-2">
              <Icon className="mt-0.5 size-4 text-muted-foreground" />
              <div>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                  {label === "Direct booking" && value === "Enabled" ? <span className="size-2 rounded-full bg-success" aria-hidden /> : null}
                  <span className="capitalize">{value}</span>
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid border-t border-border sm:grid-cols-2 sm:divide-x sm:divide-border">
        <div className="p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-success" /> What&apos;s included
          </h2>
          {service.includedItems.length ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {service.includedItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No included items added yet.</p>
          )}
        </div>
        <div className="p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <X className="size-4 text-danger" /> What&apos;s excluded
          </h2>
          {service.excludedItems.length ? (
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {service.excludedItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <X className="mt-0.5 size-4 shrink-0 text-danger" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No excluded items added yet.</p>
          )}
        </div>
      </section>

      <section className="border-t border-border p-5">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-muted-foreground" /> Client requirements
        </h2>
        {service.requirements.length ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {service.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No client requirements added.</p>
        )}
      </section>
    </Surface>
  );
}
