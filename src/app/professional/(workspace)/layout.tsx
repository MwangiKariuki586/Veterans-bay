"use client";

import type { ReactNode } from "react";

import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";

export default function ProfessionalWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthenticatedShell kind="professional" hideIntro>
      {children}
    </AuthenticatedShell>
  );
}
