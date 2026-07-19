import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export function PublicSearch({
  className,
  prominent = false,
}: {
  className?: string;
  prominent?: boolean;
}) {
  return (
    <form
      action="/marketplace"
      role="search"
      className={cn(
        "flex h-14 min-w-0 items-center rounded-full border border-black/8 bg-white py-1.5 pr-1.5 pl-5",
        prominent && "h-16 pl-6",
        className,
      )}
    >
      <input
        name="query"
        aria-label="Search services"
        placeholder="Search services, plumbers, electricians..."
        className="min-w-0 flex-1 bg-transparent text-[0.82rem] outline-none placeholder:text-[#7a8188]"
      />
      <button
        type="submit"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-[#071522] text-white shadow-[0_8px_22px_rgba(7,21,34,0.22)]"
        aria-label="Search"
      >
        <Search className="size-[1.15rem]" aria-hidden="true" />
      </button>
    </form>
  );
}
