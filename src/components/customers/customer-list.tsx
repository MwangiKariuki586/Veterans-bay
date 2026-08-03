"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import {
  getCachedResource,
  setCachedResource,
} from "@/lib/client-resource-cache";
import { cn } from "@/lib/utils";
import type { CustomerPage } from "@/modules/customers/types";
import { listCustomers } from "./customer-api";

export function CustomerList() {
  const [search, setSearch] = useState("");
  const cacheKey = `search:${search}`;
  const cached = getCachedResource<CustomerPage>("customers-list", cacheKey);
  const [page, setPage] = useState<CustomerPage | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const hit = getCachedResource<CustomerPage>(
        "customers-list",
        `search:${search}`,
      );
      if (hit) setPage(hit);

      const query = new URLSearchParams({
        page: "1",
        pageSize: "20",
        ...(search ? { search } : {}),
      });
      void listCustomers(query.toString())
        .then((data) => {
          setCachedResource("customers-list", `search:${search}`, data);
          setPage(data);
          setError(null);
        })
        .catch((e) =>
          setError(e instanceof Error ? e.message : "Customers unavailable."),
        );
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input
          aria-label="Search customers"
          placeholder="Search name, email, or phone"
          className="max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link
          href="/professional/customers/new"
          className={cn(buttonVariants())}
        >
          Add customer
        </Link>
      </div>
      {error ? (
        <StatePanel
          variant="error"
          title="Customers unavailable"
          description={error}
        />
      ) : !page ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[22px]" />
          ))}
        </div>
      ) : page.items.length === 0 ? (
        <StatePanel
          title={search ? "No matching customers" : "No customers yet"}
          description={
            search
              ? "Try a different name, email, or phone."
              : "Add an existing customer or accept a marketplace booking to begin."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {page.items.map((customer) => (
            <Link
              key={customer.id}
              href={`/professional/customers/${customer.id}`}
            >
              <Surface className="h-full p-5 shadow-none transition hover:border-[#9ac62b]">
                <div className="flex justify-between gap-3">
                  <h2 className="font-bold">{customer.displayName}</h2>
                  <span className="text-xs font-semibold text-[#5f8d11]">
                    {customer.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#68717b]">
                  {customer.email ?? customer.phone}
                </p>
                <p className="mt-3 text-xs text-[#68717b]">
                  {customer.acquisitionSource.replaceAll("_", " ")}
                </p>
                {customer.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {customer.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-[#eef8c8] px-2.5 py-1 text-xs font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {customer.duplicateOfCustomerId ? (
                  <p className="mt-3 text-xs font-semibold text-amber-700">
                    Duplicate candidate — review before use
                  </p>
                ) : null}
              </Surface>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
