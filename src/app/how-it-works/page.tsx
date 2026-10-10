import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cardSurfaceClass } from "@/components/public/design";
import { PageContainer } from "@/components/public/page-container";
import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";

const steps = [
  {
    step: "Step 1",
    title: "Discover verified professionals",
    body: "Browse the marketplace for home repair and maintenance services. Professional profiles show published services, verified ratings from completed engagements, and review history.",
    link: { href: "/marketplace", label: "Browse the marketplace" },
  },
  {
    step: "Step 2",
    title: "Send a request",
    body: "Describe the work you need and send it to the professional you choose. Your request, messages, and files stay connected to the engagement from the start.",
    link: { href: "/marketplace", label: "Find a service to request" },
  },
  {
    step: "Step 3",
    title: "Compare and accept a quotation",
    body: "The professional prepares a versioned quotation. Review exactly what is included, then accept the current version when the terms are right. Accepted terms are preserved.",
    link: { href: "/support", label: "Questions? Contact support" },
  },
  {
    step: "Step 4",
    title: "Book and follow the job",
    body: "Accepting a quotation creates a scheduled booking and job. Follow progress updates, checklists, and evidence as the work happens. Extra work needs your explicit approval first.",
    link: { href: "/support", label: "How bookings work" },
  },
  {
    step: "Step 5",
    title: "Confirm completion and records",
    body: "Confirm the work is complete or report an unresolved issue. Invoices and manual payment records stay attached to the engagement so both sides share the same history.",
    link: { href: "/pricing", label: "How pricing and payments work" },
  },
  {
    step: "Step 6",
    title: "Warranty, review, and rebook",
    body: "Eligible work carries a warranty you can claim if something fails. Leave a verified review after completion, then rebook a professional you trust for the next job.",
    link: { href: "/safety", label: "How safety and trust work" },
  },
] as const;

const professionalPoints = [
  "Create an organisation and publish a public profile with your services.",
  "Manage enquiries, quotations, bookings, jobs, customers, and invoices from one workspace.",
  "Build a reputation from verified completed work, then get rebooked.",
] as const;

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <main>
        <PageContainer className="py-14 sm:py-20">
          <PublicPageIntro
            eyebrow="How it works"
            title="One connected service journey."
            description="From discovery to repeat booking, every agreement, update, record, and follow-up stays attached to the engagement."
          />

          <ol className="mx-auto mt-12 grid max-w-4xl gap-4">
            {steps.map((item) => (
              <li key={item.title} className={`${cardSurfaceClass} p-6 sm:p-7`}>
                <p className="text-xs font-semibold tracking-wide text-[#6d9f16]">
                  {item.step}
                </p>
                <h2 className="mt-2 text-lg font-semibold tracking-title">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {item.body}
                </p>
                <Link
                  href={item.link.href}
                  prefetch={false}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f7d18] hover:underline"
                >
                  {item.link.label}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>

          <section
            aria-labelledby="how-it-works-professionals"
            className="mx-auto mt-10 max-w-4xl rounded-[22px] bg-[#0a1931] p-6 text-white shadow-[0_18px_55px_rgba(10,25,49,0.25)] sm:p-8"
          >
            <h2
              id="how-it-works-professionals"
              className="text-xl font-semibold tracking-title"
            >
              For professionals
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-white/75">
              {professionalPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/become-a-professional"
                prefetch={false}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
              >
                Become a Professional
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/support"
                prefetch={false}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white"
              >
                Contact support
              </Link>
            </div>
          </section>
        </PageContainer>
      </main>
    </PublicShell>
  );
}
