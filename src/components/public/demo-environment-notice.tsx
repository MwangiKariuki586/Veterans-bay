import { FlaskConical } from "lucide-react";

export function DemoEnvironmentNotice() {
  return (
    <aside
      aria-label="Demonstration environment notice"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-amber-950"
    >
      <p className="mx-auto flex max-w-7xl items-start justify-center gap-2 text-center text-xs leading-5 font-semibold sm:text-sm">
        <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Demonstration environment only. Do not enter real personal, service, or
        payment information. No real services or payments are processed.
      </p>
    </aside>
  );
}
