"use client";

import { AuthFlipPanel } from "@/components/auth/auth-flip-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthFlipPanel />
      {children}
    </>
  );
}
