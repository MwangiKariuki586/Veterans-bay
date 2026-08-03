import {
  ArrowLeft,
  Bolt,
  EyeOff,
  LockKeyhole,
  Mail,
  MoreHorizontal,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import { FeatureStatusPage } from "@/components/public/coming-soon-page";

function GoogleSignInPreview() {
  return (
    <div className="relative mx-auto flex min-h-[330px] w-full max-w-[560px] items-center justify-center px-5 sm:px-20">
      <div className="w-full max-w-[330px] overflow-hidden rounded-2xl border border-white/65 bg-white text-[#071733] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="flex h-8 items-center bg-[#071b48] px-3 text-white">
          <MoreHorizontal className="size-6" aria-hidden="true" />
        </div>
        <div className="px-6 py-8">
          <h2 className="text-center text-base font-bold">Sign in to Veterans Bay</h2>
          <div className="mt-5 flex h-11 items-center justify-center gap-3 rounded-md border border-[#d6deea] text-sm font-semibold">
            <FcGoogle className="size-5" /> Continue with Google
          </div>
          <div className="my-4 flex items-center gap-3 text-xs text-[#7b8aa3]">
            <span className="h-px flex-1 bg-[#dce3ed]" /> or <span className="h-px flex-1 bg-[#dce3ed]" />
          </div>
          <div className="flex h-11 items-center gap-3 rounded-md border border-[#d6deea] px-3 text-sm text-[#8a98ad]">
            <Mail className="size-4" aria-hidden="true" /> Email address
          </div>
          <div className="mt-3 flex h-11 items-center gap-3 rounded-md border border-[#d6deea] px-3 text-sm text-[#8a98ad]">
            <LockKeyhole className="size-4" aria-hidden="true" /> Password
            <EyeOff className="ml-auto size-4" aria-hidden="true" />
          </div>
          <div className="mt-4 grid h-11 place-items-center rounded-md bg-[#061a47] text-sm font-semibold text-white">Sign in</div>
        </div>
      </div>

      <div className="absolute top-[45%] right-0 hidden w-28 -translate-y-1/2 rounded-2xl border-2 border-[#b9e000] bg-[#fbffe9] px-3 py-5 text-center text-[#071733] shadow-[0_15px_35px_rgba(0,0,0,0.2)] sm:block">
        <ShieldCheck className="mx-auto size-8" aria-hidden="true" />
        <p className="mt-2 text-sm font-bold leading-5">Secure &amp; trusted</p>
      </div>
    </div>
  );
}

export default function GoogleLoginComingSoonPage() {
  return (
    <FeatureStatusPage
      status="coming-soon"
      shellType="public"
      title={<>Google sign-in<br />is coming to <span className="text-[#98c900]">Veterans Bay</span></>}
      description={<>We&apos;re working on a faster, more secure way to access your account using Google. In the meantime, continue with your email and password.</>}
      icon={<FcGoogle className="size-14" />}
      primaryAction={{ href: "/login", label: "Continue with email", icon: <Mail className="size-4" /> }}
      secondaryAction={{ href: "/login", label: "Back to sign in", icon: <ArrowLeft className="size-4" /> }}
      previewContent={<GoogleSignInPreview />}
      assurance="Your data is always safe and secure with us."
      benefits={[
        { icon: <Bolt className="size-5" />, title: "Faster access" },
        { icon: <ShieldCheck className="size-5" />, title: "Secure Google authentication" },
        { icon: <UserRound className="size-5" />, title: "Connect existing accounts" },
      ]}
    />
  );
}
