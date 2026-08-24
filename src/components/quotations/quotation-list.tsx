"use client";

import { ArrowRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { formatQuotationMoney } from "./quotation-view";
import { listQuotations, type QuotationPage } from "./quotation-api";

export function QuotationList({
  audience,
}: {
  audience: "client" | "professional";
}) {
  const [result, setResult] = useState<QuotationPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listQuotations(audience)
      .then(setResult)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Quotations could not be loaded.",
        ),
      );
  }, [audience]);

  const basePath =
    audience === "client" ? "/client/quotations" : "/professional/quotations";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            {audience === "client" ? "Client workspace" : "Professional workspace"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            Quotations
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            {audience === "client"
              ? "Review formal scope, pricing, timing, warranty, and payment terms."
              : "Prepare versioned commercial terms and track client decisions."}
          </p>
        </div>
        {audience === "professional" ? (
          <Link
            href="/professional/enquiries"
            className={buttonVariants({ variant: "primary" })}
          >
            <Plus className="size-4" /> Select an enquiry
          </Link>
        ) : null}
      </div>

      {error ? (
        <InlineAlert
          className="mt-6"
          variant="error"
          title="Quotations unavailable"
          description={error}
        />
      ) : !result ? (
        <div className="mt-6 grid gap-4" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : result.items.length === 0 ? (
        <StatePanel
          className="mt-6"
          variant="empty"
          icon={<FileText className="size-5" />}
          title="No quotations yet"
          description={
            audience === "client"
              ? "Submitted quotations from professionals will appear here."
              : "Open an eligible enquiry to prepare the first quotation."
          }
        />
      ) : (
        <Surface className="mt-6 overflow-hidden p-0 shadow-none">
          {result.items.map((quotation) => (
            <Link
              key={quotation.id}
              href={`${basePath}/${quotation.id}`}
              className="group grid gap-4 border-b border-black/8 p-5 last:border-0 hover:bg-[#fbfcf9] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      quotation.status === "ACCEPTED"
                        ? "trust"
                        : quotation.status === "DRAFT"
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {quotation.status.replaceAll("_", " ")}
                  </Badge>
                  <span className="text-xs text-[#7a838c]">
                    Version {quotation.currentVersionNumber}
                  </span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">
                  {quotation.requestCategory}
                </h2>
                <p className="mt-1 text-sm text-[#68717b]">
                  {audience === "client"
                    ? quotation.providerName
                    : quotation.clientName}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-semibold">
                  {formatQuotationMoney(
                    quotation.currentTotalMinor,
                    quotation.currency,
                  )}
                </p>
                <span className="mt-2 inline-flex items-center gap-2 text-sm font-semibold">
                  Open <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </Surface>
      )}
    </div>
  );
}
