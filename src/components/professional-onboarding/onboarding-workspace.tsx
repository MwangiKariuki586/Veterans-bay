"use client";

import {
  ArrowRight,
  Building2,
  Check,
  Clock3,
  FileCheck2,
  MapPin,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { pageBackdropClass, pageFrameClass } from "@/components/public/design";
import { SiteHeader } from "@/components/public/site-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { OnboardingSummary } from "@/modules/professional-onboarding/types";

type PageMode = "edit" | "review" | "settings";

const defaultHours = {
  monday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
  tuesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
  wednesday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
  thursday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
  friday: { enabled: true, opensAt: "08:00", closesAt: "17:00" },
  saturday: { enabled: false, opensAt: "09:00", closesAt: "14:00" },
  sunday: { enabled: false, opensAt: "09:00", closesAt: "14:00" },
};

const fieldClass =
  "min-h-12 w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm outline-none focus:border-[#071522]/35";

const statusCopy: Record<
  string,
  { title: string; description: string; tone: "info" | "success" | "warning" | "error" }
> = {
  pending_review: {
    title: "Your profile is being reviewed",
    description:
      "Your saved application and evidence are locked while the Veterans Bay team reviews them.",
    tone: "info",
  },
  active: {
    title: "Your professional organisation is approved",
    description:
      "Verification and service quality are separate. Keep your business information accurate before publishing services.",
    tone: "success",
  },
  requires_changes: {
    title: "Changes are required",
    description:
      "Review the decision history, update the requested information, and submit again.",
    tone: "warning",
  },
  suspended: {
    title: "This organisation is suspended",
    description: "You cannot accept new work while the suspension is active.",
    tone: "error",
  },
  deactivated: {
    title: "This organisation is deactivated",
    description: "The professional profile is no longer operational.",
    tone: "error",
  },
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const body = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || body.data === undefined) {
    throw new Error(body.error?.message ?? body.error?.code ?? "Request failed.");
  }
  return body.data;
}

export function OnboardingWorkspace({ mode }: { mode: PageMode }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [record, setRecord] = useState<OnboardingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "evidence" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [operatingLocation, setOperatingLocation] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [verificationType, setVerificationType] = useState("");
  const [verificationReference, setVerificationReference] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [workingHours, setWorkingHours] = useState(defaultHours);

  useEffect(() => {
    if (sessionPending) return;
    if (!session) {
      router.replace("/login?redirect=/professional/onboarding");
      return;
    }
    void api<OnboardingSummary | null>("/api/v1/professional/onboarding")
      .then((data) => {
        setRecord(data);
        if (!data) return;
        setName(data.name);
        setBusinessType(data.businessType ?? "");
        setPrimaryCategory(data.primaryCategory ?? "");
        setDescription(data.description ?? "");
        setPhone(data.phone ?? "");
        setEmail(data.email ?? "");
        setOperatingLocation(data.operatingLocation ?? "");
        setServiceAreas(data.serviceAreas.join(", "));
        setVerificationType(data.verificationType ?? "");
        setVerificationReference(data.verificationReference ?? "");
        setTermsAccepted(data.termsAccepted);
        if (Object.keys(data.workingHours).length > 0) {
          setWorkingHours(data.workingHours as typeof defaultHours);
        }
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Unable to load onboarding."),
      )
      .finally(() => setLoading(false));
  }, [router, session, sessionPending]);

  const editable = !record || ["draft", "requires_changes", "active"].includes(record.status);
  const progress = record
    ? Math.round((record.readiness.completedCount / record.readiness.totalCount) * 100)
    : 0;
  const pageTitle =
    mode === "review"
      ? "Review your application"
      : mode === "settings"
        ? "Business profile"
        : "Set up your professional profile";

  async function start(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<OnboardingSummary>("/api/v1/professional/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await api(`/api/v1/workspaces/select`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId: `organisation:${created.organisationId}` }),
      });
      setRecord(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start onboarding.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!record) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await api<OnboardingSummary>("/api/v1/professional/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          businessType: businessType || null,
          primaryCategory: primaryCategory || null,
          description: description || null,
          phone: phone || null,
          email: email || null,
          operatingLocation: operatingLocation || null,
          serviceAreas: serviceAreas
            .split(",")
            .map((area) => area.trim())
            .filter(Boolean),
          workingHours,
          verificationType: verificationType || null,
          verificationReference: verificationReference || null,
          termsAccepted,
        }),
      });
      setRecord(updated);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save your draft.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAsset(file: File, kind: "logo" | "verification_document") {
    if (!record) return;
    setUploading(kind === "logo" ? "logo" : "evidence");
    setError(null);
    try {
      const purpose = kind === "logo" ? "PROFESSIONAL_LOGO" : "VERIFICATION_DOCUMENT";
      const intent = await api<{
        assetId: string;
        authorization: {
          uploadUrl: string;
          apiKey: string;
          timestamp: number;
          signature: string;
          folder: string;
          publicId: string;
          type: string;
        };
      }>("/api/v1/storage/upload-intent", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-workspace-id": `organisation:${record.organisationId}`,
        },
        body: JSON.stringify({
          purpose,
          mimeType: file.type,
          sizeBytes: file.size,
          organisationId: record.organisationId,
        }),
      });
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", intent.authorization.apiKey);
      form.append("timestamp", String(intent.authorization.timestamp));
      form.append("signature", intent.authorization.signature);
      form.append("folder", intent.authorization.folder);
      form.append("public_id", intent.authorization.publicId);
      form.append("type", intent.authorization.type);
      const cloudinaryResponse = await fetch(intent.authorization.uploadUrl, {
        method: "POST",
        body: form,
      });
      const providerBody = (await cloudinaryResponse.json()) as { public_id?: string; error?: { message?: string } };
      if (!cloudinaryResponse.ok || !providerBody.public_id) {
        throw new Error(providerBody.error?.message ?? "The file upload failed.");
      }
      await api(`/api/v1/storage/assets/${intent.assetId}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicId: providerBody.public_id }),
      });
      const updated = await api<OnboardingSummary>(
        "/api/v1/professional/onboarding/assets",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            assetId: intent.assetId,
            kind,
            ...(kind === "verification_document"
              ? { documentType: verificationType || "identity or registration evidence" }
              : {}),
          }),
        },
      );
      setRecord(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload the file.");
    } finally {
      setUploading(null);
    }
  }

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api<OnboardingSummary>(
        "/api/v1/professional/onboarding/submit",
        { method: "POST" },
      );
      setRecord(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit the application.");
    } finally {
      setSaving(false);
    }
  }

  const steps = useMemo(
    () => [
      { label: "Business details", done: Boolean(record?.businessType && record.primaryCategory) },
      { label: "Location & hours", done: Boolean(record?.operatingLocation && record.serviceAreas.length) },
      { label: "Identity & evidence", done: Boolean(record?.verificationReference && record.documents.length) },
      { label: "Terms & review", done: Boolean(record?.termsAccepted) },
    ],
    [record],
  );

  return (
    <div className={pageBackdropClass}>
      <div className={pageFrameClass()}>
        <SiteHeader />
        <main className="mt-5 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Surface className="h-fit p-5 lg:sticky lg:top-5">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-[#eef8c8] text-[#5f8d11]">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-xs text-[#68717b]">Professional onboarding</p>
                <p className="font-bold">{record?.name || "New organisation"}</p>
              </div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#edf1f3]">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-[#68717b]">{progress}% ready for review</p>
            <ol className="mt-6 space-y-4">
              {steps.map((step, index) => (
                <li key={step.label} className="flex items-center gap-3 text-sm">
                  <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", step.done ? "bg-primary text-[#071522]" : "bg-[#edf1f3] text-[#68717b]")}>{step.done ? <Check className="size-4" /> : index + 1}</span>
                  {step.label}
                </li>
              ))}
            </ol>
            {record ? (
              <div className="mt-7 grid gap-2">
                <Link href="/professional/onboarding" className={cn(buttonVariants({ variant: mode === "edit" ? "secondary" : "ghost", size: "sm" }), "justify-start")}>Edit application</Link>
                <Link href="/professional/onboarding/review" className={cn(buttonVariants({ variant: mode === "review" ? "secondary" : "ghost", size: "sm" }), "justify-start")}>Review & submit</Link>
              </div>
            ) : null}
          </Surface>

          <Surface className="overflow-hidden p-6 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5f8d11]">Trusted. Skilled. Reliable.</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68717b]">Save your progress at any time. Private verification evidence is visible only to authorised reviewers.</p>

            {error ? <InlineAlert className="mt-6" variant="error" title="Action unsuccessful" description={error} /> : null}
            {saved ? <InlineAlert className="mt-6" variant="success" title="Draft saved" description="Your latest information is ready when you return." /> : null}
            {record && statusCopy[record.status] ? (
              <InlineAlert className="mt-6" variant={statusCopy[record.status].tone} title={statusCopy[record.status].title} description={statusCopy[record.status].description} />
            ) : null}

            {loading ? (
              <StatePanel className="mt-8" variant="loading" title="Loading your application" description="Retrieving your secure onboarding record." />
            ) : !record ? (
              <form onSubmit={start} className="mt-8 max-w-xl rounded-[1.75rem] border border-black/8 bg-[#f8fafb] p-6">
                <label htmlFor="organisation-name" className="text-sm font-semibold">Business or professional name</label>
                <Input id="organisation-name" className="mt-2" value={name} onChange={(event) => setName(event.target.value)} minLength={2} required placeholder="e.g. ProLine Plumbing" />
                <p className="mt-3 text-xs leading-5 text-[#68717b]">Starting creates one organisation and makes you its owner. You can invite a team after approval.</p>
                <Button className="mt-5" type="submit" loading={saving}>Start onboarding <ArrowRight className="size-4" /></Button>
              </form>
            ) : mode === "review" ? (
              <ReviewPanel record={record} saving={saving} onSubmit={submit} />
            ) : (
              <form onSubmit={save} className="mt-8 space-y-9">
                <FormSection icon={Building2} title="Business details" description="Tell clients what you do and how to reach you.">
                  <Field label="Business or professional name"><Input value={name} onChange={(event) => setName(event.target.value)} disabled={!editable} required /></Field>
                  <Field label="Business type"><select className={fieldClass} value={businessType} onChange={(event) => setBusinessType(event.target.value)} disabled={!editable}><option value="">Select a type</option><option value="independent">Independent professional</option><option value="business">Service business</option></select></Field>
                  <Field label="Primary category"><Input value={primaryCategory} onChange={(event) => setPrimaryCategory(event.target.value)} disabled={!editable} placeholder="Plumbing, electrical, cleaning…" /></Field>
                  <Field label="Business email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!editable} /></Field>
                  <Field label="Phone"><Input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={!editable} /></Field>
                  <Field label="Description" full><textarea className={cn(fieldClass, "min-h-32 resize-y")} value={description} onChange={(event) => setDescription(event.target.value)} disabled={!editable} placeholder="Describe your experience, specialities, and the customers you serve." /><p className="mt-1 text-xs text-[#68717b]">{description.length}/80 minimum characters for submission</p></Field>
                </FormSection>

                <FormSection icon={MapPin} title="Location and availability" description="Set the areas you serve and your usual operating hours.">
                  <Field label="Operating location"><Input value={operatingLocation} onChange={(event) => setOperatingLocation(event.target.value)} disabled={!editable} placeholder="Nairobi, Kenya" /></Field>
                  <Field label="Service areas"><Input value={serviceAreas} onChange={(event) => setServiceAreas(event.target.value)} disabled={!editable} placeholder="Westlands, Kilimani, Lavington" /><p className="mt-1 text-xs text-[#68717b]">Separate areas with commas.</p></Field>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-semibold">Working hours</p>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(workingHours).map(([day, hours]) => (
                        <div key={day} className="grid grid-cols-[minmax(90px,1fr)_auto_92px_92px] items-center gap-2 rounded-2xl border border-black/8 px-3 py-2 text-sm">
                          <span className="capitalize">{day}</span>
                          <input type="checkbox" checked={hours.enabled} disabled={!editable} onChange={(event) => setWorkingHours((current) => ({ ...current, [day]: { ...hours, enabled: event.target.checked } }))} aria-label={`${day} enabled`} />
                          <input type="time" className="rounded-xl border border-black/8 px-2 py-1.5" value={hours.opensAt} disabled={!editable || !hours.enabled} onChange={(event) => setWorkingHours((current) => ({ ...current, [day]: { ...hours, opensAt: event.target.value } }))} />
                          <input type="time" className="rounded-xl border border-black/8 px-2 py-1.5" value={hours.closesAt} disabled={!editable || !hours.enabled} onChange={(event) => setWorkingHours((current) => ({ ...current, [day]: { ...hours, closesAt: event.target.value } }))} />
                        </div>
                      ))}
                    </div>
                  </div>
                </FormSection>

                <FormSection icon={ShieldCheck} title="Identity and verification" description="Verification confirms reviewed identity or business information; it is not a service-quality guarantee.">
                  <Field label="Verification type"><select className={fieldClass} value={verificationType} onChange={(event) => setVerificationType(event.target.value)} disabled={!editable}><option value="">Select evidence type</option><option value="national_id">National ID</option><option value="business_registration">Business registration</option><option value="trade_licence">Trade licence</option></select></Field>
                  <Field label="Document or registration reference"><Input value={verificationReference} onChange={(event) => setVerificationReference(event.target.value)} disabled={!editable} /></Field>
                  <UploadField label="Professional logo" accept="image/png,image/jpeg,image/webp" loading={uploading === "logo"} disabled={!editable} complete={Boolean(record.logoAssetId)} onFile={(file) => uploadAsset(file, "logo")} />
                  <UploadField label="Private verification evidence" accept="application/pdf,image/png,image/jpeg" loading={uploading === "evidence"} disabled={!editable} complete={record.documents.length > 0} onFile={(file) => uploadAsset(file, "verification_document")} />
                </FormSection>

                <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6">
                  <input type="checkbox" className="mt-1" checked={termsAccepted} disabled={!editable} onChange={(event) => setTermsAccepted(event.target.checked)} />
                  <span>I confirm this information is accurate and accept the professional terms. I understand verification does not guarantee service quality.</span>
                </label>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-6">
                  <p className="text-xs text-[#68717b]">Last saved {new Date(record.updatedAt).toLocaleString()}</p>
                  <div className="flex gap-3"><Button type="submit" variant="outline" loading={saving} disabled={!editable}>Save draft</Button><Link href="/professional/onboarding/review" className={buttonVariants({ variant: "secondary" })}>Review application <ArrowRight className="size-4" /></Link></div>
                </div>
              </form>
            )}
          </Surface>
        </main>
      </div>
    </div>
  );
}

function FormSection({ icon: Icon, title, description, children }: { icon: typeof Building2; title: string; description: string; children: React.ReactNode }) {
  return <section><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#eef8c8] text-[#5f8d11]"><Icon className="size-5" /></span><div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-[#68717b]">{description}</p></div></div><div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div></section>;
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}</label>;
}

function UploadField({ label, accept, loading, disabled, complete, onFile }: { label: string; accept: string; loading: boolean; disabled: boolean; complete: boolean; onFile: (file: File) => void }) {
  return <div><p className="mb-2 text-sm font-semibold">{label}</p><label className={cn("flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-[#f8fafb] p-4 text-center", disabled && "cursor-not-allowed opacity-60")}><input className="sr-only" type="file" accept={accept} disabled={disabled || loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />{complete ? <FileCheck2 className="size-6 text-[#5f8d11]" /> : <Upload className="size-6 text-[#68717b]" />}<span className="mt-2 text-sm font-semibold">{loading ? "Uploading securely…" : complete ? "Uploaded — choose another to replace" : "Choose a file"}</span><span className="mt-1 text-xs text-[#68717b]">Maximum size is enforced securely</span></label></div>;
}

function ReviewPanel({ record, saving, onSubmit }: { record: OnboardingSummary; saving: boolean; onSubmit: () => void }) {
  const rows = [
    ["Organisation", record.name],
    ["Business type", record.businessType ?? "Missing"],
    ["Category", record.primaryCategory ?? "Missing"],
    ["Location", record.operatingLocation ?? "Missing"],
    ["Service areas", record.serviceAreas.join(", ") || "Missing"],
    ["Verification", record.verificationType ?? "Missing"],
    ["Evidence", `${record.documents.length} secure file${record.documents.length === 1 ? "" : "s"}`],
  ];
  const canSubmit = record.readiness.complete && ["draft", "requires_changes"].includes(record.status);
  return <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]"><div><div className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-2xl border border-black/8 bg-[#f8fafb] p-4"><p className="text-xs text-[#68717b]">{label}</p><p className="mt-1 font-semibold capitalize">{value}</p></div>)}</div><div className="mt-6 rounded-2xl border border-black/8 p-5"><h2 className="font-bold">Submission history</h2><ol className="mt-4 space-y-4">{record.history.map((item) => <li key={item.id} className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-primary" /><div><p className="text-sm font-semibold capitalize">{item.toStatus.replaceAll("_", " ")}</p><p className="text-xs text-[#68717b]">{new Date(item.createdAt).toLocaleString()}</p>{item.reason ? <p className="mt-1 text-sm text-[#68717b]">{item.reason}</p> : null}</div></li>)}</ol></div></div><aside className="h-fit rounded-[1.75rem] bg-[#071522] p-6 text-white"><Clock3 className="size-6 text-primary" /><h2 className="mt-4 text-xl font-bold">Review readiness</h2><p className="mt-2 text-sm leading-6 text-white/65">{record.readiness.completedCount} of {record.readiness.totalCount} requirements complete.</p>{record.readiness.missingFields.length ? <ul className="mt-4 space-y-2 text-xs text-white/75">{record.readiness.missingFields.map((field) => <li key={field}>• {field}</li>)}</ul> : <p className="mt-4 flex items-center gap-2 text-sm text-primary"><Check className="size-4" /> Ready to submit</p>}<Button className="mt-6 w-full" disabled={!canSubmit} loading={saving} onClick={onSubmit}>Submit for review</Button>{record.status === "pending_review" ? <p className="mt-3 text-center text-xs text-white/60">Submitted {record.submittedAt ? new Date(record.submittedAt).toLocaleString() : "recently"}</p> : null}</aside></div>;
}
