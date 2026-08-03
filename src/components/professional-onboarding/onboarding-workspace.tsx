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
import { toast } from "sonner";

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
    title: "Application submitted — awaiting administrator approval",
    description:
      "A platform administrator must approve your organisation before you can access the professional workspace or publish services. You do not need to submit again.",
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

type ApiIssue = { code: string; path: string };

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly issues: ApiIssue[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const onboardingFieldLabels = {
  name: "business or professional name",
  businessType: "business type",
  primaryCategory: "primary category",
  description: "description",
  phone: "phone number",
  email: "business email",
  operatingLocation: "operating location",
  serviceAreas: "service areas",
  workingHours: "working hours",
  verificationType: "verification type",
  verificationReference: "verification reference",
  termsAccepted: "professional terms",
} as const;

type OnboardingField = keyof typeof onboardingFieldLabels;
type FieldErrors = Partial<Record<OnboardingField, string>>;

function isOnboardingField(field: string): field is OnboardingField {
  return field in onboardingFieldLabels;
}

function describeFieldError(field: OnboardingField) {
  switch (field) {
    case "name":
      return "Enter a business or professional name with at least 2 characters.";
    case "description":
      return "Enter a description with at least 20 characters before saving the draft.";
    case "phone":
      return "Enter a valid phone number using digits, spaces, +, parentheses, or hyphens.";
    case "email":
      return "Enter a valid business email address.";
    case "serviceAreas":
      return "Enter service areas with at least 2 characters each.";
    case "workingHours":
      return "Check that each working-hours entry uses a valid opening and closing time.";
    default:
      return `Check ${onboardingFieldLabels[field]} and try again.`;
  }
}

function getFieldErrors(cause: unknown): FieldErrors {
  if (!(cause instanceof ApiRequestError) || cause.code !== "VALIDATION_ERROR") {
    return {};
  }
  return cause.issues.reduce<FieldErrors>((errors, issue) => {
    const field = issue.path.split(".")[0];
    if (isOnboardingField(field) && !errors[field]) {
      errors[field] = describeFieldError(field);
    }
    return errors;
  }, {});
}

function describeApiError(cause: unknown, fallback: string) {
  if (!(cause instanceof ApiRequestError)) {
    return cause instanceof Error ? cause.message : fallback;
  }
  if (cause.code === "ONBOARDING_INCOMPLETE") {
    return "Complete the remaining requirements shown in Review readiness before submitting.";
  }
  if (cause.code === "VALIDATION_ERROR" && cause.issues.length > 0) {
    const fieldErrors = getFieldErrors(cause);
    const fields = Object.keys(fieldErrors) as OnboardingField[];
    if (fields.length > 1) {
      const labels = fields.map(
        (field) => onboardingFieldLabels[field] ?? "onboarding details",
      );
      return `Check ${labels.join(", ")} and try again.`;
    }
    if (fields.length === 1) {
      return fieldErrors[fields[0]] as string;
    }
  }
  return cause.message === "The request is invalid."
    ? "Review the form values and correct the details that need attention."
    : cause.message || fallback;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  const body = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; message?: string; issues?: ApiIssue[] };
  } | null;
  if (!response.ok || !body || body.data === undefined) {
    throw new ApiRequestError(
      body?.error?.message ?? body?.error?.code ?? "Request failed.",
      body?.error?.code,
      body?.error?.issues,
    );
  }
  return body.data;
}

export function OnboardingWorkspace({ mode }: { mode: PageMode }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [record, setRecord] = useState<OnboardingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"save" | "review" | null>(null);
  const [uploading, setUploading] = useState<"logo" | "evidence" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
  const pendingReview = record?.status === "pending_review";
  const progress = record
    ? Math.round((record.readiness.completedCount / record.readiness.totalCount) * 100)
    : 0;
  const pageTitle =
    mode === "review"
      ? pendingReview
        ? "Application submitted"
        : "Review your application"
      : mode === "settings"
        ? "Business profile"
        : "Set up your professional profile";

  function showError(cause: unknown, title: string, fallback: string) {
    const description = describeApiError(cause, fallback);
    setError(description);
    setFieldErrors(getFieldErrors(cause));
    toast.error(title, { description });
  }

  function clearFieldError(field: OnboardingField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

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
      showError(cause, "Couldn’t start onboarding", "Unable to start onboarding.");
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | null;
    const reviewAfterSave = submitter?.value === "review";
    setSaving(true);
    setSavingAction(reviewAfterSave ? "review" : "save");
    setSaved(false);
    setError(null);
    setFieldErrors({});
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
      toast.success("Draft saved");
      if (reviewAfterSave) {
        router.push("/professional/onboarding/review");
      }
    } catch (cause) {
      showError(cause, "Couldn’t save your draft", "Unable to save your draft.");
    } finally {
      setSaving(false);
      setSavingAction(null);
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
      const providerBody = (await cloudinaryResponse.json().catch(() => null)) as {
        public_id?: string;
      } | null;
      if (!cloudinaryResponse.ok || !providerBody?.public_id) {
        throw new Error("The file could not be uploaded. Please try again.");
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
      toast.success(
        kind === "logo" ? "Professional logo uploaded" : "Verification evidence uploaded",
      );
    } catch (cause) {
      showError(cause, "Upload unsuccessful", "Unable to upload the file.");
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
      toast.success("Application submitted for review");
    } catch (cause) {
      showError(
        cause,
        "Couldn’t submit your application",
        "Unable to submit the application.",
      );
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

  const progressCard = (
    <Surface aria-label="Onboarding progress" className="h-fit p-5 lg:sticky lg:top-5">
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
      <p className="mt-2 text-xs text-[#68717b]">
        {pendingReview ? `${progress}% complete · submitted for review` : `${progress}% ready for review`}
      </p>
      <ol className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", step.done ? "bg-primary text-[#071522]" : "bg-[#edf1f3] text-[#68717b]")}>{step.done ? <Check className="size-4" /> : index + 1}</span>
            {step.label}
          </li>
        ))}
      </ol>
    </Surface>
  );

  const reviewHeader = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5f8d11]">Trusted. Skilled. Reliable.</p>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{pageTitle}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68717b]">
        {pendingReview
          ? "Your application is complete and locked while an administrator reviews it. The decision will appear on this page."
          : "Save your progress at any time. Private verification evidence is visible only to authorised reviewers."}
      </p>
      {error ? <InlineAlert className="mt-6" variant="error" title="Check your application details" description={error} /> : null}
      {saved ? <InlineAlert className="mt-6" variant="success" title="Draft saved" description="Your latest information is ready when you return." /> : null}
      {statusCopy[record?.status ?? ""] ? (
        <InlineAlert className="mt-6" variant={statusCopy[record?.status ?? ""].tone} title={statusCopy[record?.status ?? ""].title} description={statusCopy[record?.status ?? ""].description} />
      ) : null}
    </>
  );

  if (mode === "review" && record && !loading) {
    return (
      <div className={pageBackdropClass}>
        <div className={pageFrameClass()}>
          <SiteHeader />
          <ReviewPanel header={reviewHeader} progressCard={progressCard} record={record} saving={saving} onSubmit={submit} />
        </div>
      </div>
    );
  }

  return (
    <div className={pageBackdropClass}>
      <div className={pageFrameClass()}>
        <SiteHeader />
        <main className={cn("mt-5 grid gap-5", mode !== "review" && "lg:grid-cols-[280px_minmax(0,1fr)]")}>
          {mode !== "review" ? progressCard : null}

          <Surface className="overflow-hidden p-6 sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5f8d11]">Trusted. Skilled. Reliable.</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.045em] sm:text-4xl">{pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68717b]">Save your progress at any time. Private verification evidence is visible only to authorised reviewers.</p>

            {error ? <InlineAlert className="mt-6" variant="error" title="Check your application details" description={error} /> : null}
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
              <ReviewPanel header={reviewHeader} progressCard={progressCard} record={record} saving={saving} onSubmit={submit} />
            ) : (
              <form id="professional-onboarding-form" onSubmit={save} noValidate className="mt-8 space-y-9">
                <FormSection icon={Building2} title="Business details" description="Tell clients what you do and how to reach you.">
                  <Field label="Business or professional name" error={fieldErrors.name}><Input value={name} onChange={(event) => { setName(event.target.value); clearFieldError("name"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.name)} required /></Field>
                  <Field label="Business type" error={fieldErrors.businessType}><select className={fieldClass} value={businessType} onChange={(event) => { setBusinessType(event.target.value); clearFieldError("businessType"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.businessType)}><option value="">Select a type</option><option value="independent">Independent professional</option><option value="business">Service business</option></select></Field>
                  <Field label="Primary category" error={fieldErrors.primaryCategory}><Input value={primaryCategory} onChange={(event) => { setPrimaryCategory(event.target.value); clearFieldError("primaryCategory"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.primaryCategory)} placeholder="Plumbing, electrical, cleaning…" /></Field>
                  <Field label="Business email" error={fieldErrors.email}><Input type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearFieldError("email"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.email)} /></Field>
                  <Field label="Phone" error={fieldErrors.phone}><Input type="tel" value={phone} onChange={(event) => { setPhone(event.target.value); clearFieldError("phone"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.phone)} /></Field>
                  <Field label="Description" full error={fieldErrors.description}><textarea className={cn(fieldClass, "min-h-32 resize-y")} value={description} onChange={(event) => { setDescription(event.target.value); clearFieldError("description"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.description)} placeholder="Describe your experience, specialities, and the customers you serve." /><p className="mt-1 text-xs text-[#68717b]">{description.length}/80 minimum characters for submission</p></Field>
                </FormSection>

                <FormSection icon={MapPin} title="Location and availability" description="Set the areas you serve and your usual operating hours.">
                  <Field label="Operating location" error={fieldErrors.operatingLocation}><Input value={operatingLocation} onChange={(event) => { setOperatingLocation(event.target.value); clearFieldError("operatingLocation"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.operatingLocation)} placeholder="Nairobi, Kenya" /></Field>
                  <Field label="Service areas" error={fieldErrors.serviceAreas}><Input value={serviceAreas} onChange={(event) => { setServiceAreas(event.target.value); clearFieldError("serviceAreas"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.serviceAreas)} placeholder="Westlands, Kilimani, Lavington" /><p className="mt-1 text-xs text-[#68717b]">Separate areas with commas.</p></Field>
                  <div className="sm:col-span-2">
                    <p className="text-sm font-semibold">Working hours</p>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(workingHours).map(([day, hours]) => (
                        <div key={day} className="grid grid-cols-[minmax(90px,1fr)_auto_92px_92px] items-center gap-2 rounded-2xl border border-black/8 px-3 py-2 text-sm">
                          <span className="capitalize">{day}</span>
                          <input type="checkbox" checked={hours.enabled} disabled={!editable} onChange={(event) => { setWorkingHours((current) => ({ ...current, [day]: { ...hours, enabled: event.target.checked } })); clearFieldError("workingHours"); }} aria-label={`${day} enabled`} aria-invalid={Boolean(fieldErrors.workingHours)} />
                          <input type="time" aria-label={`${day} opening time`} className="rounded-xl border border-black/8 px-2 py-1.5" value={hours.opensAt} disabled={!editable || !hours.enabled} onChange={(event) => { setWorkingHours((current) => ({ ...current, [day]: { ...hours, opensAt: event.target.value } })); clearFieldError("workingHours"); }} aria-invalid={Boolean(fieldErrors.workingHours)} />
                          <input type="time" aria-label={`${day} closing time`} className="rounded-xl border border-black/8 px-2 py-1.5" value={hours.closesAt} disabled={!editable || !hours.enabled} onChange={(event) => { setWorkingHours((current) => ({ ...current, [day]: { ...hours, closesAt: event.target.value } })); clearFieldError("workingHours"); }} aria-invalid={Boolean(fieldErrors.workingHours)} />
                        </div>
                      ))}
                    </div>
                    {fieldErrors.workingHours ? <FieldError>{fieldErrors.workingHours}</FieldError> : null}
                  </div>
                </FormSection>

                <FormSection icon={ShieldCheck} title="Identity and verification" description="Verification confirms reviewed identity or business information; it is not a service-quality guarantee.">
                  <Field label="Verification type" error={fieldErrors.verificationType}><select className={fieldClass} value={verificationType} onChange={(event) => { setVerificationType(event.target.value); clearFieldError("verificationType"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.verificationType)}><option value="">Select evidence type</option><option value="national_id">National ID</option><option value="business_registration">Business registration</option><option value="trade_licence">Trade licence</option></select></Field>
                  <Field label="Document or registration reference" error={fieldErrors.verificationReference}><Input value={verificationReference} onChange={(event) => { setVerificationReference(event.target.value); clearFieldError("verificationReference"); }} disabled={!editable} aria-invalid={Boolean(fieldErrors.verificationReference)} /></Field>
                  <UploadField label="Professional logo" helper="PNG, JPG or WebP, up to 2 MB." accept="image/png,image/jpeg,image/webp" loading={uploading === "logo"} disabled={!editable} complete={Boolean(record.logoAssetId)} onFile={(file) => uploadAsset(file, "logo")} />
                  <UploadField label="Private verification evidence" helper={`Upload a clear copy of your ${verificationType === "national_id" ? "National ID" : verificationType === "business_registration" ? "business registration" : verificationType === "trade_licence" ? "trade licence" : "verification document"}. PDF, JPG or PNG, up to 8 MB. Only authorised reviewers can access it.`} accept="application/pdf,image/png,image/jpeg" loading={uploading === "evidence"} disabled={!editable} complete={record.documents.length > 0} onFile={(file) => uploadAsset(file, "verification_document")} />
                </FormSection>

                <div>
                  <label className="flex items-start gap-3 rounded-2xl border border-black/8 bg-[#f8fafb] p-4 text-sm leading-6">
                    <input type="checkbox" className="mt-1" checked={termsAccepted} disabled={!editable} onChange={(event) => { setTermsAccepted(event.target.checked); clearFieldError("termsAccepted"); }} aria-invalid={Boolean(fieldErrors.termsAccepted)} />
                    <span>I confirm this information is accurate and accept the professional terms. I understand verification does not guarantee service quality.</span>
                  </label>
                  {fieldErrors.termsAccepted ? <FieldError>{fieldErrors.termsAccepted}</FieldError> : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-6">
                  <p className="text-xs text-[#68717b]">Last saved {new Date(record.updatedAt).toLocaleString()}</p>
                  <div className="flex gap-3"><Button type="submit" variant="outline" loading={savingAction === "save"} disabled={!editable || saving}>Save draft</Button><Button type="submit" name="intent" value="review" variant="secondary" loading={savingAction === "review"} disabled={!editable || saving}>Save & review <ArrowRight className="size-4" /></Button></div>
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

function Field({ label, children, error, full = false }: { label: string; children: React.ReactNode; error?: string; full?: boolean }) {
  return <label className={cn("block", full && "sm:col-span-2")}><span className="mb-2 block text-sm font-semibold">{label}</span>{children}{error ? <FieldError>{error}</FieldError> : null}</label>;
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs font-medium text-danger" role="alert">{children}</p>;
}

function UploadField({ label, helper, accept, loading, disabled, complete, onFile }: { label: string; helper: string; accept: string; loading: boolean; disabled: boolean; complete: boolean; onFile: (file: File) => void }) {
  return <div><p className="mb-2 text-sm font-semibold">{label}</p><label className={cn("flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-[#f8fafb] p-4 text-center", disabled && "cursor-not-allowed opacity-60")}><input className="sr-only" type="file" aria-label={`${label} file`} accept={accept} disabled={disabled || loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); }} />{complete ? <FileCheck2 className="size-6 text-[#5f8d11]" /> : <Upload className="size-6 text-[#68717b]" />}<span className="mt-2 text-sm font-semibold">{loading ? "Uploading securely…" : complete ? "Uploaded — choose another to replace" : "Choose a file"}</span><span className="mt-1 text-xs leading-5 text-[#68717b]">{helper}</span></label></div>;
}

function ReviewPanel({ header, progressCard, record, saving, onSubmit }: { header: React.ReactNode; progressCard: React.ReactNode; record: OnboardingSummary; saving: boolean; onSubmit: () => void }) {
  const rows = [
    ["Organisation", record.name],
    ["Business type", record.businessType ?? "Missing"],
    ["Category", record.primaryCategory ?? "Missing"],
    ["Location", record.operatingLocation ?? "Missing"],
    ["Service areas", record.serviceAreas.join(", ") || "Missing"],
    ["Verification", record.verificationType ?? "Missing"],
    ["Evidence", `${record.documents.length} secure file${record.documents.length === 1 ? "" : "s"}`],
  ];
  const pendingReview = record.status === "pending_review";
  const canSubmit = record.readiness.complete && ["draft", "requires_changes"].includes(record.status);
  return (
    <main aria-label="Application review columns" className="mt-5 grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      {progressCard}
      <Surface aria-label="Application details" className="overflow-hidden p-6 sm:p-9">
        {header}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-black/8 bg-[#f8fafb] p-4">
              <p className="text-xs text-[#68717b]">{label}</p>
              <p className="mt-1 font-semibold capitalize">{value.replaceAll("_", " ")}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-black/8 p-5">
          <h2 className="font-bold">Submission history</h2>
          <ol className="mt-4 space-y-4">
            {record.history.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span className="mt-1 size-2 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-semibold capitalize">{item.toStatus.replaceAll("_", " ")}</p>
                  <p className="text-xs text-[#68717b]">{new Date(item.createdAt).toLocaleString()}</p>
                  {item.reason ? <p className="mt-1 text-sm text-[#68717b]">{item.reason}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Surface>
      <aside aria-label="Review readiness" className="h-fit rounded-[1.75rem] bg-[#071522] p-6 text-white">
        <Clock3 className="size-6 text-primary" />
        <h2 className="mt-4 text-xl font-bold">{pendingReview ? "Awaiting approval" : "Review readiness"}</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">
          {pendingReview
            ? `All ${record.readiness.totalCount} requirements were completed and submitted.`
            : `${record.readiness.completedCount} of ${record.readiness.totalCount} requirements complete.`}
        </p>
        {record.readiness.missingFields.length ? (
          <ul className="mt-4 space-y-2 text-xs text-white/75">
            {record.readiness.missingFields.map((field) => <li key={field}>• {field}</li>)}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-primary"><Check className="size-4" /> {pendingReview ? "Submitted for review" : "Ready to submit"}</p>
        )}
        {pendingReview ? (
          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <p className="text-sm font-semibold">No action is required from you</p>
            <p className="mt-2 text-xs leading-5 text-white/65">
              An administrator must approve the application before your professional workspace is unlocked.
            </p>
            <p className="mt-3 text-xs text-white/60">Submitted {record.submittedAt ? new Date(record.submittedAt).toLocaleString() : "recently"}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-2">
            <Link href="/professional/onboarding" className={cn(buttonVariants({ variant: "outline" }), "w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white")}>Edit application</Link>
            <Button className="w-full disabled:bg-white/10 disabled:text-white/45 disabled:opacity-100 disabled:shadow-none" disabled={!canSubmit} loading={saving} onClick={onSubmit}>Submit for review</Button>
          </div>
        )}
      </aside>
    </main>
  );
}
