import { fireEvent, render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "./badge";
import { Button } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { InlineAlert } from "./inline-alert";
import { Input } from "./input";
import { Label } from "./label";
import { Pagination } from "./pagination";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "./sheet";
import { StatePanel } from "./state-panel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

describe("shared UI primitives", () => {
  it("associates visible labels with their fields", () => {
    render(
      <div>
        <Label htmlFor="service">Service</Label>
        <Input id="service" />
      </div>,
    );

    expect(screen.getByLabelText("Service")).toBeInstanceOf(HTMLInputElement);
  });

  it("exposes and disables a loading button", () => {
    render(<Button loading>Saving</Button>);

    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("slots a linked button with multiple child elements", () => {
    render(
      <Button asChild>
        <Link href="/professional/quotations/new">
          <span aria-hidden="true">+</span>
          Prepare quotation
        </Link>
      </Button>,
    );

    expect(
      screen.getByRole("link", { name: "Prepare quotation" }),
    ).toHaveAttribute("href", "/professional/quotations/new");
  });

  it("keeps status meaning available as text", () => {
    render(<Badge variant="success">Complete</Badge>);

    expect(screen.getByText("Complete")).toBeVisible();
  });

  it("announces inline errors and invokes recovery", () => {
    const onAction = vi.fn();
    render(
      <StatePanel
        variant="error"
        title="Unable to load"
        description="Try again."
        actionLabel="Retry"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Unable to load").closest("section")).toHaveAttribute(
      "aria-live",
      "assertive",
    );
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("renders permission and stale conflict feedback states", () => {
    const { rerender } = render(
      <StatePanel
        variant="permission"
        title="Access denied"
        description="You need another role."
      />,
    );
    expect(screen.getByText("Access denied").closest("section")).toHaveAttribute(
      "aria-live",
      "assertive",
    );

    rerender(
      <StatePanel
        variant="stale"
        title="Record changed"
        description="Refresh and retry."
        actionLabel="Refresh"
      />,
    );
    expect(screen.getByText("Record changed")).toBeVisible();
  });

  it("shows critical errors inline with an optional request id", () => {
    render(
      <InlineAlert
        variant="error"
        title="Unable to save"
        description="Fix the highlighted fields."
        requestId="req-123"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save");
    expect(screen.getByText(/Reference: req-123/)).toBeVisible();
  });

  it("requires confirmation before consequential actions", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>Delete</Button>}
        title="Delete this item?"
        description="This cannot be undone from the UI."
        confirmLabel="Delete item"
        tone="danger"
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("bounds pagination controls", () => {
    const onNext = vi.fn();
    render(
      <Pagination
        page={1}
        totalPages={3}
        totalItems={45}
        pageSize={20}
        onNext={onNext}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByText(/45 items/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("opens and closes an accessible confirmation dialog", () => {
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open confirmation</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Confirm request</DialogTitle>
          <DialogDescription>Review this action before continuing.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open confirmation" }));
    expect(screen.getByRole("dialog", { name: "Confirm request" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Confirm request" })).toBeNull();
  });

  it("opens a labelled navigation sheet", () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open menu</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Veterans Bay links</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  });

  it("supports keyboard access to dropdown actions", () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>More options</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>View details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole("button", { name: "More options" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("menuitem", { name: "View details" })).toBeVisible();
  });

  it("reveals tooltip help on keyboard focus", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button aria-label="Request help">Help</Button>
          </TooltipTrigger>
          <TooltipContent>Request guidance</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Request help" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Request guidance");
  });
});
