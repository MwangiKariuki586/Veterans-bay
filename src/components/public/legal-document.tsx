import Link from "next/link";

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
      <main className="w-full pb-8">
        <div className="w-full space-y-8 type-workspace-body">
          <section className="space-y-2">
            <p className="text-[0.8rem] font-semibold tracking-wide text-[#6d9f16]">
              {eyebrow}
            </p>
            <h1 className="type-workspace-title text-foreground">{title}</h1>
            <p className="max-w-[560px] text-sm leading-6 text-muted-foreground">
              Effective and last updated: {updated}
            </p>
          </section>
          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.title} aria-labelledby={slug(section.title)}>
                <h2
                  id={slug(section.title)}
                  className="text-xl font-semibold tracking-title"
                >
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
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
          <div className="rounded-2xl bg-muted py-5 pr-5 text-sm leading-6">
            Questions or requests can be submitted through the{" "}
            <Link href="/support" className="font-semibold underline">
              Help Center
            </Link>
            .
          </div>
        </div>
      </main>
    </PublicShell>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
