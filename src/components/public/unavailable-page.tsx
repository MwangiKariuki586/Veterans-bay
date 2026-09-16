import { ArrowLeft, Construction } from "lucide-react";
import Link from "next/link";

import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";
import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

export function UnavailablePage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <PublicShell>
      <main>
        <PublicPageIntro eyebrow={eyebrow} title={title} description={description} />
        <Surface className="mx-auto mt-10 max-w-2xl p-8 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
            <Construction className="size-6" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-title">
            This destination is not available yet
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#68717b]">
            The route is established for the public shell, but the workflow will be
            implemented in its ordered product phase.
          </p>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "mt-7 rounded-full border-black/8",
            )}
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to homepage
          </Link>
        </Surface>
      </main>
    </PublicShell>
  );
}
