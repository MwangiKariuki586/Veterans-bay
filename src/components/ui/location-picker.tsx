"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { MARKETPLACE_LOCATION_OPTIONS } from "@/lib/locations";

export function LocationPicker({
  value,
  onSelect,
  compact = false,
  field = false,
  className,
}: {
  value: string;
  onSelect: (value: string) => void;
  compact?: boolean;
  field?: boolean;
  className?: string;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = MARKETPLACE_LOCATION_OPTIONS.find((option) => option.value === value);
  const visibleOptions = MARKETPLACE_LOCATION_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0 max-w-full", field && "w-full", className)}
    >
      <div
        className={cn(
          "flex max-w-full min-w-0 items-center gap-2 bg-white",
          compact
            ? "mt-1 h-9 rounded-sm border-b border-black/10 px-2.5"
            : field
              ? "mt-2 h-11 rounded-sm border-b border-black/10 px-3"
              : "min-h-11 rounded-xl px-3",
        )}
      >
        <MapPin className="size-4 shrink-0 text-[#17304f]" />
        <input
          role="combobox"
          aria-label="Search locations"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={open ? query : (selected?.label ?? value)}
          placeholder="e.g. Nairobi"
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8a98aa]",
            compact ? "text-[0.7rem]" : field ? "text-sm" : "text-sm font-medium",
          )}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && visibleOptions[0]) {
              event.preventDefault();
              onSelect(visibleOptions[0].value);
              setOpen(false);
            }
          }}
        />
        {open ? (
          <Search className={cn("size-4 shrink-0 text-[#68717b]", compact && "-mr-1.5")} />
        ) : (
          <ChevronDown
            data-location-chevron
            className={cn("size-4 shrink-0 text-[#17304f]", compact && "-mr-1.5")}
          />
        )}
      </div>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute top-[calc(100%+0.35rem)] right-0 left-0 z-40 max-h-60 overflow-y-auto rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_14px_36px_rgba(7,21,34,0.16)]"
        >
          {field ? (
            <button
              type="button"
              role="option"
              aria-selected={!value}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f8e8]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect("");
                setOpen(false);
              }}
            >
              All locations {!value ? <Check className="size-3.5" /> : null}
            </button>
          ) : null}
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f8e8]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
            >
              {option.label}
              {option.value === value ? <Check className="size-3.5" /> : null}
            </button>
          ))}
          {visibleOptions.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[#68717b]">No matching location</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
