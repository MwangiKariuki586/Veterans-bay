import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { GuestHeader } from "@/components/public/guest-header";
import { buttonVariants } from "@/components/ui/button";
import { AuthenticatedShell } from "@/components/workspace/authenticated-shell";
import type { AuthenticatedShellKind } from "@/components/workspace/workspace-nav";
import { cn } from "@/lib/utils";

export type FeatureStatus =
  | "coming-soon"
  | "under-maintenance"
  | "temporarily-unavailable";

export type FeatureStatusShell = "public" | AuthenticatedShellKind;

export type FeatureStatusAction = {
  href: string;
  label: string;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
};

export type FeatureStatusBenefit = {
  icon: ReactNode;
  title: string;
  description?: string;
};

export type FeatureStatusPageProps = {
  status: FeatureStatus;
  title: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  primaryAction?: FeatureStatusAction;
  secondaryAction?: FeatureStatusAction;
  previewContent: ReactNode;
  benefits?: ReadonlyArray<FeatureStatusBenefit>;
  shellType?: FeatureStatusShell;
  assurance?: ReactNode;
};

const statusPresentation = {
  "coming-soon": {
    label: "Coming soon",
    Icon: Clock3,
    pillClass: "border-[#dce5b5] bg-[#f5fadf] text-[#587300]",
  },
  "under-maintenance": {
    label: "Under maintenance",
    Icon: Wrench,
    pillClass: "border-[#d7e0ec] bg-[#f4f7fb] text-[#274369]",
  },
  "temporarily-unavailable": {
    label: "Temporarily unavailable",
    Icon: TriangleAlert,
    pillClass: "border-[#eadfb6] bg-[#fff8df] text-[#765900]",
  },
} satisfies Record<
  FeatureStatus,
  { label: string; Icon: typeof Clock3; pillClass: string }
>;

const workspaceHome: Record<AuthenticatedShellKind, string> = {
  client: "/client",
  professional: "/professional",
  admin: "/admin",
};

function ActionLink({
  action,
  primary = false,
}: {
  action: FeatureStatusAction;
  primary?: boolean;
}) {
  return (
    <Link
      href={action.href}
      className={cn(
        buttonVariants({ variant: primary ? "primary" : "outline" }),
        "h-12 w-full justify-start rounded-lg px-5 text-sm shadow-none",
        primary
          ? "bg-[#b9e000] text-[#061329] hover:bg-[#aace00]"
          : "border-[#cdd7e5] bg-white text-[#071733] hover:bg-[#f7f9fa]",
      )}
    >
      {action.icon}
      <span className="flex-1 whitespace-nowrap text-center">{action.label}</span>
      {action.trailingIcon ?? (primary ? <ArrowRight className="size-4" aria-hidden="true" /> : null)}
    </Link>
  );
}

function PreviewPanel({
  icon,
  previewContent,
  benefits,
}: Pick<FeatureStatusPageProps, "icon" | "previewContent" | "benefits">) {
  return (
    <div className="relative flex min-h-[500px] flex-col overflow-hidden rounded-[24px] bg-[#03183d] p-5 text-white sm:p-7 lg:min-h-[560px]">
      <Image
        src="/images/auth-promo-background.png"
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 58vw"
        className="object-cover object-center opacity-[0.08] mix-blend-screen"
      />
      <div className="relative flex min-h-[360px] flex-1 items-center justify-center py-8 sm:min-h-[400px]">
        <span className="absolute top-[28%] left-[2%] z-10 grid size-[88px] place-items-center rounded-2xl border border-white/25 bg-white text-4xl text-[#071733] shadow-[0_18px_40px_rgba(0,0,0,0.28)] sm:left-[4%] sm:size-[98px]">
          {icon}
        </span>
        <div className="relative z-10 w-full">{previewContent}</div>
      </div>

      {benefits?.length ? (
        <div className="relative z-10 grid overflow-hidden rounded-2xl border border-white/35 bg-white/95 text-[#071733] shadow-[0_15px_38px_rgba(0,0,0,0.16)] sm:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className={cn(
                "flex min-h-24 items-center gap-3 px-5 py-4",
                index > 0 && "border-t border-[#dfe5ee] sm:border-t-0 sm:border-l",
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#f7faee] text-[#91bd00]">
                {benefit.icon}
              </span>
              <span>
                <span className="block text-[0.76rem] font-bold leading-5">{benefit.title}</span>
                {benefit.description ? (
                  <span className="mt-0.5 block text-[0.66rem] leading-4 text-[#64738e]">{benefit.description}</span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeatureStatusCard(props: FeatureStatusPageProps) {
  const status = statusPresentation[props.status];
  const backHref = props.shellType && props.shellType !== "public" ? workspaceHome[props.shellType] : "/";
  const backLabel = props.shellType && props.shellType !== "public" ? "Back to workspace" : "Back to home";

  return (
    <section className="grid overflow-hidden rounded-[28px] border border-[#dce4ef] bg-white/95 p-4 shadow-[0_24px_70px_rgba(20,43,77,0.11)] lg:grid-cols-[550px_minmax(0,1fr)] lg:p-5">
      <div className="flex min-w-0 flex-col px-4 py-3 sm:px-8 sm:py-5 lg:px-10">
        <Link href={backHref} className="inline-flex items-center gap-3 text-sm font-semibold text-[#071733]">
          <ArrowLeft className="size-4 text-[#90be00]" aria-hidden="true" /> {backLabel}
        </Link>

        <div className="py-10 lg:pt-12 lg:pb-4">
          <p className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold", status.pillClass)}>
            <status.Icon className="size-4" aria-hidden="true" /> {status.label}
          </p>
          <h1 className="mt-7 max-w-[430px] text-[2.15rem] leading-[1.08] font-extrabold tracking-[-0.055em] text-[#071733] sm:text-[3rem] lg:text-[3.2rem]">
            {props.title}
          </h1>
          <span className="mt-6 block h-[3px] w-14 bg-[#a8d400]" aria-hidden="true" />
          <div className="mt-6 max-w-[390px] text-[0.98rem] leading-7 text-[#566987]">{props.description}</div>

          {props.primaryAction || props.secondaryAction ? (
            <div className="mt-6 grid max-w-[390px] gap-3">
              {props.primaryAction ? <ActionLink action={props.primaryAction} primary /> : null}
              {props.secondaryAction ? <ActionLink action={props.secondaryAction} /> : null}
            </div>
          ) : null}

          {props.assurance ? (
            <p className="mt-5 flex items-center gap-2 text-sm leading-6 text-[#536887]">
              <LockKeyhole className="size-4 text-[#071733]" aria-hidden="true" /> {props.assurance}
            </p>
          ) : null}
        </div>
      </div>

      <PreviewPanel icon={props.icon} previewContent={props.previewContent} benefits={props.benefits} />
    </section>
  );
}

function PublicStatusShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f8fd] text-[#071733]">
      <Image src="/images/auth-promo-background.png" alt="" fill sizes="100vw" className="object-cover opacity-40" priority />
      <div className="relative mx-auto w-full px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
        <GuestHeader brandSize="large" />

        <main className="mx-auto mt-8 w-full max-w-[1340px] lg:mt-10">{children}</main>

        <div className="mx-auto mt-3 grid max-w-[900px] gap-3 text-sm text-[#526580] sm:grid-cols-3" aria-label="Veterans Bay trust commitments">
          {[
            { icon: <ShieldCheck className="size-5" />, label: "Verified professionals" },
            { icon: <LockKeyhole className="size-5" />, label: "Secure platform" },
            { icon: <ShieldCheck className="size-5" />, label: "Trusted by thousands" },
          ].map((item, index) => (
            <div key={item.label} className={cn("flex items-center justify-center gap-3 py-2", index > 0 && "sm:border-l sm:border-[#d4ddea]")}>
              <span className="grid size-10 place-items-center rounded-full bg-[#edf2fb] text-[#071733]">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeatureStatusPage(props: FeatureStatusPageProps) {
  const shellType = props.shellType ?? "public";
  const card = <FeatureStatusCard {...props} shellType={shellType} />;

  if (shellType === "public") {
    return <PublicStatusShell>{card}</PublicStatusShell>;
  }

  return (
    <AuthenticatedShell
      kind={shellType}
      title="Feature status"
      description="Current availability information for this workspace feature."
      hideIntro
    >
      {card}
    </AuthenticatedShell>
  );
}

export const ComingSoonPage = FeatureStatusPage;
