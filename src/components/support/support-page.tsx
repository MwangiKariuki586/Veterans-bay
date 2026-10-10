"use client";

import {
  ArrowRight,
  Headphones,
  Lock,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { jobApi, listJobs } from "@/components/jobs/job-api";
import { authClient } from "@/lib/auth-client";
import type { JobSummary } from "@/modules/jobs/types";
import { cardSurfaceClass } from "@/components/public/design";

const DISPUTE_ELIGIBLE_STATUSES = [
  "AWAITING_CLIENT_CONFIRMATION",
  "COMPLETED",
  "RETURN_VISIT_REQUIRED",
] as const;

const inquiryTypeOptions = [
  { value: "BOOKING", label: "Booking" },
  { value: "PAYMENTS", label: "Payments" },
  { value: "WARRANTY", label: "Warranty" },
  { value: "PROFESSIONAL", label: "Professional" },
  { value: "GENERAL", label: "General" },
] as const;

type InquiryType = (typeof inquiryTypeOptions)[number]["value"];

interface EnquiryResult {
  reference: string;
}

function eligibleJobs(jobs: JobSummary[]): JobSummary[] {
  return jobs.filter((job) =>
    (DISPUTE_ELIGIBLE_STATUSES as readonly string[]).includes(job.status),
  );
}

async function submitEnquiry(input: {
  inquiryType: InquiryType;
  name: string;
  email: string;
  phone?: string;
  message: string;
}): Promise<EnquiryResult> {
  const response = await fetch("/api/v1/public/contact", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await response.json().catch(() => null)) as {
    data?: EnquiryResult;
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.data) {
    throw new Error(body?.error?.message ?? "The enquiry could not be sent.");
  }
  return body.data;
}

function EnquiryForm({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const [inquiryType, setInquiryType] = useState<InquiryType>("GENERAL");
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) {
      nextErrors.name = "Enter your full name.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (phone.trim().length > 0 && phone.trim().length < 7) {
      nextErrors.phone = "Enter a valid phone number or leave it blank.";
    }
    if (message.trim().length < 10) {
      nextErrors.message = "Describe what you need in at least 10 characters.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      const result = await submitEnquiry({
        inquiryType,
        name: name.trim(),
        email: email.trim(),
        ...(phone.trim().length > 0 ? { phone: phone.trim() } : {}),
        message: message.trim(),
      });
      toast.success("Enquiry sent.");
      setReference(result.reference);
    } catch (cause) {
      setErrors({
        form:
          cause instanceof Error
            ? cause.message
            : "The enquiry could not be sent.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <div className="flex h-full flex-col items-start justify-center gap-3 py-6">
        <span className="grid size-11 place-items-center rounded-full bg-[#e6f3d9] text-[#2f7d18]">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-semibold">Enquiry received</h3>
        <p className="text-sm leading-6 text-muted-foreground">
          Our team reviews every enquiry. Quote this reference in any follow-up:
        </p>
        <p
          role="status"
          className="rounded-xl bg-[#f3f8e9] px-4 py-2 text-base font-semibold tracking-wide text-[#2f7d18]"
        >
          {reference}
        </p>
        <button
          type="button"
          onClick={() => setReference(null)}
          className="mt-1 text-xs font-semibold text-[#2f7d18] hover:underline"
        >
          Send another enquiry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Contact support">
      <div className="grid gap-4">
        <div>
          <label
            htmlFor="enquiry-name"
            className="text-xs font-semibold text-foreground"
          >
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id="enquiry-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Amina Yusuf"
            className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors placeholder:text-[#8a94a0] focus:border-black/25"
          />
          {errors.name ? (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="enquiry-email"
              className="text-xs font-semibold text-foreground"
            >
              Email address <span aria-hidden="true">*</span>
            </label>
            <input
              id="enquiry-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors placeholder:text-[#8a94a0] focus:border-black/25"
            />
            {errors.email ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.email}
              </p>
            ) : null}
          </div>
          <div>
            <label
              htmlFor="enquiry-phone"
              className="text-xs font-semibold text-foreground"
            >
              Phone{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <input
              id="enquiry-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+254 700 000 000"
              className="mt-1.5 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition-colors placeholder:text-[#8a94a0] focus:border-black/25"
            />
            {errors.phone ? (
              <p role="alert" className="mt-1 text-xs text-destructive">
                {errors.phone}
              </p>
            ) : null}
          </div>
        </div>
        <fieldset>
          <legend className="text-xs font-semibold text-foreground">
            Type of inquiry <span aria-hidden="true">*</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {inquiryTypeOptions.map((option) => {
              const selected = inquiryType === option.value;
              return (
                <label
                  key={option.value}
                  className={
                    selected
                      ? "inline-flex min-h-10 cursor-pointer items-center rounded-full bg-[#0a1931] px-4 text-xs font-semibold text-white transition-colors"
                      : "inline-flex min-h-10 cursor-pointer items-center rounded-full border border-black/10 bg-white px-4 text-xs font-semibold text-foreground transition-colors hover:border-black/25"
                  }
                >
                  <input
                    type="radio"
                    name="inquiry-type"
                    value={option.value}
                    checked={selected}
                    onChange={() => setInquiryType(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label
            htmlFor="enquiry-message"
            className="text-xs font-semibold text-foreground"
          >
            Message <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="enquiry-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minLength={10}
            rows={5}
            placeholder="Tell us what you need…"
            aria-describedby="enquiry-message-hint"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-[#8a94a0] focus:border-black/25"
          />
          <p
            id="enquiry-message-hint"
            className="mt-1 text-xs text-muted-foreground"
          >
            {message.trim().length}/10 characters minimum
          </p>
          {errors.message ? (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {errors.message}
            </p>
          ) : null}
        </div>
        {errors.form ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.form}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-control transition-opacity disabled:opacity-60 sm:w-auto sm:min-w-44"
        >
          {busy ? "Sending…" : "Submit"}
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

export function SupportPage() {
  const { data: session, isPending } = authClient.useSession();
  const sessionUser = !isPending ? session?.user : undefined;
  const signedIn = Boolean(sessionUser);

  const [jobs, setJobs] = useState<JobSummary[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsAttempt, setJobsAttempt] = useState(0);
  const [jobId, setJobId] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    listJobs("client")
      .then((page) => {
        if (!cancelled) setJobs(eligibleJobs(page.items));
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setJobsError(
            cause instanceof Error
              ? cause.message
              : "Jobs could not be loaded.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, jobsAttempt]);

  async function submitDispute(event: React.FormEvent) {
    event.preventDefault();
    if (!jobId) {
      setFormError("Choose the job this dispute is about.");
      return;
    }
    if (reason.trim().length < 10) {
      setFormError("Describe the issue in at least 10 characters.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await jobApi("/api/v1/disputes", {
        method: "POST",
        body: JSON.stringify({ jobId, reason: reason.trim() }),
      });
      toast.success("Dispute submitted for platform review.");
      setSubmitted(true);
      setJobId("");
      setReason("");
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : "Dispute submission failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full space-y-8 type-workspace-body">
      {/* Header */}
      <section className="space-y-2">
        <p className="text-[0.8rem] font-semibold tracking-wide text-[#6d9f16]">
          Support
        </p>
        <h1 className="type-workspace-title text-foreground">
          How can we help?
        </h1>
        <p className="max-w-[560px] text-sm leading-6 text-muted-foreground">
          Send us an enquiry, or resolve trouble with a recent service from your
          workspace records.
        </p>
      </section>

      {/* Contact split: what happens next + enquiry form */}
      <section
        aria-label="Contact support"
        className="grid items-stretch gap-4 lg:grid-cols-[0.95fr_1.05fr]"
      >
        <div className="flex flex-col overflow-hidden rounded-[22px] bg-[#0a1931] p-6 text-white shadow-[0_18px_55px_rgba(10,25,49,0.25)] sm:p-8">
          <h2 className="text-xl font-semibold tracking-title">
            Tell us what you need
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Our team reviews every enquiry. Keep your reference code for any
            follow-up.
          </p>
          <ul className="mt-6 space-y-5">
            <li className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-[#0a1931]">
                <MessageCircle className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  1. Send an enquiry
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-white/65">
                  Choose a type, describe what you need, and submit. Signed-in
                  senders are linked to their account automatically.
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-[#0a1931]">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  2. Job trouble goes further
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-white/65">
                  Signed in? Message your professional, file a warranty claim,
                  or raise a dispute from your workspace records.
                </span>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-[#0a1931]">
                <Lock className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  3. Private by default
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-white/65">
                  Enquiries are visible only to our support reviewers — never
                  published. See{" "}
                  <Link href="/privacy" className="underline hover:text-white">
                    how we handle data
                  </Link>
                  .
                </span>
              </span>
            </li>
          </ul>
        </div>
        <div className={`${cardSurfaceClass} p-5 sm:p-7`}>
          <EnquiryForm
            key={sessionUser?.id ?? "guest"}
            initialName={sessionUser?.name ?? ""}
            initialEmail={sessionUser?.email ?? ""}
          />
        </div>
      </section>
    </div>
  );
}
