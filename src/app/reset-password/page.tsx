import { UnavailablePage } from "@/components/public/unavailable-page";

export default function ResetPasswordPage() {
  return (
    <UnavailablePage
      eyebrow="Password recovery"
      title="Reset is not available yet."
      description="Password reset remains unavailable until email delivery is configured and verified."
    />
  );
}
