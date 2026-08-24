"use client";

import { CalendarClock, ShieldCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import {
  warrantyStatuses,
  type WarrantyStatus,
  type WarrantySummary,
} from "@/modules/warranties/types";
import { listWarranties } from "./warranty-api";

export function WarrantyList({
  audience,
}: {
  audience: "client" | "professional";
}) {
  const [status, setStatus] = useState<WarrantyStatus | "ALL">("ALL");
  const [items, setItems] = useState<WarrantySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listWarranties(audience, status === "ALL" ? undefined : status)
      .then((result) => {
        setItems(result.items);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Warranties unavailable.",
        ),
      );
  }, [audience, status]);

  return (
    <div>
      <p className="text-sm font-semibold text-[#5f8d11]">
        Post-service protection
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-title">
        {audience === "client" ? "My warranties" : "Warranties"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        {audience === "client"
          ? "Review recorded coverage and track any follow-up claim."
          : "Review eligible coverage, claim decisions, return visits, and resolution history."}
      </p>
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Warranty status filter"
      >
        {(["ALL", ...warrantyStatuses] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setItems(null);
              setStatus(item);
            }}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold",
              status === item
                ? "border-[#8eb81d] bg-[#eff9c9]"
                : "border-black/8 bg-white text-[#68717b]",
            )}
          >
            {item === "ALL" ? "All" : item}
          </button>
        ))}
      </div>
      {error ? (
        <InlineAlert
          className="mt-5"
          title="Warranties need attention"
          description={error}
        />
      ) : null}
      {!items && !error ? (
        <div className="mt-5 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : null}
      {items?.length === 0 ? (
        <StatePanel
          className="mt-5"
          title="No warranties in this view"
          description={
            audience === "client"
              ? "Eligible completed work will appear here with its recorded terms."
              : "Eligible completed jobs will create warranty records here."
          }
        />
      ) : null}
      {items?.length ? (
        <div className="mt-5 grid gap-4">
          {items.map((warranty) => (
            <Link
              key={warranty.id}
              href={`/${audience}/warranties/${warranty.id}`}
              className="rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Surface className="p-5 shadow-none transition-colors hover:border-[#b5d657] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge
                      variant={
                        warranty.status === "ACTIVE"
                          ? "success"
                          : warranty.status === "EXPIRED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {warranty.status}
                    </Badge>
                    <h2 className="mt-3 text-lg font-semibold">
                      {warranty.serviceName}
                    </h2>
                    <p className="mt-1 text-sm text-[#68717b]">
                      {audience === "client"
                        ? warranty.providerName
                        : warranty.clientName}
                    </p>
                  </div>
                  <ShieldCheck className="size-7 text-[#5f8d11]" />
                </div>
                <div className="mt-5 grid gap-3 text-sm text-[#59646e] sm:grid-cols-2">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-[#5f8d11]" />
                    Through {new Date(warranty.endsAt).toLocaleDateString()}
                  </p>
                  <p className="flex items-center gap-2">
                    <TriangleAlert className="size-4 text-[#5f8d11]" />
                    {warranty.openClaimCount
                      ? `${warranty.openClaimCount} open claim`
                      : "No open claim"}
                  </p>
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
