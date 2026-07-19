import { UnavailablePage } from "@/components/public/unavailable-page";

export default function ForgotPasswordPage() {
  return (
    <UnavailablePage
      eyebrow="Password recovery"
      title="Email delivery is not configured."
      description="Forgot-password stays disabled until outbound email delivery is configured and verified for Veterans Bay."
    />
  );
}
