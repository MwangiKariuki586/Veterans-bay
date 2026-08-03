import { Construction } from "lucide-react";

import { Surface } from "@/components/ui/surface";

export function WorkspaceUnavailablePage({
  title,
  description,
}: {
  /** @deprecated Layout provides the shell; retained for call-site compatibility. */
  kind?: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-5">
        <h1 className="type-workspace-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          {description}
        </p>
      </div>
      <Surface className="border border-dashed border-black/10 bg-[#f7f9fa] p-8 text-center shadow-none">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
          <Construction className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-bold tracking-title">
          This workspace view is not available yet
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#68717b]">
          The destination is wired for navigation, and the workflow will be
          implemented in its ordered product phase.
        </p>
      </Surface>
    </div>
  );
}
