"use client";

import { ChevronDown, Info, Menu, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function UiFoundationPreview() {
  const [page, setPage] = useState(1);

  return (
    <main className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-4 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full border border-border bg-surface-subtle font-extrabold">
            VB
          </span>
          <div>
            <p className="font-bold">Veterans Bay</p>
            <p className="text-xs text-muted-foreground">UI foundation preview</p>
          </div>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open preview menu">
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent aria-describedby="preview-menu-description">
            <SheetTitle className="pr-10 text-xl font-bold">Shared patterns</SheetTitle>
            <SheetDescription
              id="preview-menu-description"
              className="mt-2 text-sm leading-6 text-muted-foreground"
            >
              This sheet demonstrates the responsive navigation surface used by
              future workspace experiences.
            </SheetDescription>
            <nav className="mt-7 grid gap-2" aria-label="Preview sections">
              {['Controls', 'Status', 'Feedback', 'Loading'].map((item) => (
                <SheetClose asChild key={item}>
                  <Button variant="ghost" className="justify-start">
                    {item}
                  </Button>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </header>

      <section className="grid gap-3">
        <Badge variant="trust" className="w-fit">
          <ShieldCheck className="size-4" aria-hidden="true" />
          Shared visual language
        </Badge>
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl">
          Calm, trustworthy controls for the complete service journey.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Semantic tokens and accessible primitives derived from the approved
          Veterans Bay homepage reference.
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Surface className="grid gap-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Controls</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Primary, secondary, quiet, destructive, and processing states.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="About controls">
                  <Info className="size-5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard and touch accessible</TooltipContent>
            </Tooltip>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => toast.success('Authoritative success confirmed.')}>Primary action</Button>
            <Button variant="secondary">Strong action</Button>
            <Button variant="outline">Secondary action</Button>
            <Button variant="ghost">Quiet action</Button>
            <Button variant="danger">Destructive</Button>
            <Button loading>Processing</Button>
            <Button disabled>Disabled</Button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="service-search">Search for a service</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="service-search"
                  className="pl-11"
                  placeholder="Plumbing, electrical, cleaning…"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="invalid-field">Example validation state</Label>
              <Input
                id="invalid-field"
                aria-invalid="true"
                aria-describedby="invalid-field-error"
                defaultValue="Incomplete value"
              />
              <p id="invalid-field-error" className="text-sm text-danger">
                Add the missing required information.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Open confirmation</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm this action?</DialogTitle>
                  <DialogDescription>
                    Consequential changes require a clear explanation and an
                    explicit confirmation.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button onClick={() => toast.success('Action confirmed.')}>Confirm</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  More options
                  <ChevronDown className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>View details</DropdownMenuItem>
                <DropdownMenuItem>Share record</DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 h-px bg-border" />
                <DropdownMenuItem className="text-danger focus:bg-danger-soft">
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Surface>

        <div className="grid gap-6">
          <Surface className="grid gap-5 p-5 sm:p-7">
            <div>
              <h2 className="text-xl font-bold">Semantic status</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Text and icon meaning remains visible without colour.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Draft</Badge>
              <Badge variant="info">Scheduled</Badge>
              <Badge variant="trust">Trusted</Badge>
              <Badge variant="success">Complete</Badge>
              <Badge variant="warning">Attention required</Badge>
              <Badge variant="danger">Restricted</Badge>
            </div>
          </Surface>

          <Surface className="grid gap-5 p-5 sm:p-7">
            <div>
              <h2 className="text-xl font-bold">Loading structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Reduced-motion preferences disable the pulse animation.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="size-14 shrink-0 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          </Surface>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <StatePanel
          variant="loading"
          title="Loading requests"
          description="Fetching the latest service requests for this workspace."
        />
        <StatePanel
          title="No service requests yet"
          description="New requests will appear here when a client starts a service journey."
          actionLabel="Explore services"
        />
        <StatePanel
          variant="filtered"
          title="No matches for these filters"
          description="Try clearing a filter or broadening the date range."
          actionLabel="Clear filters"
        />
        <StatePanel
          variant="error"
          title="We could not load this section"
          description="The rest of the page is still available. Try this section again."
          actionLabel="Try again"
          onAction={() => toast.info("Retry requested.")}
        />
        <StatePanel
          variant="permission"
          title="You do not have access"
          description="Ask an organisation owner to grant the required permission."
        />
        <StatePanel
          variant="stale"
          title="This record changed"
          description="Someone else updated it while you were editing. Refresh before continuing."
          actionLabel="Refresh"
        />
        <StatePanel
          variant="unavailable"
          title="Temporarily unavailable"
          description="A required dependency is offline. Your work so far is preserved."
        />
        <StatePanel
          variant="success"
          title="Request submitted"
          description="Shown only after the server confirms authoritative success."
        />
        <StatePanel
          variant="processing"
          title="Processing upload"
          description="Keep this page open while the file finishes verification."
        />
      </section>

      <Surface className="grid gap-4 p-5 sm:p-7">
        <InlineAlert
          variant="error"
          title="Payment could not be recorded"
          description="Critical failures stay inline so they are not missed in a toast."
          requestId="req_example_123"
        />
        <ConfirmDialog
          trigger={<Button variant="danger">Remove member</Button>}
          title="Remove this team member?"
          description="They will lose workspace access immediately. This requires explicit confirmation."
          confirmLabel="Remove member"
          tone="danger"
          onConfirm={() => toast.success("Removal confirmed after success path.")}
        />
      </Surface>

      <Surface className="p-5 sm:p-7">
        <Pagination
          page={page}
          totalPages={3}
          totalItems={54}
          pageSize={20}
          onPrevious={() => setPage((value) => Math.max(1, value - 1))}
          onNext={() => setPage((value) => Math.min(3, value + 1))}
        />
      </Surface>
    </main>
  );
}
