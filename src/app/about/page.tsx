import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cardSurfaceClass } from "@/components/public/design";
import { PageContainer } from "@/components/public/page-container";
import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";

const journey = [
  "Discover a verified professional and send a request.",
  "Compare a versioned quotation and accept the current terms.",
  "Book, follow progress, and approve any extra work first.",
  "Confirm completion, keep the payment record, and claim warranty if needed.",
  "Leave a verified review and rebook someone you trust.",
] as const;

export default function AboutPage() {
  return (
    <PublicShell>
      <main>
        <PageContainer className="py-14 sm:py-20">
          <PublicPageIntro
            eyebrow="About"
            title="Home services you can trust."
            description="Veterans Bay connects clients with verified home repair and maintenance professionals, and gives professionals one workspace to run their whole business."
          />

          <div className="mx-auto mt-12 grid max-w-4xl gap-4">
            <section className={`${cardSurfaceClass} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold tracking-title">
                What Veterans Bay is
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Veterans Bay is a service marketplace and professional
                operations platform for home repair and maintenance. Clients
                discover professionals, agree terms, schedule work, and keep
                every record in one place. Professionals manage services,
                customers, quotations, bookings, jobs, payments, warranties,
                and reviews from a single workspace — including customers they
                already had before joining.
              </p>
            </section>

            <section className={`${cardSurfaceClass} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold tracking-title">
                One connected journey
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
                {journey.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <Link
                href="/how-it-works"
                prefetch={false}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f7d18] hover:underline"
              >
                See how it works
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </section>

            <section className={`${cardSurfaceClass} p-6 sm:p-7`}>
              <h2 className="text-lg font-semibold tracking-title">
                Trust is recorded, not claimed
              </h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Ratings and reviews come from eligible completed engagements,
                accepted terms are preserved, and status history is never
                silently rewritten. Access is organisation-scoped and enforced
                on the server; private evidence travels through authorised,
                time-limited delivery. Veterans Bay records manual payment
                information but does not process payments in the MVP.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/safety"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f7d18] hover:underline"
                >
                  Safety &amp; trust standards
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/support"
                  prefetch={false}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#2f7d18] hover:underline"
                >
                  Contact us
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </section>

            <section className="rounded-[22px] bg-[#0a1931] p-6 text-white shadow-[0_18px_55px_rgba(10,25,49,0.25)] sm:p-8">
              <h2 className="text-xl font-semibold tracking-title">
                Get started
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Find a professional for your next repair, or join as a
                professional and run your business from one place.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/marketplace"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
                >
                  Find Services
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/become-a-professional"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-5 text-sm font-semibold text-white"
                >
                  Become a Professional
                </Link>
              </div>
            </section>
          </div>
        </PageContainer>
      </main>
    </PublicShell>
  );
}
