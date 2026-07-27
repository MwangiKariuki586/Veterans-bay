"use client";

import { FolderCog, Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { MarketplaceCategorySummary } from "@/modules/marketplace-moderation/types";

async function fetchCategories() {
  const response = await fetch("/api/v1/admin/categories", {
    credentials: "include",
  });
  const body = (await response.json().catch(() => null)) as {
    data?: MarketplaceCategorySummary[];
    error?: { message?: string };
  } | null;
  if (!response.ok || !body?.data) {
    throw new Error(body?.error?.message ?? "Categories could not be loaded.");
  }
  return body.data;
}

export function MarketplaceCategoryManager() {
  const [categories, setCategories] = useState<MarketplaceCategorySummary[] | null>(
    null,
  );
  const [name, setName] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCategories()
      .then(setCategories)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Categories could not be loaded."),
      );
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || busy) return;
    setBusy("create");
    setError(null);
    try {
      const response = await fetch("/api/v1/admin/categories", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "The category could not be created.");
      }
      setCategories(await fetchCategories());
      setName("");
      toast.success("Marketplace category created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The category could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(category: MarketplaceCategorySummary) {
    const reason = reasons[category.id]?.trim() ?? "";
    if (reason.length < 5 || busy) return;
    setBusy(category.id);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/admin/categories/${category.id}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: category.status === "active" ? "deactivate" : "activate",
            reason,
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "The category status could not be changed.");
      }
      setCategories(await fetchCategories());
      setReasons((current) => ({ ...current, [category.id]: "" }));
      toast.success("Category status updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The category status could not be changed.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!categories && !error) {
    return (
      <StatePanel
        variant="loading"
        title="Loading categories"
        description="Retrieving the current marketplace taxonomy."
        className="min-h-72"
      />
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[#5f8d11]">Marketplace structure</p>
      <h1 className="mt-2 text-3xl font-bold tracking-[-0.045em]">
        Service categories
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        Maintain the categories exposed to marketplace discovery.
      </p>

      {error ? (
        <InlineAlert
          className="mt-5"
          variant="error"
          title="Category action failed"
          description={error}
        />
      ) : null}

      <Surface className="mt-6 p-5 shadow-none">
        <form onSubmit={createCategory} className="flex flex-col gap-3 sm:flex-row">
          <label className="min-w-0 flex-1 text-sm font-semibold">
            New category name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              className="mt-2 h-11 w-full rounded-xl border border-black/8 px-3"
            />
          </label>
          <Button
            type="submit"
            className="sm:self-end"
            disabled={name.trim().length < 2 || Boolean(busy)}
            loading={busy === "create"}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add category
          </Button>
        </form>
      </Surface>

      {categories?.length ? (
        <div className="mt-5 grid gap-4">
          {categories.map((category) => {
            const activating = category.status === "inactive";
            const reason = reasons[category.id] ?? "";
            return (
              <Surface key={category.id} className="p-5 shadow-none">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <FolderCog className="size-4 text-[#5f8d11]" aria-hidden="true" />
                      <h2 className="font-bold">{category.name}</h2>
                      <Badge variant={activating ? "neutral" : "success"}>
                        {category.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#68717b]">/{category.slug}</p>
                  </div>
                  <label className="min-w-0 flex-1 text-sm font-semibold">
                    Reason
                    <input
                      value={reason}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [category.id]: event.target.value,
                        }))
                      }
                      minLength={5}
                      maxLength={500}
                      placeholder="Required for status changes"
                      className="mt-2 h-11 w-full rounded-xl border border-black/8 px-3"
                    />
                  </label>
                  <ConfirmDialog
                    title={`${activating ? "Activate" : "Deactivate"} ${category.name}?`}
                    description={
                      activating
                        ? "This category will become available to marketplace discovery."
                        : "This category will no longer be offered for new discovery selections."
                    }
                    confirmLabel={activating ? "Activate" : "Deactivate"}
                    tone={activating ? "default" : "danger"}
                    onConfirm={() => void changeStatus(category)}
                    trigger={
                      <Button
                        type="button"
                        variant={activating ? "primary" : "outline"}
                        disabled={reason.trim().length < 5 || Boolean(busy)}
                        loading={busy === category.id}
                      >
                        {activating ? "Activate" : "Deactivate"}
                      </Button>
                    }
                  />
                </div>
              </Surface>
            );
          })}
        </div>
      ) : (
        <StatePanel
          variant="empty"
          title="No marketplace categories"
          description="Create the first category to establish the marketplace taxonomy."
          className="mt-5 min-h-64"
        />
      )}
    </div>
  );
}
