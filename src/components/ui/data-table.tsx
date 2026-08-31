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

export function DataTable<TData extends RowData>({
  columns,
  data,
  empty,
  mobileRow,
  className,
  getRowId,
  onRowClick,
  getRowLabel,
}: {
  columns: LegacyColumnDef<TData, unknown>[];
  data: TData[];
  empty: ReactNode;
  mobileRow?: (row: TData) => ReactNode;
  className?: string;
  getRowId?: (row: TData) => string;
  onRowClick?: (row: TData) => void;
  getRowLabel?: (row: TData) => string;
}) {
  const table = useLegacyTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  if (data.length === 0) return <>{empty}</>;

  return (
    <>
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
          <tbody className="divide-y divide-black/6">
            {table.getRowModel().rows.map((row) => (
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
        <div className="grid gap-3 p-3 lg:hidden">
          {table.getRowModel().rows.map((row) => (
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
