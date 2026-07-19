import { UnavailablePage } from "@/components/public/unavailable-page";

export default function VerifyEmailPage() {
  return (
    <UnavailablePage
      eyebrow="Email verification"
      title="Verification mail is not configured."
      description="Email verification remains unavailable until delivery is configured and verified. Professional publication will require verification once enabled."
    />
  );
}
