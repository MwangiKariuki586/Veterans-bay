"use client";

import { flexRender } from "@tanstack/react-table";
import type { RowData } from "@tanstack/table-core";
import {
  getCoreRowModel,
  type LegacyColumnDef,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export function DataTable<TData extends RowData>({
  columns,
  data,
  empty,
  mobileRow,
  className,
  getRowId,
  onRowClick,
  getRowLabel,
  loading = false,
  loadingLabel = "Loading items",
}: {
  columns: LegacyColumnDef<TData, unknown>[];
  data: TData[];
  empty: ReactNode;
  mobileRow?: (row: TData) => ReactNode;
  className?: string;
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  getRowLabel?: (row: TData) => string;
  loading?: boolean;
  loadingLabel?: string;
}) {
  const table = useLegacyTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  if (!loading && data.length === 0) return <>{empty}</>;

  return (
    <>
      {loading ? <span className="sr-only" role="status">{loadingLabel}</span> : null}
      <div className={cn("hidden overflow-x-auto lg:block", className)}>
        <table className="w-full min-w-[1040px] border-collapse text-left">
          <thead className="border-y border-black/6 bg-[#fbfcfd]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="h-10 px-4 text-[0.68rem] font-semibold text-[#536170]"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-black/6" aria-busy={loading}>
            {loading ? Array.from({ length: 4 }, (_, rowIndex) => (
              <tr key={rowIndex} aria-hidden="true">
                {table.getVisibleLeafColumns().map((column, columnIndex) => (
                  <td key={column.id} className="h-[62px] px-4 py-2">
                    <Skeleton className={cn("h-3 rounded-full", columnIndex === 0 ? "w-4/5" : "w-2/3")} />
                    {columnIndex < 2 ? <Skeleton className="mt-2 h-2.5 w-1/2 rounded-full" /> : null}
                  </td>
                ))}
              </tr>
            )) : table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "transition-colors hover:bg-[#fafcf8]",
                  onRowClick && "cursor-pointer focus-visible:bg-[#fafcf8] focus-visible:outline-none",
                )}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? getRowLabel?.(row.original) : undefined}
                onClick={(event) => {
                  if (!onRowClick || isInteractiveTarget(event.target)) return;
                  onRowClick(row.original);
                }}
                onKeyDown={(event) => {
                  if (!onRowClick || isInteractiveTarget(event.target)) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="h-[62px] px-4 py-2 text-[0.72rem] align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileRow ? (
        <div className="grid gap-3 p-3 lg:hidden" aria-busy={loading}>
          {loading ? Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="rounded-[14px] border border-black/8 bg-white p-4" aria-hidden="true">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/4 rounded-full" />
                  <Skeleton className="mt-2 h-3 w-1/2 rounded-full" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Skeleton className="h-3 w-4/5 rounded-full" />
                <Skeleton className="h-3 w-3/4 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-3 w-1/3 rounded-full" />
            </div>
          )) : table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              className={cn(onRowClick && "cursor-pointer rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              aria-label={onRowClick ? getRowLabel?.(row.original) : undefined}
              onClick={(event) => {
                if (!onRowClick || isInteractiveTarget(event.target)) return;
                onRowClick(row.original);
              }}
              onKeyDown={(event) => {
                if (!onRowClick || isInteractiveTarget(event.target)) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row.original);
                }
              }}
            >
              {mobileRow(row.original)}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(
    target.closest("a, button, input, select, textarea, [role='menuitem']"),
  );
}

export type { LegacyColumnDef as DataTableColumnDef } from "@tanstack/react-table/legacy";
