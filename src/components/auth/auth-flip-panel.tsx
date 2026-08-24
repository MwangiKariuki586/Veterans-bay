"use client";

import {
  ArrowRight,
  BriefcaseBusiness,
  Eye,
  EyeOff,
  Hand,
  LockKeyhole,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { toast } from "sonner";

import { GuestHeader } from "@/components/public/guest-header";
import { Button } from "@/components/ui/button";
import { WorkspaceMainSkeleton } from "@/components/ui/workspace-skeletons";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_POST_AUTH_PATH,
  safeReturnPath,
} from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import { enterPrimaryWorkspace } from "@/lib/workspace-entry";

export type AuthMode = "signin" | "signup";
export type SelfServiceAccountType = "client" | "professional";

async function resolvePostAuthPath(redirectTo: string) {
  if (redirectTo !== DEFAULT_POST_AUTH_PATH) {
    return redirectTo;
  }

  try {
    const workspace = await enterPrimaryWorkspace();
    return workspace.href;
  } catch {
    return DEFAULT_POST_AUTH_PATH;
  }
}

const people = [
  "/images/header-avatar.png",
  "/images/featured-professional.png",
  "/images/homepage-hero.png",
  "/images/booking-phone.png",
] as const;

function mapSignInError(
  error: { code?: string; message?: string } | undefined,
) {
  if (
    error?.code === "ACCOUNT_RESTRICTED" ||
    error?.code === "ACCOUNT_DEACTIVATED" ||
    /restricted|deactivated|forbidden/i.test(error?.message ?? "")
  ) {
    return "This account cannot sign in right now.";
  }
  return "Unable to sign in with the details provided.";
}

function mapSignUpError(
  error: { code?: string; message?: string } | undefined,
) {
  if (
    error?.code === "PUBLIC_REGISTRATION_DISABLED" ||
    /registration is currently disabled/i.test(error?.message ?? "")
  ) {
    return "Account registration is currently unavailable.";
  }
  if (
    error?.code === "USER_ALREADY_EXISTS" ||
    error?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
    /already exists|registered/i.test(error?.message ?? "")
  ) {
    return "Unable to create the account with the details provided.";
  }
  return "Unable to create the account. Please try again.";
}

function BrandLockup() {
  return (
    <Link
      href="/"
      className="mx-auto grid size-[72px] place-items-center rounded-[20px] bg-white/95 p-2 shadow-[0_8px_22px_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c8ef00]"
      aria-label="Veterans Bay home"
    >
      <Image
        src="/images/veterans-bay-emblem.png"
        width={370}
        height={389}
        alt=""
        className="size-14 object-contain"
        sizes="56px"
      />
    </Link>
  );
}

function TrustFeature({
  icon,
  title,
  copy,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-[#b6dc00] text-[#c9ef00]">
        {icon}
      </span>
      <div>
        <p className="text-[0.86rem] font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[0.7rem] leading-[1.1rem] text-white/76">
          {copy}
        </p>
      </div>
    </div>
  );
}

function TrustPanel({ signup }: { signup: boolean }) {
  return (
    <aside className="relative hidden overflow-hidden bg-[#031839] px-9 pt-9 pb-8 text-white lg:flex lg:flex-col">
      <Image
        src="/images/auth-promo-background.png"
        alt=""
        fill
        sizes="340px"
        className="object-cover object-center"
        priority
      />
      <span className="absolute inset-0 bg-[#031839]/82" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col">
        <BrandLockup />
        <div className={signup ? "mt-1" : "mt-6"}>
          <h2 className="max-w-[280px] text-[1.85rem] leading-[1.16] font-semibold tracking-title">
            Trusted services.
            <br />
            One{" "}
            {signup ? <span className="text-[#bce000]">secure</span> : "secure"}
            <br />
            account.
          </h2>
          <span className="mt-4 block h-[3px] w-14 bg-[#bce000]" />
          <p className="mt-4 max-w-[270px] text-[0.79rem] leading-5 text-white/88">
            Join thousands of homeowners and professionals building trust and
            getting things done.
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <TrustFeature
            icon={<ShieldCheck className="size-5" />}
            title="Verified Professionals"
            copy="All pros are vetted for quality and reliability."
          />
          <TrustFeature
            icon={<ReceiptText className="size-5" />}
            title="Auditable Service Records"
            copy="Every job is tracked for transparency and peace of mind."
          />
          <TrustFeature
            icon={<LockKeyhole className="size-5" />}
            title="Secure Payments & Privacy"
            copy="Your payments and data are always protected."
          />
        </div>

        <div className="mt-auto pt-5">
          <div className="flex items-center">
            {people.map((src, index) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={44}
                height={44}
                className={cn(
                  "size-9 rounded-full border-2 border-white object-cover",
                  index > 0 && "-ml-2",
                )}
              />
            ))}
            <span className="-ml-2 grid size-9 place-items-center rounded-full border-2 border-[#031839] bg-[#243a5c] type-caption font-semibold">
              25K+
            </span>
          </div>
          <p className="mt-2 text-[0.72rem]">
            <span className="font-semibold text-[#c8ef00]">25,000+</span> homes
            trust Veterans Bay
          </p>
        </div>
      </div>
    </aside>
  );
}

function FormField({
  id,
  label,
  icon,
  trailing,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: ReactNode;
  trailing?: ReactNode;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const describedBy = [props["aria-describedby"], error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <label htmlFor={id} className={cn("block", className)}>
      <span className="mb-2 block text-[0.75rem] font-medium text-[#081a3a]">
        {label}
      </span>
      <span
        className={cn(
          "flex h-[42px] items-center gap-3 rounded-lg border bg-white px-3.5 transition focus-within:ring-2",
          error
            ? "border-[#d14343] focus-within:border-[#d14343] focus-within:ring-[#d14343]/12"
            : "border-[#d7dfeb] focus-within:border-[#8fbd00] focus-within:ring-[#bce000]/15",
        )}
      >
        <span className="text-[#687895]">{icon}</span>
        <input
          {...props}
          id={id}
          aria-label={props.placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 bg-transparent text-[0.78rem] text-[#081a3a] placeholder:text-[#8190aa]"
          style={{ ...props.style, outline: "none" }}
        />
        {trailing}
      </span>
      {error ? (
        <span
          id={errorId}
          className="mt-1.5 block type-caption leading-4 text-[#c53030]"
        >
          {error}
        </span>
      ) : null}
    </label>
  );
}

function SocialRow() {
  return (
    <Link
      href="/coming-soon/google-login"
      title="Google sign in is coming soon"
      className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#dce3ed] bg-white text-[0.72rem] font-medium text-[#0a1b38] transition-colors hover:border-[#b9d44c] hover:bg-[#f9fce9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9d400]"
    >
      <FcGoogle className="size-5" />
      Google
    </Link>
  );
}

function ModeTabs({
  mode,
  onChange,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
}) {
  return (
    <nav
      className="grid grid-cols-2 rounded-[18px] bg-[#f0eff2] p-1 shadow-[inset_0_1px_2px_rgba(7,23,51,0.04)]"
      aria-label="Authentication"
    >
      {(["signin", "signup"] as const).map((item) => (
        <Link
          key={item}
          href={item === "signin" ? "/login" : "/register"}
          onClick={(event) => {
            event.preventDefault();
            onChange(item);
          }}
          className={cn(
            "flex min-h-14 items-center justify-center rounded-[15px] px-4 text-center text-[1.05rem] transition-[color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fbd00] focus-visible:ring-offset-2",
            mode === item
              ? "bg-white font-semibold text-[#071733] shadow-[0_1px_4px_rgba(7,23,51,0.12)]"
              : "font-medium text-[#77757c] hover:text-[#071733]",
          )}
          aria-current={mode === item ? "page" : undefined}
        >
          {item === "signin" ? "Sign In" : "Signup"}
        </Link>
      ))}
    </nav>
  );
}

function Divider() {
  return (
    <div className="my-3 flex items-center gap-4 text-[0.7rem] text-[#6e7b93]">
      <span className="h-px flex-1 bg-[#dce3ed]" />
      <span>or continue with</span>
      <span className="h-px flex-1 bg-[#dce3ed]" />
    </div>
  );
}

function SignInFace({
  onFlipToSignUp,
  onInteractiveSignInChange,
  redirectTo,
}: {
  onFlipToSignUp: () => void;
  onInteractiveSignInChange: (active: boolean) => void;
  redirectTo: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"email" | "password", string>>
  >({});
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const nextErrors: Partial<Record<"email" | "password", string>> = {};

    if (!email) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Enter your password.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    onInteractiveSignInChange(true);
    const result = await authClient.signIn
      .email({
        email,
        password,
        rememberMe: form.get("remember") === "on",
      })
      .catch(() => null);
    if (!result) {
      setSubmitting(false);
      onInteractiveSignInChange(false);
      toast.error("Unable to sign in with the details provided.");
      return;
    }
    if (result.error) {
      setSubmitting(false);
      onInteractiveSignInChange(false);
      toast.error(mapSignInError(result.error));
      return;
    }
    toast.success("Signed in.");
    const destination = await resolvePostAuthPath(redirectTo);
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[540px] px-7 pt-9 pb-6 sm:px-11">
      <ModeTabs
        mode="signin"
        onChange={(mode) => mode === "signup" && onFlipToSignUp()}
      />
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <h1 className="text-[1.65rem] font-semibold tracking-title">
            Welcome back
          </h1>
          <Hand className="size-6 rotate-[-18deg] text-[#f4b000]" />
        </div>
        <p className="mt-2 text-[0.84rem] text-[#65738d]">
          Sign in to continue to your account
        </p>
      </div>
      <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
        <FormField
          id="signin-email"
          label="Email address"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          error={fieldErrors.email}
          onChange={() =>
            setFieldErrors((current) => ({ ...current, email: undefined }))
          }
          icon={<Mail className="size-[1.05rem]" />}
        />
        <FormField
          id="signin-password"
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          error={fieldErrors.password}
          onChange={() =>
            setFieldErrors((current) => ({ ...current, password: undefined }))
          }
          icon={<LockKeyhole className="size-[1.05rem]" />}
          trailing={
            <button
              type="button"
              className="text-[#697895]"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          }
        />
        <div className="flex items-center text-[0.75rem]">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="remember"
              className="size-4 accent-[#a9d400]"
            />
            Remember me
          </label>
        </div>
        <Button
          className="h-12 w-full rounded-lg bg-[#b9e000] text-[0.88rem] font-semibold shadow-none hover:bg-[#aace00] cursor-pointer"
          loading={submitting}
          type="submit"
        >
          <span className="flex-1 text-center">Sign In</span>
          <ArrowRight className="size-5" />
        </Button>
      </form>
      <Divider />
      <SocialRow />
    </div>
  );
}

async function persistPhone(phone: string) {
  if (!phone) return true;
  const response = await fetch("/api/v1/account/profile", {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  return response.ok;
}

function SignUpFace({ onFlipToSignIn }: { onFlipToSignIn: () => void }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  type SignUpField =
    | "name"
    | "email"
    | "phone"
    | "password"
    | "confirmPassword"
    | "businessName"
    | "acceptTerms";
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<SignUpField, string>>
  >({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [accountType, setAccountType] =
    useState<SelfServiceAccountType>("client");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    const businessName = String(form.get("businessName") ?? "").trim();
    const accepted = form.get("acceptTerms") === "on";
    const nextErrors: Partial<Record<SignUpField, string>> = {};

    if (name.length < 2) nextErrors.name = "Enter your full name.";
    if (!email) {
      nextErrors.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!phone) nextErrors.phone = "Enter your phone number.";
    if (accountType === "professional" && businessName.length < 2) {
      nextErrors.businessName = "Enter your business or professional name.";
    }
    if (!accepted) {
      nextErrors.acceptTerms = "Accept the terms and privacy policy to continue.";
    }
    if (password.length < 8) {
      nextErrors.password = "Use at least 8 characters.";
    }
    if (!confirmation) {
      nextErrors.confirmPassword = "Confirm your password.";
    } else if (password !== confirmation) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    const result = await authClient.signUp.email({
      email,
      name,
      password,
      termsAccepted: true,
      privacyAccepted: true,
    } as Parameters<typeof authClient.signUp.email>[0] & {
      termsAccepted: true;
      privacyAccepted: true;
    });
    if (result.error) {
      setSubmitting(false);
      toast.error(mapSignUpError(result.error));
      return;
    }

    try {
      const phoneSaved = await persistPhone(phone);
      if (!phoneSaved) {
        setSubmitting(false);
        toast.error(
          "Your account was created, but the phone number could not be saved. Please try again.",
        );
        return;
      }

      if (accountType === "professional") {
        const onboardingResponse = await fetch(
          "/api/v1/professional/onboarding",
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: businessName }),
          },
        );
        const onboardingBody = (await onboardingResponse.json()) as {
          data?: { organisationId: string };
        };
        if (onboardingResponse.ok && onboardingBody.data) {
          await fetch("/api/v1/workspaces/select", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              workspaceId: `organisation:${onboardingBody.data.organisationId}`,
            }),
          });
        }
        toast.success(
          "Professional account created. Complete your profile next.",
        );
        router.push("/professional/onboarding");
      } else {
        toast.success("Client account created.");
        router.push("/client");
      }
      router.refresh();
    } catch {
      toast.error(
        "Your account was created, but profile setup could not be completed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[540px] px-6 pt-7 pb-4 sm:px-9">
      <ModeTabs
        mode="signup"
        onChange={(mode) => mode === "signin" && onFlipToSignIn()}
      />
      <div className="mt-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[1.5rem] font-semibold tracking-title">
            Create your account
          </h1>
          <Hand className="size-5 rotate-[-18deg] text-[#f4b000]" />
        </div>
        <p className="mt-1 text-[0.82rem] text-[#65738d]">
          Join Veterans Bay and get started
        </p>
      </div>
      <form className="mt-3" onSubmit={onSubmit} noValidate>
        <fieldset>
          <legend className="text-[0.74rem] font-medium">I want to:</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              {
                value: "client" as const,
                label: "Hire services",
                copy: "I need help for my home or business",
                icon: <User className="size-5" />,
              },
              {
                value: "professional" as const,
                label: "Offer services",
                copy: "I'm a professional looking for clients",
                icon: <BriefcaseBusiness className="size-5" />,
              },
            ].map((option) => (
              <label
                key={option.value}
                className={cn(
                  "relative cursor-pointer rounded-lg border p-2.5",
                  accountType === option.value
                    ? "border-[#badb2c] bg-[#f7fbdf]"
                    : "border-[#d8e0eb] bg-white",
                )}
              >
                <input
                  type="radio"
                  name="accountType"
                  value={option.value}
                  checked={accountType === option.value}
                  onChange={() => {
                    setAccountType(option.value);
                    setFieldErrors((current) => ({
                      ...current,
                      businessName: undefined,
                    }));
                  }}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "absolute top-3 right-3 size-5 rounded-full border",
                    accountType === option.value
                      ? "border-[#a7d000] bg-[#a7d000] shadow-[inset_0_0_0_4px_white]"
                      : "border-[#bdc8d9]",
                  )}
                />
                <span className="flex items-center gap-2.5 pr-8">
                  <span
                    className={
                      accountType === option.value
                        ? "text-[#8eb400]"
                        : "text-[#65738d]"
                    }
                  >
                    {option.icon}
                  </span>
                  <span className="text-[0.76rem] font-semibold">
                    {option.label}
                  </span>
                </span>
                <span className="mt-0.5 block max-w-[150px] type-caption leading-4 text-[#65738d]">
                  {option.copy}
                </span>
              </label>
            ))}
          </div>
          <p className="sr-only">
            Team members join through an organisation invitation. Administrator
            access is assigned separately and cannot be created here.
          </p>
        </fieldset>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FormField
            id="signup-name"
            label="Full name"
            name="name"
            placeholder="Enter your full name"
            autoComplete="name"
            required
            error={fieldErrors.name}
            onChange={() =>
              setFieldErrors((current) => ({ ...current, name: undefined }))
            }
            icon={<User className="size-4" />}
          />
          <FormField
            id="signup-email"
            label="Email address"
            name="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            required
            error={fieldErrors.email}
            onChange={() =>
              setFieldErrors((current) => ({ ...current, email: undefined }))
            }
            icon={<Mail className="size-4" />}
          />
          <FormField
            id="signup-phone"
            label="Phone number"
            name="phone"
            type="tel"
            placeholder="07XX XXX XXX"
            autoComplete="tel"
            required
            error={fieldErrors.phone}
            onChange={() =>
              setFieldErrors((current) => ({ ...current, phone: undefined }))
            }
            icon={<Phone className="size-4" />}
          />
          <FormField
            id="signup-password"
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            minLength={8}
            error={fieldErrors.password}
            onChange={() =>
              setFieldErrors((current) => ({ ...current, password: undefined }))
            }
            icon={<LockKeyhole className="size-4" />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-[#687895]"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            }
          />
        </div>
        {accountType === "professional" ? (
          <FormField
            className="mt-3"
            id="signup-business-name"
            label="Business or professional name"
            name="businessName"
            placeholder="Business or professional name"
            autoComplete="organization"
            required
            error={fieldErrors.businessName}
            onChange={() =>
              setFieldErrors((current) => ({
                ...current,
                businessName: undefined,
              }))
            }
            icon={<BriefcaseBusiness className="size-4" />}
          />
        ) : null}
        <FormField
          className="mt-3"
          id="signup-confirm-password"
          label="Confirm password"
          name="confirmPassword"
          type={showConfirm ? "text" : "password"}
          placeholder="Confirm your password"
          autoComplete="new-password"
          required
          minLength={8}
          error={fieldErrors.confirmPassword}
          onChange={() =>
            setFieldErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }))
          }
          icon={<LockKeyhole className="size-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowConfirm((value) => !value)}
              aria-label={
                showConfirm
                  ? "Hide password confirmation"
                  : "Show password confirmation"
              }
              className="text-[#687895]"
            >
              {showConfirm ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          }
        />
        <label className="mt-3 flex items-start gap-2 type-caption text-[#53647f]">
          <input
            className="mt-0.5 size-4 accent-[#a9d400]"
            name="acceptTerms"
            type="checkbox"
            required
            aria-invalid={Boolean(fieldErrors.acceptTerms)}
            aria-describedby={
              fieldErrors.acceptTerms ? "signup-accept-terms-error" : undefined
            }
            onChange={() =>
              setFieldErrors((current) => ({
                ...current,
                acceptTerms: undefined,
              }))
            }
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-[#0068e8]">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#0068e8]">
              Privacy Policy
            </Link>
          </span>
        </label>
        {fieldErrors.acceptTerms ? (
          <p
            id="signup-accept-terms-error"
            className="mt-1.5 type-caption leading-4 text-[#c53030]"
          >
            {fieldErrors.acceptTerms}
          </p>
        ) : null}
        <Button
          className="mt-3 h-11 w-full rounded-lg bg-[#b9e000] text-[0.84rem] font-semibold shadow-none hover:bg-[#aace00] cursor-pointer"
          loading={submitting}
          type="submit"
        >
          <span className="flex-1 text-center">Create account</span>
          <ArrowRight className="size-5" />
        </Button>
      </form>
      <Divider />
      <SocialRow />
    </div>
  );
}

export function AuthFlipPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [interactiveSignIn, setInteractiveSignIn] = useState(false);
  const requestedRedirect = searchParams.get("redirect");
  const redirectTo = safeReturnPath(requestedRedirect);
  const showSignup = pathname === "/register";

  useEffect(() => {
    if (interactiveSignIn || sessionPending || !session) {
      return;
    }

    let cancelled = false;
    void resolvePostAuthPath(redirectTo).then((destination) => {
      if (!cancelled) {
        router.replace(destination);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [interactiveSignIn, redirectTo, router, session, sessionPending]);

  if (!interactiveSignIn && (sessionPending || session)) {
    return (
      <main
        className="min-h-screen bg-[radial-gradient(circle_at_top,#fff_0%,#eef3f6_66%,#e7edf0_100%)] px-4 py-8"
        aria-busy="true"
        aria-label="Opening your workspace"
      >
        <div className="mx-auto max-w-6xl rounded-[22px] border border-black/8 bg-white p-6 shadow-[0_20px_50px_rgba(13,30,43,0.08)] sm:p-8">
          <WorkspaceMainSkeleton />
        </div>
      </main>
    );
  }

  function flipTo(next: AuthMode) {
    const destination = next === "signup" ? "/register" : "/login";
    const suffix =
      redirectTo !== DEFAULT_POST_AUTH_PATH
        ? `?redirect=${encodeURIComponent(redirectTo)}`
        : "";
    router.replace(`${destination}${suffix}`, { scroll: false });
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[#f4f7fb] text-[#071733]">
      <div className="mx-auto w-full max-w-[1340px] px-5 py-4 sm:px-7">
        <GuestHeader />
      </div>
      <main className="mx-auto w-full max-w-[1040px] px-3 sm:px-5 lg:pt-2">
        <div className="grid min-h-[720px] overflow-hidden rounded-[30px] border border-[#d8e1ee] bg-white shadow-[0_22px_55px_rgba(15,39,75,0.14)] lg:grid-cols-[340px_minmax(0,1fr)]">
          <TrustPanel signup={showSignup} />
          <section className="relative min-w-0 bg-white [perspective:1600px]">
            <div
              className={cn(
                "[backface-visibility:hidden]",
                showSignup && "pointer-events-none invisible absolute inset-0",
              )}
              aria-hidden={showSignup}
              inert={showSignup}
            >
              <SignInFace
                onFlipToSignUp={() => flipTo("signup")}
                onInteractiveSignInChange={setInteractiveSignIn}
                redirectTo={redirectTo}
              />
            </div>
            <div
              className={cn(
                "[backface-visibility:hidden]",
                !showSignup && "pointer-events-none invisible absolute inset-0",
              )}
              aria-hidden={!showSignup}
              inert={!showSignup}
            >
              <SignUpFace onFlipToSignIn={() => flipTo("signin")} />
            </div>
          </section>
        </div>
      </main>
      <footer className="flex min-h-11 flex-wrap items-center justify-center gap-1.5 px-5 text-center type-caption text-[#53647f]">
        <LockKeyhole className="size-3.5" />
        By continuing, you agree to our{" "}
        <Link href="/terms" className="text-[#0068e8]">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-[#0068e8]">
          Privacy Policy.
        </Link>
      </footer>
    </div>
  );
}
