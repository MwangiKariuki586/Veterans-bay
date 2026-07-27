"use client";

import {
  ArrowRight,
  BadgeCheck,
  Heart,
  MapPin,
  Store,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import type { SavedProfessional } from "@/modules/saved-professionals/types";

export function ClientSavedProfessionalsPage() {
  const [request, setRequest] = useState<{
    loading: boolean;
    error: string | null;
    items: SavedProfessional[];
  }>({ loading: true, error: null, items: [] });
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/v1/client/saved-professionals", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          data?: SavedProfessional[];
          error?: { message?: string };
        } | null;
        if (!response.ok || !Array.isArray(body?.data)) {
          throw new Error(
            body?.error?.message ?? "Saved professionals could not be loaded.",
          );
        }
        setRequest({ loading: false, error: null, items: body.data });
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setRequest({
          loading: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Saved professionals could not be loaded.",
          items: [],
        });
      });
    return () => controller.abort();
  }, [retry]);

  async function removeSaved(item: SavedProfessional) {
    if (removing.has(item.slug)) return;
    setRemoving((current) => new Set(current).add(item.slug));
    try {
      const response = await fetch(
        `/api/v1/client/saved-professionals/${encodeURIComponent(item.slug)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          body?.error?.message ?? "The professional could not be removed.",
        );
      }
      setRequest((current) => ({
        ...current,
        items: current.items.filter((saved) => saved.slug !== item.slug),
      }));
      toast.success("Removed from saved.");
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "The professional could not be removed.",
      );
    } finally {
      setRemoving((current) => {
        const next = new Set(current);
        next.delete(item.slug);
        return next;
      });
    }
  }

  return (
    <div>
      <nav className="text-sm text-[#68717b]" aria-label="Breadcrumb">
        <Link href="/client" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">›</span>
        <span className="text-foreground">Saved professionals</span>
      </nav>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.045em]">
            Saved professionals
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#68717b]">
            Keep trusted professionals close for your next service request.
          </p>
        </div>
        <Link
          href="/marketplace"
          className={cn(buttonVariants(), "rounded-full")}
        >
          Find professionals
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6">
        {request.loading ? (
          <StatePanel
            variant="loading"
            title="Loading saved professionals"
            description="Retrieving your latest saved professionals."
            className="min-h-72"
          />
        ) : request.error ? (
          <StatePanel
            variant="error"
            title="Saved professionals unavailable"
            description={request.error}
            actionLabel="Try again"
            onAction={() => {
              setRequest((current) => ({
                ...current,
                loading: true,
                error: null,
              }));
              setRetry((current) => current + 1);
            }}
            className="min-h-72"
          />
        ) : request.items.length === 0 ? (
          <StatePanel
            variant="empty"
            title="No saved professionals yet"
            description="Save a professional from the marketplace to find them here."
            className="min-h-72"
          >
            <Link
              href="/marketplace"
              className={buttonVariants({ size: "sm", variant: "secondary" })}
            >
              Browse marketplace
            </Link>
          </StatePanel>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {request.items.map((item) => (
              <Surface key={item.slug} className="p-5 shadow-none">
                <div className="flex items-start gap-4">
                  <div className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#eef8c8] text-[#5f8d11]">
                    {item.logoUrl ? (
                      <Image
                        src={item.logoUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    ) : (
                      <Store className="size-6" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold">{item.businessName}</h2>
                        <p className="mt-1 text-xs font-semibold text-[#5f8d11]">
                          {item.primaryCategory ?? "Home services"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={removing.has(item.slug)}
                        onClick={() => removeSaved(item)}
                        aria-label={`Remove ${item.businessName} from saved`}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[0.68rem] font-semibold">
                      {item.verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8c8] px-2.5 py-1 text-[#5f8d11]">
                          <BadgeCheck className="size-3.5" aria-hidden="true" />
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                          Not yet verified
                        </span>
                      )}
                      <span className="rounded-full bg-[#f7f9fa] px-2.5 py-1">
                        {item.serviceCount} published{" "}
                        {item.serviceCount === 1 ? "service" : "services"}
                      </span>
                    </div>
                  </div>
                </div>
                {item.description ? (
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-[#68717b]">
                    {item.description}
                  </p>
                ) : null}
                {item.operatingLocation ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#68717b]">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {item.operatingLocation}
                  </p>
                ) : null}
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/8 pt-4">
                  <span className="inline-flex items-center gap-1.5 text-xs text-[#5f8d11]">
                    <Heart className="size-3.5 fill-current" aria-hidden="true" />
                    Saved
                  </span>
                  <Link
                    href={`/professionals/${item.slug}`}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "rounded-full",
                    )}
                  >
                    View profile
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </Surface>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
