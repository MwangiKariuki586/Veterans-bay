"use client";

import { Check, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MARKETPLACE_LOCATION_OPTIONS, locationLabel } from "@/lib/locations";

export function ServiceAreaMultiPicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Select service areas",
  max = 30,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  max?: number;
}) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const normalized = new Set(value.map((v) => v.toLowerCase()));
  const visibleOptions = MARKETPLACE_LOCATION_OPTIONS.filter(
    (option) =>
      !normalized.has(option.value.toLowerCase()) &&
      (option.label.toLowerCase().includes(query.trim().toLowerCase()) ||
        option.value.toLowerCase().includes(query.trim().toLowerCase())),
  );

  const canAddCustom =
    query.trim().length >= 2 &&
    query.trim().length <= 120 &&
    !normalized.has(query.trim().toLowerCase()) &&
    visibleOptions.length === 0;

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function addValue(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 2 || trimmed.length > 120) return;
    if (value.length >= max) return;
    if (normalized.has(trimmed.toLowerCase())) return;
    // Use canonical value if matches known option (case-insensitive)
    const canonical = MARKETPLACE_LOCATION_OPTIONS.find(
      (o) => o.value.toLowerCase() === trimmed.toLowerCase() || o.label.toLowerCase() === trimmed.toLowerCase(),
    )?.value;
    const next = canonical ?? trimmed;
    onChange([...value, next]);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function removeValue(target: string) {
    onChange(value.filter((v) => v !== target));
  }

  return (
    <div ref={rootRef} className="w-full">
      {value.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((area) => (
            <Badge
              key={area}
              variant="success"
              className="gap-1 rounded-full bg-success-soft px-2.5 py-1 pr-1 text-[11px] font-medium text-success"
            >
              <MapPin className="size-3" />
              {locationLabel(area)}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${area}`}
                  onClick={() => removeValue(area)}
                  className="ml-1 grid size-4 place-items-center rounded-full bg-white/80 hover:bg-white"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-xl border border-black/8 bg-white px-3 text-sm",
          disabled && "opacity-60",
        )}
      >
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search service areas"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter") {
              event.preventDefault();
              if (visibleOptions[0]) {
                addValue(visibleOptions[0].value);
              } else if (query.trim()) {
                addValue(query.trim());
              }
            }
            if (event.key === "Backspace" && !query && value.length > 0) {
              removeValue(value[value.length - 1]);
            }
          }}
          placeholder={value.length >= max ? `Maximum ${max} areas` : placeholder}
          disabled={disabled || value.length >= max}
          className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {open ? (
          <Search className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <span className="text-[10px] text-muted-foreground">{value.length}/{max}</span>
        )}
      </div>

      {open && !disabled ? (
        <div
          id={listboxId}
          role="listbox"
          className="relative z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_14px_36px_rgba(7,21,34,0.16)]"
        >
          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={false}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-success-soft"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addValue(option.value)}
            >
              {option.label}
              <Check className="size-3.5 opacity-0" />
            </button>
          ))}
          {canAddCustom ? (
            <button
              type="button"
              role="option"
              className="flex w-full items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-left text-xs"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addValue(query.trim())}
            >
              <span>Add &ldquo;{query.trim()}&rdquo;</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Press Enter</span>
            </button>
          ) : null}
          {visibleOptions.length === 0 && !canAddCustom ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {query.trim() ? "No matching location. Press Enter to add custom." : "No more locations to add"}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">Select from Nairobi areas or add custom. Max {max}.</p>
    </div>
  );
}
