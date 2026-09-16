"use client";

import { Mail, MapPin, MessageCircle, Phone, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ProfileActionRow,
  ProfileField,
  ProfileFieldList,
  ProfileIdentityHeader,
  ProfileSection,
  ProfilePageSkeleton,
} from "@/components/profile";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientContextProfile } from "@/modules/client-context/types";

export function ClientRelationshipProfile({
  clientId,
  contextId,
  contextType,
}: {
  clientId: string;
  contextId?: string | null;
  contextType?: "job" | "booking" | "request" | "customer" | null;
}) {
  const [data, setData] = useState<ClientContextProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (contextId) params.set("contextId", contextId);
    if (contextType) params.set("contextType", contextType);
    const qs = params.toString();
    const path = `/api/v1/professional/clients/${encodeURIComponent(clientId)}${qs ? `?${qs}` : ""}`;
    void fetch(path, { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { data?: ClientContextProfile; error?: { message?: string } } | null;
        if (!response.ok || !body?.data) throw new Error(body?.error?.message ?? "Client not found.");
        setData(body.data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load client."))
      .finally(() => setLoading(false));
  }, [clientId, contextId, contextType]);

  if (loading) return <ProfilePageSkeleton />;

  if (error || !data) {
    return <StatePanel variant="error" title="Client unavailable" description={error ?? "This client could not be loaded or you do not have a permitted relationship."} />;
  }

  const { client, relationship, jobLocation, permissions } = data;
  const memberSince = (() => {
    try {
      return new Date(client.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-5">
      {permissions.limitedView && permissions.limitedReason ? (
        <InlineAlert variant="success" title="Limited view" description={permissions.limitedReason} />
      ) : null}
      {permissions.limitedView ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;re viewing client information related to this job. Full account controls and unrelated history are not shown.
        </div>
      ) : null}

      <ProfileIdentityHeader
        name={client.displayName}
        subtitle="Client"
        avatarUrl={client.avatarUrl}
        avatarFallback={client.displayName}
        avatarVariant="person"
        verified={client.verified}
        verifiedLabel="Verified account"
        meta={[
          ...(client.location ? [{ icon: "location" as const, value: client.location }] : []),
          ...(permissions.canViewContact && client.phone ? [{ icon: "phone" as const, value: client.phone }] : []),
          ...(permissions.canViewContact && client.primaryEmail ? [{ icon: "email" as const, value: client.primaryEmail }] : []),
        ]}
        memberSince={client.memberSince}
      >
        <div className="flex flex-wrap gap-2">
          <Link href={contextId && contextType === "job" ? `/professional/jobs/${contextId}` : "/professional/customers"} className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}>
            View related job
          </Link>
          <Link href={`/professional/jobs/${relationship.activeJob?.id ?? ""}/conversation`} className={cn(buttonVariants({ variant: "secondary" }), "rounded-full")}>
            <MessageCircle className="size-4" aria-hidden="true" /> Message client
          </Link>
        </div>
      </ProfileIdentityHeader>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <div className="space-y-5">
          <ProfileSection title="Client" description="Information needed to deliver the associated work.">
            <ProfileFieldList>
              <ProfileField icon={User} label="Full name" value={client.displayName} />
              <ProfileField icon={ShieldCheck} label="Verification" value={client.verified ? "Verified account" : "Unverified"} />
              <ProfileField icon={MapPin} label="Location" value={client.location ?? "—"} />
              <ProfileField icon={Mail} label="Preferred contact" value={client.preferredContactMethod ?? "—"} />
              {permissions.canViewContact ? (
                <>
                  <ProfileField icon={Phone} label="Phone" value={client.phone ?? "—"} />
                  <ProfileField icon={Mail} label="Email" value={client.primaryEmail} />
                </>
              ) : (
                <ProfileField icon={Phone} label="Contact" value="Approved contact will appear after job acceptance" />
              )}
              {memberSince ? <ProfileField icon={User} label="Member since" value={memberSince} /> : null}
            </ProfileFieldList>
            {!permissions.canViewContact ? (
              <p className="mt-4 type-caption text-muted-foreground">Contact information is only available when the workflow permits it.</p>
            ) : null}
          </ProfileSection>

          <ProfileSection title="Relationship With You" description="History between this client and your organisation — scoped to your team when applicable.">
            <div className="space-y-1">
              <ProfileActionRow label="Active job" value={relationship.activeJob ? `${relationship.activeJob.serviceName} · ${relationship.activeJob.status}` : "No active job"} />
              <ProfileActionRow label="Completed jobs with you" value={`${relationship.completedJobsCount}`} />
              <ProfileActionRow label="Total jobs" value={`${relationship.totalJobsCount}`} />
              <ProfileActionRow label="Quotations" value={`${relationship.quotationsCount}`} />
              <ProfileActionRow label="Bookings" value={`${relationship.bookingsCount}`} />
              {relationship.lastCompletedAt ? <ProfileActionRow label="Last completed" value={new Date(relationship.lastCompletedAt).toLocaleDateString()} /> : null}
            </div>
            <p className="mt-4 type-caption text-muted-foreground">Does not include the client&apos;s bookings with other professionals, saved professionals, or unrelated service activity.</p>
          </ProfileSection>

          {permissions.canViewLocation && jobLocation ? (
            <ProfileSection title="Job Location">
              <div className="space-y-3">
                <p className="type-body font-semibold">{jobLocation.serviceLocation ?? "Service location"}</p>
                {jobLocation.scheduledStartsAt ? (
                  <p className="type-caption text-muted-foreground">Scheduled: {new Date(jobLocation.scheduledStartsAt).toLocaleString()}</p>
                ) : null}
                {jobLocation.jobId ? (
                  <Link href={`/professional/jobs/${jobLocation.jobId}`} className="inline-flex type-control font-semibold text-[#5f8d11]">Open job →</Link>
                ) : jobLocation.bookingId ? (
                  <Link href={`/professional/bookings/${jobLocation.bookingId}`} className="inline-flex type-control font-semibold text-[#5f8d11]">Open booking →</Link>
                ) : null}
              </div>
            </ProfileSection>
          ) : (
            <Surface className="p-6">
              <h3 className="type-section-title">Job Location</h3>
              <p className="mt-2 type-body text-muted-foreground">Location will appear once the workflow permits access to the job address.</p>
            </Surface>
          )}
        </div>

        <aside className="space-y-5">
          <ProfileSection title="Approved contact method" className="p-5 sm:p-6">
            {permissions.canViewContact ? (
              <ProfileFieldList>
                {client.phone ? <ProfileField icon={Phone} label="Phone" value={client.phone} /> : null}
                <ProfileField icon={Mail} label="Email" value={client.primaryEmail} />
              </ProfileFieldList>
            ) : (
              <p className="type-body text-muted-foreground">Contact is restricted for this role until assigned to the job.</p>
            )}
          </ProfileSection>

          <Surface className="p-5">
            <h3 className="type-section-title">Privacy</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">This view is scoped to the current professional-client relationship. Unrelated history, saved professionals, other professional hires, and private preferences are not exposed.</p>
            <Link href="/privacy" className="mt-3 inline-flex type-control font-semibold text-[#5f8d11]">Learn about privacy →</Link>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
