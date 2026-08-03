"use client";

import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  FileCheck2,
  MapPin,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { AdminProfessionalReviewQueue } from "@/modules/professional-onboarding/types";

const reviewStatuses = [
  ["pending_review", "Pending review"],
  ["requires_changes", "Changes requested"],
  ["active", "Approved"],
  ["suspended", "Suspended"],
  ["deactivated", "Rejected"],
] as const;

const badgeTone = {
  pending_review: "warning",
  requires_changes: "info",
  active: "success",
  deactivated: "danger",
  suspended: "danger",
  draft: "neutral",
} as const;

export function ProfessionalReviewQueue() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const status = params.get("status") ?? "pending_review";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [retry, setRetry] = useState(0);
  const requestKey = `${searchKey}:${retry}`;
  const [request, setRequest] = useState<{
    key: string;
    data: AdminProfessionalReviewQueue | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const loading = request.key !== requestKey;
  const data = loading ? null : request.data;
  const error = loading ? null : request.error;

  useEffect(() => {
    const controller = new AbortController();
    const apiParams = new URLSearchParams({
      status,
      page: params.get("page") ?? "1",
      pageSize: "10",
    });
    const q = params.get("q");
    if (q) apiParams.set("q", q);

    void fetch(`/api/v1/admin/professionals?${apiParams}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: AdminProfessionalReviewQueue;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(
            body?.error?.message ?? "The professional review queue could not be loaded.",
          );
        }
        setRequest({ key: requestKey, data: body.data, error: null });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRequest({
          key: requestKey,
          data: null,
          error:
            cause instanceof Error
              ? cause.message
              : "The professional review queue could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [params, requestKey, status]);

  function updateUrl(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/admin/professionals${next.size ? `?${next}` : ""}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({ q: search.trim() || null, page: null });
  }

  return (
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/admin" className="hover:text-foreground">
          Administration
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-foreground">Professional reviews</span>
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">
            Marketplace assurance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-title">
            Professional reviews
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Review submitted evidence and make traceable marketplace decisions.
          </p>
        </div>
        <form
          role="search"
          onSubmit={submitSearch}
          className="flex min-h-11 w-full max-w-sm items-center rounded-full border border-black/8 bg-white pr-1 pl-4 sm:w-auto"
        >
          <Search className="size-4 text-[#68717b]" aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search professional reviews"
            placeholder="Name, category, or location"
            minLength={2}
            maxLength={120}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          />
          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto border-b border-black/8">
        {reviewStatuses.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              updateUrl({ status: value === "pending_review" ? null : value, page: null })
            }
            aria-pressed={status === value}
            className={`shrink-0 border-b-2 px-2 pb-3 text-sm font-semibold ${
              status === value
                ? "border-[#5f8d11] text-foreground"
                : "border-transparent text-[#68717b]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {loading ? (
          <StatePanel
            variant="loading"
            title="Loading review queue"
            description="Retrieving current professional applications."
            className="min-h-72"
          />
        ) : error ? (
          <StatePanel
            variant="error"
            title="Review queue unavailable"
            description={error}
            actionLabel="Try again"
            onAction={() => setRetry((current) => current + 1)}
            className="min-h-72"
          />
        ) : data && data.items.length === 0 ? (
          <StatePanel
            variant={params.get("q") ? "filtered" : "empty"}
            title={
              params.get("q")
                ? "No applications match this search"
                : "No applications in this queue"
            }
            description={
              params.get("q")
                ? "Try a broader name, category, or location."
                : "Applications will appear here when they reach this review state."
            }
            className="min-h-72"
          />
        ) : data ? (
          <>
            <div className="grid gap-4">
              {data.items.map((item) => (
                <Surface key={item.organisationId} className="p-5 shadow-none">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold">{item.name}</h2>
                        <Badge variant={badgeTone[item.status]}>
                          {item.status.replaceAll("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#68717b]">
                        <span className="inline-flex items-center gap-1.5">
                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                          {item.primaryCategory ?? "Category not supplied"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-3.5" aria-hidden="true" />
                          {item.operatingLocation ?? "Location not supplied"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <FileCheck2 className="size-3.5" aria-hidden="true" />
                          {item.evidenceCount} evidence{" "}
                          {item.evidenceCount === 1 ? "file" : "files"}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {item.submittedAt
                            ? `Submitted ${new Date(item.submittedAt).toLocaleDateString()}`
                            : `Updated ${new Date(item.updatedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/professionals/${item.organisationId}`}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold"
                    >
                      Review application
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </Surface>
              ))}
            </div>
            {data.totalPages > 1 ? (
              <div className="mt-6">
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  totalItems={data.totalItems}
                  totalPages={data.totalPages}
                  onPrevious={() =>
                    updateUrl({ page: String(Math.max(1, data.page - 1)) })
                  }
                  onNext={() =>
                    updateUrl({ page: String(Math.min(data.totalPages, data.page + 1)) })
                  }
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
