import { Suspense } from "react";

import { BookingList } from "@/components/bookings/booking-list";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessionalBookingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
      <BookingList audience="professional" />
    </Suspense>
  );
}
