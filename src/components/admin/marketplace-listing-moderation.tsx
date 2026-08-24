"use client";

import { Eye, EyeOff, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Pagination } from "@/components/ui/pagination";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { ModeratedListingPage } from "@/modules/marketplace-moderation/types";

export function MarketplaceListingModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const status = params.get("status") ?? "all";
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${searchKey}:${retry}`;
  const [request, setRequest] = useState<{
    key: string;
    data: ModeratedListingPage | null;
    error: string | null;
  }>({ key: "", data: null, error: null });
  const loading = request.key !== requestKey;
  const data = loading ? null : request.data;
  const error = loading ? null : request.error;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      status,
      page: params.get("page") ?? "1",
      pageSize: "10",
    });
    if (params.get("q")) query.set("q", params.get("q")!);
    void fetch(`/api/v1/admin/marketplace/listings?${query}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: ModeratedListingPage;
          error?: { message?: string };
        } | null;
        if (!response.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Listings could not be loaded.");
        }
        setRequest({ key: requestKey, data: body.data, error: null });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRequest({
          key: requestKey,
          data: null,
          error: cause instanceof Error ? cause.message : "Listings could not be loaded.",
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
    router.push(`/admin/marketplace/listings${next.size ? `?${next}` : ""}`);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateUrl({ q: search.trim() || null, page: null });
  }

  async function moderate(serviceId: string, hidden: boolean) {
    const reason = reasons[serviceId]?.trim() ?? "";
    if (reason.length < 5 || busy) return;
    setBusy(serviceId);
    try {
      const response = await fetch(
        `/api/v1/admin/marketplace/listings/${serviceId}/moderation`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: hidden ? "restore" : "hide", reason }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "The listing could not be moderated.");
      }
      setReasons((current) => ({ ...current, [serviceId]: "" }));
      setRetry((current) => current + 1);
      toast.success(hidden ? "Listing restored." : "Listing hidden.");
    } catch (cause) {
      setRequest({
        key: requestKey,
        data: request.data,
        error:
          cause instanceof Error ? cause.message : "The listing could not be moderated.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#5f8d11]">Marketplace assurance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-title">
            Listing moderation
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
            Hide or restore published services with a permanent, traceable reason.
          </p>
        </div>
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <label className="sr-only" htmlFor="listing-search">Search listings</label>
          <div className="flex h-11 items-center rounded-full border border-black/8 bg-white px-4">
            <Search className="size-4 text-[#68717b]" aria-hidden="true" />
            <input
              id="listing-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Service, provider, category"
              className="w-56 bg-transparent px-3 text-sm outline-none"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>
      </div>

      <div className="mt-6 flex gap-2 border-b border-black/8">
        {(["all", "visible", "hidden"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => updateUrl({ status: value === "all" ? null : value, page: null })}
            aria-pressed={status === value}
            className={`border-b-2 px-3 pb-3 text-sm font-semibold ${
              status === value
                ? "border-[#5f8d11] text-foreground"
                : "border-transparent text-[#68717b]"
            }`}
          >
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <StatePanel variant="loading" title="Loading listings" description="Retrieving published marketplace services." className="mt-5 min-h-72" />
      ) : error ? (
        <StatePanel variant="error" title="Listing action failed" description={error} actionLabel="Try again" onAction={() => setRetry((current) => current + 1)} className="mt-5 min-h-72" />
      ) : data?.items.length ? (
        <>
          <div className="mt-5 grid gap-4">
            {data.items.map((item) => {
              const hidden = item.moderationStatus === "hidden";
              const reason = reasons[item.id] ?? "";
              return (
                <Surface key={item.id} className="p-5 shadow-none">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)_auto] xl:items-end">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{item.name}</h2>
                        <Badge variant={hidden ? "danger" : "success"}>
                          {hidden ? "hidden" : "visible"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-[#68717b]">
                        {item.organisationName} · {item.category ?? "No category"}
                      </p>
                      {item.moderationReason ? (
                        <InlineAlert
                          className="mt-3"
                          variant="info"
                          title="Latest moderation reason"
                          description={item.moderationReason}
                        />
                      ) : null}
                    </div>
                    <label className="text-sm font-semibold">
                      Decision reason
                      <textarea
                        value={reason}
                        onChange={(event) =>
                          setReasons((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        rows={3}
                        minLength={5}
                        maxLength={500}
                        className="mt-2 w-full rounded-xl border border-black/8 p-3 text-sm"
                      />
                    </label>
                    <ConfirmDialog
                      title={`${hidden ? "Restore" : "Hide"} ${item.name}?`}
                      description={
                        hidden
                          ? "The service becomes eligible for public discovery again."
                          : "The service disappears from public discovery immediately."
                      }
                      confirmLabel={hidden ? "Restore listing" : "Hide listing"}
                      tone={hidden ? "default" : "danger"}
                      onConfirm={() => void moderate(item.id, hidden)}
                      trigger={
                        <Button
                          type="button"
                          variant={hidden ? "primary" : "outline"}
                          disabled={reason.trim().length < 5 || Boolean(busy)}
                          loading={busy === item.id}
                        >
                          {hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                          {hidden ? "Restore listing" : "Hide listing"}
                        </Button>
                      }
                    />
                  </div>
                </Surface>
              );
            })}
          </div>
          {data.totalPages > 1 ? (
            <div className="mt-6">
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                totalItems={data.totalItems}
                totalPages={data.totalPages}
                onPrevious={() => updateUrl({ page: String(Math.max(1, data.page - 1)) })}
                onNext={() => updateUrl({ page: String(Math.min(data.totalPages, data.page + 1)) })}
              />
            </div>
          ) : null}
        </>
      ) : (
        <StatePanel
          variant={params.get("q") ? "filtered" : "empty"}
          title={params.get("q") ? "No listings match this search" : "No listings in this view"}
          description="Published marketplace services will appear here when eligible."
          className="mt-5 min-h-72"
        />
      )}
    </div>
  );
}
