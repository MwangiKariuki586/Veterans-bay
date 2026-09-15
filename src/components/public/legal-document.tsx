import Link from "next/link";

import { PageContainer } from "@/components/public/page-container";
import { PublicShell } from "@/components/public/public-shell";

export function LegalDocument({
  eyebrow,
  title,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  sections: ReadonlyArray<{
    title: string;
    paragraphs: ReadonlyArray<string>;
    items?: ReadonlyArray<string>;
  }>;
}) {
  return (
    <PublicShell>
      <main>
        <PageContainer className="py-14 sm:py-20">
          <article className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-trust">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-title sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Effective and last updated: {updated}
          </p>
          <div className="mt-10 space-y-9">
            {sections.map((section) => (
              <section key={section.title} aria-labelledby={slug(section.title)}>
                <h2
                  id={slug(section.title)}
                  className="text-xl font-semibold tracking-title"
                >
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.items ? (
                    <ul className="list-disc space-y-2 pl-5">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-12 rounded-2xl bg-muted p-5 text-sm leading-6">
            Questions or requests can be submitted through the{" "}
            <Link href="/help" className="font-semibold underline">
              Help Center
            </Link>
            .
          </div>
          </article>
        </PageContainer>
      </main>
    </PublicShell>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
