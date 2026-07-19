"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={300}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "!rounded-lg !border-border !bg-surface !text-foreground",
            description: "!text-muted-foreground",
          },
        }}
      />
    </TooltipProvider>
  );
}
