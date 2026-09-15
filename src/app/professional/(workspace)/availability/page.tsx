import { Suspense } from "react";

import { AvailabilitySchedule } from "@/components/bookings/availability-schedule";
import { DetailPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ProfessionalAvailabilityPage() {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <AvailabilitySchedule />
    </Suspense>
  );
}
