"use client";

import { CalendarDays, CircleDollarSign, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { useCachedResource } from "@/lib/use-cached-resource";
import { cn } from "@/lib/utils";
import {
  jobStatuses,
  type JobStatus,
  type JobSummary,
} from "@/modules/jobs/types";
import { listJobs } from "./job-api";

export function JobList({
  audience,
}: {
  audience: "client" | "professional";
}) {
  const [status, setStatus] = useState<JobStatus | "ALL">("ALL");
  const load = useCallback(
    (signal: AbortSignal) =>
      listJobs(audience, status === "ALL" ? undefined : status).then(
        (result) => {
          if (signal.aborted) throw new DOMException("Aborted", "AbortError");
          return result.items;
        },
      ),
    [audience, status],
  );
  const { data: items, error } = useCachedResource<JobSummary[]>({
    namespace: "jobs-list",
    key: `${audience}:${status}`,
    load,
    errorMessage: "Jobs unavailable.",
  });

  return (
    <div>
      <div>
        <p className="text-sm font-semibold text-[#5f8d11]">
          Service fulfilment
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-title">
          {audience === "client" ? "My jobs" : "Active jobs"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
          {audience === "client"
            ? "Track assigned professionals, progress, approvals, evidence, and completion."
            : "Coordinate field work, assignments, evidence, changes, and client confirmation."}
        </p>
      </div>

      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-2"
        aria-label="Job status filter"
      >
        {(["ALL", ...jobStatuses] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={cn(
              "min-h-10 shrink-0 rounded-full border px-4 text-xs font-semibold",
              status === item
                ? "border-[#8eb81d] bg-[#eff9c9]"
                : "border-black/8 bg-white text-[#68717b]",
            )}
          >
            {item === "ALL" ? "All" : item.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Jobs need attention"
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
          title="No jobs in this view"
          description={
            status === "ALL"
              ? "Confirmed bookings will appear here as actionable jobs."
              : "Choose another status to see the rest of the work."
          }
        />
      ) : null}
      {items && items.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {items.map((job) => (
            <Link
              key={job.id}
              href={`/${audience}/jobs/${job.id}`}
              className="rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Surface className="p-5 shadow-none transition-colors hover:border-[#b5d657] sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <Badge variant={statusVariant(job.status)}>
                      {job.status.replaceAll("_", " ")}
                    </Badge>
                    <h2 className="mt-3 text-lg font-bold">
                      {job.serviceName}
                    </h2>
                    <p className="mt-1 text-sm text-[#68717b]">
                      {audience === "client"
                        ? job.providerName
                        : job.clientName}
                    </p>
                  </div>
                  <p className="font-bold">
                    {formatMoney(job.totalMinor, job.currency)}
                  </p>
                </div>
                <div className="mt-5 grid gap-3 text-sm text-[#59646e] sm:grid-cols-3">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="size-4 text-[#5f8d11]" />
                    {job.scheduledStartsAt
                      ? new Date(job.scheduledStartsAt).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Schedule pending"}
                  </p>
                  <p className="flex items-center gap-2">
                    <UsersRound className="size-4 text-[#5f8d11]" />
                    {job.assignmentNames.length
                      ? job.assignmentNames.join(", ")
                      : "Unassigned"}
                  </p>
                  <p className="flex items-center gap-2">
                    <CircleDollarSign className="size-4 text-[#5f8d11]" />
                    Approved total
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

function statusVariant(status: JobStatus) {
  if (status === "COMPLETED") return "trust" as const;
  if (["CANCELLED", "DISPUTED"].includes(status)) return "danger" as const;
  if (
    [
      "ON_HOLD",
      "RETURN_VISIT_REQUIRED",
      "AWAITING_CLIENT_CONFIRMATION",
    ].includes(status)
  ) {
    return "warning" as const;
  }
  return "success" as const;
}

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}
