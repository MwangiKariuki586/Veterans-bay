"use client";

import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ClientWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthenticatedShell kind="client" hideIntro>
      {children}
    </AuthenticatedShell>
  );
}
