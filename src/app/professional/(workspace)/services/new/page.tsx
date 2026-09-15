import { redirect } from "next/navigation";

export default function NewProfessionalServicePage() {
  redirect("/professional/services?editor=new");
}
