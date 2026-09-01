import { redirect } from "next/navigation";

export default function ClientJobsPage() {
  redirect("/client/bookings?stage=active");
}
