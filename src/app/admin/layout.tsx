"use client";

import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function AdminWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthenticatedShell kind="admin" hideIntro>
      {children}
    </AuthenticatedShell>
  );
}
