import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button";

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function Pagination({
  onNext,
  onPrevious,
  page,
  pageSize,
  totalItems,
  totalPages,
}: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={onPrevious}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous
      </Button>
      <div className="grid justify-items-center gap-0.5 text-center" aria-live="polite">
        <p className="text-sm text-muted-foreground">
          Page <strong className="text-foreground">{page}</strong> of {totalPages}
        </p>
        {typeof totalItems === "number" && typeof pageSize === "number" ? (
          <p className="text-xs text-muted-foreground">
            {totalItems} item{totalItems === 1 ? "" : "s"} · {pageSize} per page
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
