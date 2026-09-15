"use client";

import { AuthFlipPanel } from "@/components/auth/auth-flip-panel";
import { Suspense } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <AuthFlipPanel />
      </Suspense>
      {children}
    </>
  );
}
