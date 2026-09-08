"use client";

import { ArrowRight, BadgeCheck, CalendarDays, Clock3, ExternalLink, EyeOff, Globe, ImageIcon, MapPin, MoreHorizontal, Plus, Search, ShieldCheck, TriangleAlert, Wrench, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ServiceCard, ServiceCardSkeleton } from "@/components/marketplace/service-card";
import { WorkspaceMetricCard } from "@/components/workspace/workspace-metric-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { WorkspaceDrawer, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useWorkspaceShell } from "@/components/workspace/workspace-shell-context";
import { getCachedResource, setCachedResource } from "@/lib/client-resource-cache";
import { cn } from "@/lib/utils";
import type { ManagedImageAsset, ProfessionalServiceSummary, ServiceStatus } from "@/modules/professional-services/types";
import { catalogueApi as api } from "./catalogue-api";

import { CreateServiceForm, ServiceEditor } from "./service-catalogue";

type Service = ProfessionalServiceSummary;
type ImageState = { images?: ManagedImageAsset[]; error?: string };
const controlClass = "min-h-11 rounded-xl border border-border bg-white px-3 text-xs";
const tabs = [["all", "All"], ["published", "Published"], ["draft", "Drafts"], ["unpublished", "Unpublished"]] as const;

function priceLabel(service: Service) {
  if (service.pricingModel === "custom_quote") return "Custom quote";
  if (!service.pricingModel || service.priceMinor === null) return "Price not set";
  const amount = new Intl.NumberFormat("en-KE", { style: "currency", currency: service.currency, maximumFractionDigits: 2 }).format(service.priceMinor / 100);
  return service.pricingModel === "starting_from" ? `From ${amount}` : amount;
}

function durationLabel(minutes: number | null) {
  if (!minutes) return "Duration not set";
  return minutes < 60 ? `${minutes} min` : `${Number((minutes / 60).toFixed(1))} hrs`;
}

function fulfilmentLabel(service: Service) {
  return service.fulfilmentModel === "on_site" ? "On-site" : service.fulfilmentModel === "remote" ? "Remote" : service.fulfilmentModel === "hybrid" ? "Hybrid" : "Delivery not set";
}

function attentionReason(service: Service, images?: ImageState) {
  if (service.status === "published") return null;
  if (!service.category || !service.description || !service.fulfilmentModel || !service.pricingModel || (service.pricingModel !== "custom_quote" && service.priceMinor === null)) return "Complete service details";
  if (!service.serviceAreas.length && service.fulfilmentModel !== "remote") return "No service area configured";
  if (images?.images && !images.images.some((image) => image.imageUrl)) return "Missing marketplace image";
  return null;
}

function ServiceStatusBadge({ service }: { service: Service }) {
  return <Badge variant={service.status === "published" ? "success" : "neutral"} className="text-[10px] font-semibold uppercase">{service.status}</Badge>;
}

function ServicePhoto({ service, state, large = false }: { service: Service; state?: ImageState; large?: boolean }) {
  const url = state?.images?.find((image) => image.imageUrl)?.imageUrl;
  return <div className={cn("relative overflow-hidden bg-muted", large ? "aspect-[2.4/1] rounded-lg" : "min-h-[150px] sm:aspect-[16/9] sm:min-h-0")}>
    {!state ? <Skeleton className="absolute inset-0 rounded-none" /> : url ? <Image src={url} alt={service.name} fill className="object-cover" sizes={large ? "440px" : "(max-width: 640px) 100vw, 33vw"} /> : <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground"><ImageIcon className="size-5" />{state.error ? "Image unavailable" : "No service image"}</div>}
    <span className="absolute left-2.5 top-2.5"><ServiceStatusBadge service={service} /></span>
  </div>;
}

export function ServiceCardsSkeleton() {
  return <div className="grid grid-cols-1 gap-3 @min-[520px]:grid-cols-2 @min-[790px]:grid-cols-3" role="status" aria-label="Loading services" aria-busy="true">
    {Array.from({ length: 6 }, (_, index) => <ServiceCardSkeleton key={index} />)}
  </div>;
}

export function MyServicesPage({ initialEditor = null }: { initialEditor?: string | null } = {}) {
  const { workspaceId, userId } = useWorkspaceShell();
  return <ServicesWorkspace key={`${userId}:${workspaceId}`} cacheKey={`${userId}:${workspaceId}:list`} initialEditor={initialEditor} />;
}

function ServicesWorkspace({ cacheKey, initialEditor }: { cacheKey: string; initialEditor: string | null }) {
  const [services, setServices] = useState<Service[]>(() => getCachedResource<Service[]>("professional-services", cacheKey) ?? []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [images, setImages] = useState<Record<string, ImageState>>({});
  const [status, setStatus] = useState<"all" | ServiceStatus>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("updated");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<string | null>(initialEditor);
  const [busy, setBusy] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void api<Service[]>("/api/v1/professional/services", { signal: controller.signal }).then((items) => {
      if (controller.signal.aborted) return;
      setServices(items); setCachedResource("professional-services", cacheKey, items); setError(null);
      // Image reads are independent: service content is usable before photography arrives.
      void (async () => {
        for (let offset = 0; offset < items.length && !controller.signal.aborted; offset += 4) {
          await Promise.allSettled(items.slice(offset, offset + 4).map(async (service) => {
            try {
              const loaded = await api<ManagedImageAsset[]>(`/api/v1/professional/services/${service.id}/images`, { signal: controller.signal });
              if (!controller.signal.aborted) setImages((current) => ({ ...current, [service.id]: { images: loaded } }));
            } catch {
              if (!controller.signal.aborted) setImages((current) => ({ ...current, [service.id]: { error: "Service images could not be loaded." } }));
            }
          }));
        }
      })();
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load services.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [cacheKey, reload]);

  const initialLoading = loading && services.length === 0;
  const attention = services.filter((service) => attentionReason(service, images[service.id]));
  const selected = services.find((service) => service.id === selectedId);
  const visible = services.filter((service) => (status === "all" || service.status === status)
    && (!category || service.category === category)
    && (!attentionOnly || attentionReason(service, images[service.id]))
    && `${service.name} ${service.category ?? ""} ${service.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "price" ? (a.priceMinor ?? Infinity) - (b.priceMinor ?? Infinity) : b.updatedAt.localeCompare(a.updatedAt));

  function openService(service: Service) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(service.id);
  }
  function closeEditor() {
    setEditor(null);
    setReload((value) => value + 1);
    const url = new URL(window.location.href);
    if (url.searchParams.has("editor")) {
      url.searchParams.delete("editor");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }
  function openEditor(id: string) {
    setSelectedId(null);
    setEditor(id);
  }
  function closeService() {
    setSelectedId(null);
    returnFocus.current?.focus();
  }
  async function unpublish(service: Service) {
    setBusy(service.id);
    try {
      const updated = await api<Service>(`/api/v1/professional/services/${service.id}/unpublish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: service.version }) });
      setServices((current) => {
        const next = current.map((item) => item.id === updated.id ? updated : item);
        setCachedResource("professional-services", cacheKey, next);
        return next;
      });
      toast.success("Service unpublished");
    } catch (cause) {
      toast.error("Couldn’t unpublish service", { description: cause instanceof Error ? cause.message : "Please try again." });
      setReload((value) => value + 1);
    } finally { setBusy(null); }
  }

  return <div className="min-w-0">
    <div className="@container min-w-0 space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-semibold text-success">Professional workspace</p><h1 className="mt-1 type-workspace-title">Services</h1><p className="mt-1 text-sm text-muted-foreground">Manage what clients can discover and book from your business.</p></div>
        <Button onClick={() => openEditor("new")} className="rounded-lg shadow-none"><Plus className="size-4" />Add service</Button>
      </header>
      {error ? <InlineAlert title="Services could not be refreshed" description={error}><Button variant="outline" size="sm" onClick={() => { setLoading(true); setReload((value) => value + 1); }}>Try again</Button></InlineAlert> : null}
      {!dismissed && attention.length > 0 ? <Surface className="flex flex-wrap items-center gap-3 rounded-xl border-success/15 bg-success-soft/40 p-4 shadow-none">
        <Globe className="size-6 shrink-0 text-success" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{attention.length} {attention.length === 1 ? "service needs" : "services need"} attention</h2><p className="mt-1 text-xs text-muted-foreground">Complete missing details to publish and reach more clients.</p></div>
        <div className="hidden gap-4 @min-[900px]:flex">{attention.slice(0, 2).map((service) => <button key={service.id} onClick={() => openService(service)} className="max-w-40 text-left text-[10px]"><span className="block truncate font-semibold">{service.name}</span><span className="mt-1 flex items-center gap-1 text-muted-foreground"><TriangleAlert className="size-3 shrink-0 text-warning" />{attentionReason(service, images[service.id])}</span></button>)}</div>
        <Button variant="ghost" size="sm" className="text-xs text-success" onClick={() => { setAttentionOnly(true); setStatus("all"); setCategory(""); setSearch(""); }}>Review services <ArrowRight className="size-3" /></Button>
        <Button variant="ghost" size="icon" aria-label="Dismiss service attention notice" onClick={() => setDismissed(true)}><X className="size-4" /></Button>
      </Surface> : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <WorkspaceMetricCard icon={Wrench} tone="purple" label="Total services" value={error && !services.length ? "Unavailable" : services.length} loading={initialLoading} />
        <WorkspaceMetricCard icon={Globe} tone="green" label="Published" value={error && !services.length ? "Unavailable" : services.filter((service) => service.status === "published").length} loading={initialLoading} />
        <WorkspaceMetricCard icon={ImageIcon} tone="orange" label="Drafts" value={error && !services.length ? "Unavailable" : services.filter((service) => service.status === "draft").length} loading={initialLoading} />
        <WorkspaceMetricCard icon={CalendarDays} tone="blue" label="Direct-bookable" value={error && !services.length ? "Unavailable" : services.filter((service) => service.status === "published" && service.directBookingEnabled).length} loading={initialLoading} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" aria-label="Service status filters">{tabs.map(([value, label]) => <Button key={value} variant="outline" size="sm" aria-pressed={status === value} className={cn("px-3 text-xs shadow-none", status === value && "border-success bg-success-soft")} onClick={() => setStatus(value)}>{label}{!initialLoading && (!error || services.length > 0) ? ` (${value === "all" ? services.length : services.filter((service) => service.status === value).length})` : ""}</Button>)}</div>
        <div className="flex w-full flex-wrap items-center gap-2 @min-[1000px]:w-auto">
          <div className="relative min-w-40 flex-1"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input aria-label="Search services" placeholder="Search services…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 rounded-xl pl-9 text-xs" /></div>
          <select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)} className={cn(controlClass, "max-w-44")}><option value="">Category</option>{[...new Set(services.map((service) => service.category).filter(Boolean))].sort().map((value) => <option key={value} value={value!}>{value}</option>)}</select>
          <select aria-label="Sort services" value={sort} onChange={(event) => setSort(event.target.value)} className={controlClass}><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="price">Price: low to high</option></select>
        </div>
      </div>
      {attentionOnly ? <Button size="sm" variant="outline" onClick={() => setAttentionOnly(false)}>Needs attention <X className="size-3" /></Button> : null}
      {initialLoading ? <ServiceCardsSkeleton /> : services.length === 0 && !error ? <StatePanel title="No services yet" description="Create your first service as a private draft. Publish it when the details are ready." icon={<Wrench className="size-5" />}><Button size="sm" onClick={() => openEditor("new")}>Create first service</Button></StatePanel> : visible.length === 0 && services.length > 0 ? <StatePanel title="No services match these filters" description="Try another search or clear your filters."><Button variant="outline" onClick={() => { setSearch(""); setCategory(""); setStatus("all"); setAttentionOnly(false); }}>Clear filters</Button></StatePanel> : <div className="grid grid-cols-1 gap-3 @min-[520px]:grid-cols-2 @min-[790px]:grid-cols-3">
        {visible.map((service) => <ServiceCard key={service.id}
          selected={selectedId === service.id}
          onOpen={() => openService(service)}
          image={<ServicePhoto service={service} state={images[service.id]} />}
          title={<button className="text-left hover:underline" onClick={() => openService(service)}>{service.name}</button>}
          action={<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="absolute right-2.5 top-2.5 z-20 size-8 min-h-8 bg-white" aria-label={`Actions for ${service.name}`}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link href={`/professional/services/${service.id}`}>View details</Link></DropdownMenuItem><DropdownMenuItem onSelect={() => openEditor(service.id)}>Edit service</DropdownMenuItem>{service.status === "published" ? <DropdownMenuItem asChild><Link href={`/services/${service.slug}`}>Preview public service</Link></DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu>}
          footer={<><div><p className="text-[0.58rem] text-muted-foreground">Pricing</p><p className="text-sm font-semibold">{priceLabel(service)}</p></div>{service.status === "published" ? <Button size="icon" className="size-8 min-h-8 shrink-0" aria-label="View service" onClick={() => openService(service)}><ArrowRight className="size-4" /></Button> : <Button onClick={() => openEditor(service.id)} aria-label="Continue setup" size="icon" className="size-8 min-h-8 shrink-0"><ArrowRight className="size-4" /></Button>}</>}
        >
          <p className="mt-1 text-[0.72rem] text-muted-foreground">{service.category || "Category not set"} &middot; {fulfilmentLabel(service)}</p>
          <p className="mt-1 line-clamp-2 text-[0.72rem] leading-5 text-muted-foreground">{service.description || "Add a description before publishing this service."}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-muted-foreground"><Clock3 className="size-3" />{durationLabel(service.estimatedDurationMinutes)}</p>
          <div className="my-2 flex flex-wrap gap-3 text-[0.68rem]"><span className={cn("flex items-center gap-1", service.directBookingEnabled ? "text-success" : "text-muted-foreground")}><BadgeCheck className="size-3" />{service.directBookingEnabled ? "Direct booking" : "Direct booking off"}</span><span className={cn("flex items-center gap-1", service.warrantyDurationDays ? "text-success" : "text-muted-foreground")}><ShieldCheck className="size-3" />{service.warrantyDurationDays ? "Warranty" : "No warranty"}</span></div>
        </ServiceCard>)}
      </div>}
    </div>
    {editor ? <WorkspaceDrawer onClose={closeEditor} aria-describedby="service-editor-description">
      <header className="shrink-0 border-b border-border px-6 py-5 pr-16"><SheetTitle className="text-xl font-semibold">{editor === "new" ? "Add service" : "Edit service"}</SheetTitle><SheetDescription id="service-editor-description" className="mt-1 text-xs text-muted-foreground">Manage service details, pricing, coverage and publication.</SheetDescription></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{editor === "new" ? <CreateServiceForm embedded onCancel={closeEditor} onCreated={(created) => { setReload((value) => value + 1); setEditor(created.id); }} /> : <ServiceEditor key={editor} serviceId={editor} embedded onSaved={() => setReload((value) => value + 1)} />}</div>
    </WorkspaceDrawer> : null}
    {selected ? <ServiceInspection key={selected.id} service={selected} images={images[selected.id]} onClose={closeService} onUnpublish={() => void unpublish(selected)} busy={busy === selected.id} onEdit={() => openEditor(selected.id)} /> : null}
  </div>;
}

function ServiceInspection({ service, images, onClose, onUnpublish, busy, onEdit }: { service: Service; images?: ImageState; onClose: () => void; onUnpublish: () => void; busy: boolean; onEdit: () => void }) {
  const [tab, setTab] = useState("Overview");
  const content = <>
    <ServicePhoto service={service} state={images} large />

    <div className="mt-5 flex gap-1 border-b border-border" aria-label="Service detail sections">{["Overview", "Images", "Service areas", "Settings"].map((name) => <Button key={name} variant="ghost" size="sm" aria-pressed={tab === name} className={cn("flex-1 rounded-none border-0 border-b-2 px-1 text-[11px] shadow-none", tab === name ? "border-success" : "border-transparent text-muted-foreground")} onClick={() => setTab(name)}>{name}{name === "Images" && images?.images ? ` (${images.images.length})` : ""}</Button>)}</div>
    <div className="space-y-5 py-5 text-xs leading-5">
      {tab === "Overview" ? <><section><h3 className="mb-3 text-sm font-semibold">Service information</h3><dl className="space-y-4">{[["Marketplace visibility", service.status === "published" ? "Visible in marketplace" : "Not visible in marketplace"], ["Pricing", priceLabel(service)], ["Duration", durationLabel(service.estimatedDurationMinutes)], ["Booking", service.directBookingEnabled ? "Direct booking enabled" : "Direct booking disabled"], ["Warranty", service.warrantyDurationDays ? `${service.warrantyDurationDays}-day workmanship warranty` : "No warranty offered"]].map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>)}</dl></section><section className="border-t border-border pt-4"><h3 className="mb-1 text-sm font-semibold">Description</h3><p className="whitespace-pre-line text-muted-foreground">{service.description || "No description added yet."}</p></section></> : null}
      {tab === "Overview" || tab === "Service areas" ? <section className={cn(tab === "Overview" && "border-t border-border pt-4")}><h3 className="mb-3 text-sm font-semibold">Service areas</h3><div className="flex flex-wrap items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{service.serviceAreas.length ? service.serviceAreas.map((area) => <Badge key={area} variant="success" className="text-[10px]">{area}</Badge>) : <p className="text-muted-foreground">No service areas configured.</p>}</div></section> : null}
      {tab === "Images" ? <section><h3 className="mb-3 text-sm font-semibold">Service images</h3>{!images ? <Skeleton className="aspect-video w-full" /> : images.error ? <InlineAlert title="Images unavailable" description={images.error} /> : images.images?.length ? <div className="grid grid-cols-2 gap-3">{images.images.map((image, index) => <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted">{image.imageUrl ? <Image src={image.imageUrl} alt={`${service.name}, image ${index + 1}`} fill sizes="200px" className="object-cover" /> : <span className="p-3">Image unavailable</span>}</div>)}</div> : <p className="text-muted-foreground">No service images added yet.</p>}<Button variant="ghost" onClick={onEdit}>Manage images <ArrowRight className="size-4" /></Button></section> : null}
      {tab === "Settings" ? <section className="space-y-4"><h3 className="text-sm font-semibold">Booking and warranty settings</h3><p>{service.directBookingEnabled ? "Clients can book this service directly when it is published and availability is configured." : "Direct booking is disabled."}</p><p>{service.warrantyTerms || "No warranty terms added."}</p><h3 className="text-sm font-semibold">Client requirements</h3>{service.requirements.length ? <ul className="list-disc space-y-1 pl-4">{service.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ul> : <p className="text-muted-foreground">No client requirements added.</p>}<p className="text-muted-foreground">{service.status === "published" ? "Unpublish the service before editing its details." : "Continue setup to change these settings."}</p><Button variant="ghost" onClick={onEdit}>Manage settings <ArrowRight className="size-4" /></Button></section> : null}
    </div>
    {service.status === "published" ? <Link href={`/services/${service.slug}`} className="flex items-center gap-3 rounded-lg border border-success/15 bg-success-soft/50 p-4"><Globe className="size-6 shrink-0 text-success" /><span className="min-w-0 flex-1"><strong className="block text-xs font-semibold">Preview public service</strong><span className="mt-1 block text-[11px] text-muted-foreground">See how this service appears to clients in the marketplace.</span></span><ExternalLink className="size-4 shrink-0 text-success" /></Link> : null}

  </>;
  return <WorkspaceDrawer onClose={onClose} aria-describedby="service-drawer-description" onCloseAutoFocus={(event) => { event.preventDefault(); onClose(); }}>
    <header className="shrink-0 border-b border-black/7 px-5 pb-4 pt-5 pr-16 sm:px-6 sm:pr-16 sm:pt-6">
      <div className="flex items-center gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#edf7dd] text-[#5f8d11]"><Wrench className="size-5" /></span><div className="min-w-0"><SheetTitle className="truncate text-xl font-semibold tracking-title">{service.name}</SheetTitle><SheetDescription id="service-drawer-description" className="mt-1 text-xs text-muted-foreground">{service.category || "Category not set"} &middot; {fulfilmentLabel(service)}</SheetDescription></div></div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfcfd] px-4 py-4 sm:px-5">{content}</div>
    <footer className="shrink-0 border-t border-black/7 bg-white px-5 py-4 sm:px-6" aria-label="Service actions">
      <div className="grid grid-cols-2 gap-2"><Link href={`/professional/services/${service.id}`} className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>View details</Link><Button onClick={onEdit} variant="outline" className="w-full">Edit service</Button></div>
    <div className="mt-4 flex flex-wrap gap-2">{service.status === "published" ? <ConfirmDialog title="Unpublish this service?" description="Clients will no longer discover or book this service from the marketplace. Existing bookings are preserved." confirmLabel="Unpublish service" tone="danger" onConfirm={onUnpublish} trigger={<Button variant="ghost" size="sm" loading={busy} className="flex-1 rounded-lg bg-danger-soft text-xs text-danger"><EyeOff className="size-4" />Unpublish service</Button>} /> : null}<Link href={`/professional/bookings?serviceId=${encodeURIComponent(service.id)}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "flex-1 rounded-lg bg-muted text-xs")}><CalendarDays className="size-4" />View bookings</Link></div>
    </footer>
  </WorkspaceDrawer>;
}
