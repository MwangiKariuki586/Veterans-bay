"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicPageIntro, PublicShell } from "@/components/public/public-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { authClient } from "@/lib/auth-client";
import { loginHrefFor } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import type { PublicSession } from "@/modules/identity/types";

async function fetchSessions(): Promise<PublicSession[]> {
  const response = await fetch("/api/v1/account/sessions", {
    credentials: "include",
  });
  const body = (await response.json()) as {
    data?: PublicSession[];
    error?: { code?: string };
  };

  if (!response.ok || !body.data) {
    throw new Error(body.error?.code ?? "SESSIONS_UNAVAILABLE");
  }

  return body.data;
}

export function AccountSessionsPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) {
      return;
    }

    if (!session) {
      router.replace(loginHrefFor("/account/sessions"));
      return;
    }

    void fetchSessions()
      .then((data) => {
        setSessions(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Unable to load sessions.");
        setLoading(false);
      });
  }, [isPending, router, session]);

  async function revokeSession(sessionId: string) {
    const response = await fetch(`/api/v1/account/sessions/${sessionId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      toast.error("Unable to revoke that session.");
      return;
    }

    setSessions((current) => current.filter((item) => item.id !== sessionId));
    toast.success("Session revoked.");
  }

  return (
    <PublicShell>
      <main>
        <PublicPageIntro
          eyebrow="Account"
          title="Active sessions."
          description="Review and revoke signed-in devices. Session changes take effect immediately."
        />
        <div className="mx-auto mt-8 flex max-w-3xl justify-end">
          <Link
            href="/account/profile"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "rounded-full border-black/8",
            )}
          >
            Back to profile
          </Link>
        </div>
        <Surface className="mx-auto mt-6 max-w-3xl p-7 sm:p-9">
          {loading ? (
            <StatePanel
              variant="loading"
              title="Loading sessions"
              description="Checking devices currently signed in to your account."
            />
          ) : error ? (
            <InlineAlert variant="error" title="Unable to load sessions" description={error} />
          ) : sessions.length === 0 ? (
            <StatePanel
              title="No active sessions"
              description="Signed-in devices will appear here when you use Veterans Bay."
            />
          ) : (
            <ul className="space-y-3">
              {sessions.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-[18px] border border-black/8 bg-[#f7f9fa] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.isCurrent ? "Current session" : "Signed-in session"}
                    </p>
                    <p className="mt-1 text-sm text-[#68717b]">
                      {item.userAgent ?? "Unknown device"}
                    </p>
                    <p className="mt-1 text-xs text-[#68717b]">
                      Expires {new Date(item.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  {!item.isCurrent ? (
                    <Button
                      variant="outline"
                      type="button"
                      className="rounded-full border-black/8"
                      onClick={() => void revokeSession(item.id)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </main>
    </PublicShell>
  );
}
