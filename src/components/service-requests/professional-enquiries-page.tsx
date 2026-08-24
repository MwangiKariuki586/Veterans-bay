"use client";

import { ArrowRight, Inbox } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Surface } from "@/components/ui/surface";
import {
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import type { ClientServiceRequest } from "@/modules/service-requests/types";
import { requestApi } from "./request-api";

type EnquiryPage = {
  items: ClientServiceRequest[];
  totalItems: number;
};

export function ProfessionalEnquiriesPage() {
  const cached = getCachedResource<EnquiryPage>("enquiries-list", "all");
  const [result, setResult] = useState<EnquiryPage | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestApi<EnquiryPage>("/api/v1/professional/enquiries?pageSize=50")
      .then((data) => {
        setCachedResource("enquiries-list", "all", data);
        setResult(data);
        setError(null);
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Enquiries could not be loaded.",
        ),
      );
  }, []);

  return (
    <div>
      <p className="text-sm font-semibold text-[#5f8d11]">
        Professional workspace
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-title">
        Service enquiries
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        Qualify submitted client requirements, request clarification, and decide
        the appropriate next commercial step.
      </p>

      {error ? (
        <InlineAlert
          className="mt-6"
          variant="error"
          title="Enquiries unavailable"
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
            <Inbox className="size-5 text-[#5f8d11]" />
          </span>
          <h2 className="mt-4 text-xl font-semibold">No enquiries to review</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68717b]">
            New requests addressed to this organisation will appear here.
          </p>
        </Surface>
      ) : (
        <div className="mt-6 overflow-hidden rounded-[1.35rem] border border-black/8 bg-white">
          {result.items.map((request) => (
            <Link
              key={request.id}
              href={`/professional/enquiries/${request.id}`}
              className="group grid gap-4 border-b border-black/8 p-5 last:border-0 hover:bg-[#fbfcf9] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      request.status === "SUBMITTED" ? "warning" : "neutral"
                    }
                  >
                    {request.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-[#7a838c]">
                    {new Date(request.updatedAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">
                  {request.category || "Service enquiry"}
                </h2>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#68717b]">
                  {request.description}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#5f8d11]">
                  {request.location}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold">
                Review{" "}
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
