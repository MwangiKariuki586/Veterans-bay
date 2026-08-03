"use client";

import { ArrowRight, ClipboardList, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { ClientServiceRequest } from "@/modules/service-requests/types";
import { requestApi } from "./request-api";

type RequestPage = {
  items: ClientServiceRequest[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const statusLabel: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFORMATION_REQUIRED: "More information required",
  ASSESSMENT_REQUIRED: "Assessment required",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export function ClientRequestsPage() {
  const [result, setResult] = useState<RequestPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestApi<RequestPage>("/api/v1/client/requests?pageSize=50")
      .then(setResult)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Requests could not be loaded.",
        ),
      );
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">Client requests</p>
          <h1 className="mt-2 text-3xl font-bold tracking-title">
            Your service requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Save requirements as a draft, submit when ready, and track every
            professional response from one place.
          </p>
        </div>
        <Link
          href="/client/requests/new"
          className={cn(buttonVariants(), "h-11 rounded-full px-5")}
        >
          <Plus className="size-4" /> New request
        </Link>
      </div>

      {error ? (
        <InlineAlert
          className="mt-6"
          variant="error"
          title="Requests unavailable"
          description={error}
        />
      ) : !result ? (
        <div className="mt-6 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <Surface className="mt-6 border-dashed p-9 text-center shadow-none">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef8c8]">
            <ClipboardList className="size-5 text-[#5f8d11]" />
          </span>
          <h2 className="mt-4 text-xl font-bold">No service requests yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68717b]">
            Tell us what needs doing. You can save incomplete details and return
            before sending them to a professional.
          </p>
          <Link
            href="/client/requests/new"
            className={cn(buttonVariants(), "mt-5 rounded-full")}
          >
            Create your first request
          </Link>
        </Surface>
      ) : (
        <div className="mt-6 space-y-3">
          {result.items.map((request) => (
            <Link
              key={request.id}
              href={`/client/requests/${request.id}`}
              className="group grid gap-4 rounded-[1.35rem] border border-black/8 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(17,31,44,0.08)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "DRAFT" ? "neutral" : "trust"}>
                    {statusLabel[request.status] ?? request.status}
                  </Badge>
                  <span className="text-xs text-[#7a838c]">
                    Updated {new Date(request.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="mt-3 truncate text-lg font-bold">
                  {request.category || "Untitled service request"}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#68717b]">
                  {request.description || "Add the work details before submitting."}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#5f8d11]">
                  {request.preferredProfessionalName || "Open request"}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                View request
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
