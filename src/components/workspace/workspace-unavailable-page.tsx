import { Construction } from "lucide-react";

import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { Surface } from "@/components/ui/surface";

export function WorkspaceUnavailablePage({
  kind,
  title,
  description,
}: {
  kind: AuthenticatedShellKind;
  title: string;
  description: string;
}) {
  return (
    <AuthenticatedShell kind={kind} title={title} description={description}>
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
    </AuthenticatedShell>
  );
}
