import { Suspense } from "react";

import { BookingList } from "@/components/bookings/booking-list";
import { ListPageSkeleton } from "@/components/ui/workspace-skeletons";

export default function ClientBookingsRoute() {
  return (
    <Suspense fallback={<ListPageSkeleton title="Your bookings" summaryLabels={["Total bookings", "Pending", "Upcoming", "In service"]} />}>
      <BookingList audience="client" />
    </Suspense>
  );
}
