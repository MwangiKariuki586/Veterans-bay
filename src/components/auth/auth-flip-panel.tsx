"use client";

import { ArrowRight, Lock, Mail, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthCard, AuthUnderlineField } from "@/components/auth/auth-card";
import { PublicShell } from "@/components/public/public-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type AuthMode = "signin" | "signup";

function mapSignInError(error: { code?: string; message?: string } | undefined) {
  if (!error) {
    return "Unable to sign in with the details provided.";
  }

  if (
    error.code === "ACCOUNT_RESTRICTED" ||
    error.code === "ACCOUNT_DEACTIVATED" ||
    /restricted|deactivated|forbidden/i.test(error.message ?? "")
  ) {
    return "This account cannot sign in right now.";
  }

  return "Unable to sign in with the details provided.";
}

function mapSignUpError(error: { code?: string; message?: string } | undefined) {
  if (!error) {
    return "Unable to create the account. Please try again.";
  }

  if (
    error.code === "USER_ALREADY_EXISTS" ||
    error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    /already exists|registered/i.test(error.message ?? "")
  ) {
    return "Unable to create the account with the details provided.";
  }

  return "Unable to create the account. Please try again.";
}

function SignInFace({
  onFlipToSignUp,
}: {
  onFlipToSignUp: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setSubmitting(true);
    const result = await authClient.signIn.email({ email, password });
    setSubmitting(false);

    if (result.error) {
      setError(mapSignInError(result.error));
      return;
    }

    toast.success("Signed in.");
    router.push("/account/profile");
    router.refresh();
  }

  return (
    <AuthCard
      title="Welcome back!"
      subtitle="Sign in to continue to your account"
    >
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <AuthUnderlineField
          id="signin-email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          icon={<Mail className="size-4" />}
        />
        <div>
          <AuthUnderlineField
            id="signin-password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            icon={<Lock className="size-4" />}
          />
          <p className="mt-3 text-right text-xs font-semibold text-[#5f8d11]">
            Forgot password?
          </p>
        </div>
        {error ? (
          <InlineAlert variant="error" title="Sign-in failed" description={error} />
        ) : null}
        <Button
          className="h-12 w-full justify-between rounded-xl pr-1.5 pl-6 font-bold tracking-wide uppercase"
          loading={submitting}
          type="submit"
        >
          Sign in
          <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Button>
      </form>

      <div className="relative my-7 text-center text-xs text-[#68717b]">
        <span className="absolute inset-x-0 top-1/2 border-t border-black/8" />
        <span className="relative bg-white px-3">Don&apos;t have an account?</span>
      </div>

      <button
        type="button"
        onClick={onFlipToSignUp}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-12 w-full justify-between rounded-xl border-[#b8d84a] pr-1.5 pl-6 font-bold tracking-wide uppercase",
        )}
      >
        Sign up
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </button>

      <p className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f7f9fa] px-4 py-2.5 text-xs text-[#68717b]">
        <ShieldCheck className="size-3.5 text-[#5f8d11]" aria-hidden="true" />
        Your data is secure with us
      </p>
    </AuthCard>
  );
}

function SignUpFace({
  onFlipToSignIn,
}: {
  onFlipToSignIn: () => void;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const acceptTerms = form.get("acceptTerms") === "on";
    const acceptPrivacy = form.get("acceptPrivacy") === "on";

    if (!acceptTerms || !acceptPrivacy) {
      setError("You must accept the terms and privacy policy to continue.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    const result = await authClient.signUp.email({ email, name, password });
    setSubmitting(false);

    if (result.error) {
      setError(mapSignUpError(result.error));
      return;
    }

    toast.success("Account created.");
    router.push("/account/profile");
    router.refresh();
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join the community of trusted professionals"
    >
      <form className="space-y-6" onSubmit={onSubmit} noValidate>
        <AuthUnderlineField
          id="signup-name"
          name="name"
          placeholder="Enter your full name"
          autoComplete="name"
          required
          icon={<User className="size-4" />}
        />
        <AuthUnderlineField
          id="signup-email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          icon={<Mail className="size-4" />}
        />
        <div>
          <AuthUnderlineField
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="new-password"
            required
            minLength={8}
            icon={<Lock className="size-4" />}
          />
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[#68717b]">
            <span>Password must be at least 8 characters</span>
            <button
              type="button"
              className="font-semibold text-[#5f8d11]"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm text-[#68717b]">
          <input
            className="mt-1 size-4 rounded border-black/20"
            name="acceptTerms"
            type="checkbox"
            required
          />
          <span>
            I accept the{" "}
            <Link href="/terms" className="font-semibold text-foreground">
              terms of use
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-[#68717b]">
          <input
            className="mt-1 size-4 rounded border-black/20"
            name="acceptPrivacy"
            type="checkbox"
            required
          />
          <span>
            I accept the{" "}
            <Link href="/privacy" className="font-semibold text-foreground">
              privacy policy
            </Link>
            .
          </span>
        </label>
        {error ? (
          <InlineAlert
            variant="error"
            title="Registration failed"
            description={error}
          />
        ) : null}
        <Button
          className="h-12 w-full justify-between rounded-xl pr-1.5 pl-6 font-bold tracking-wide uppercase"
          loading={submitting}
          type="submit"
        >
          Sign up
          <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </Button>
      </form>

      <div className="relative my-7 text-center text-xs text-[#68717b]">
        <span className="absolute inset-x-0 top-1/2 border-t border-black/8" />
        <span className="relative bg-white px-3">Already have an account?</span>
      </div>

      <button
        type="button"
        onClick={onFlipToSignIn}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-12 w-full justify-between rounded-xl border-[#b8d84a] pr-1.5 pl-6 font-bold tracking-wide uppercase",
        )}
      >
        Sign in
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </button>

      <p className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#f7f9fa] px-4 py-2.5 text-xs text-[#68717b]">
        <ShieldCheck className="size-3.5 text-[#5f8d11]" aria-hidden="true" />
        Your data is secure with us
      </p>
    </AuthCard>
  );
}

export function AuthFlipPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<AuthMode>(
    pathname === "/register" ? "signup" : "signin",
  );

  useEffect(() => {
    if (pathname === "/register") {
      setMode("signup");
    } else if (pathname === "/login") {
      setMode("signin");
    }
  }, [pathname]);

  function flipTo(next: AuthMode) {
    setMode(next);
    // Keep the panel mounted via shared (auth) layout; only sync the URL.
    router.replace(next === "signup" ? "/register" : "/login", { scroll: false });
  }

  const showSignup = mode === "signup";

  return (
    <PublicShell>
      <main className="overflow-x-clip py-4">
        <div className="mx-auto w-full max-w-md [perspective:1600px]">
          <div
            className={cn(
              "relative grid w-full [transform-style:preserve-3d]",
              "transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
              "motion-reduce:transition-none",
              showSignup ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
            )}
          >
            <div
              className={cn(
                "col-start-1 row-start-1 [backface-visibility:hidden]",
                showSignup && "pointer-events-none",
              )}
              aria-hidden={showSignup}
            >
              <SignInFace onFlipToSignUp={() => flipTo("signup")} />
            </div>
            <div
              className={cn(
                "col-start-1 row-start-1 [backface-visibility:hidden] [transform:rotateY(180deg)]",
                !showSignup && "pointer-events-none",
              )}
              aria-hidden={!showSignup}
            >
              <SignUpFace onFlipToSignIn={() => flipTo("signin")} />
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
