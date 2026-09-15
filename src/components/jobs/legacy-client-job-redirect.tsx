"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { StatePanel } from "@/components/ui/state-panel";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";
import { getJob } from "./job-api";

export function LegacyClientJobRedirect({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    void getJob("client", jobId)
      .then((job) => {
        if (active) {
          router.replace(`/client/bookings/${job.bookingId}#service-progress`);
        }
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [jobId, router]);

  if (!unavailable) return <DetailPageSkeleton />;
  return (
    <StatePanel
      variant="error"
      title="Service progress unavailable"
      description="This service record could not be opened from the current account."
    />
  );
}
