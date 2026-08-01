import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Headphones,
  Lock,
  ShieldCheck,
  Star,
  Store,
  Tag,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

const valueProps = [
  {
    title: "More Jobs",
    description: "Reach homeowners actively looking for trusted help.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Trusted Platform",
    description: "Build credibility with verified reviews and badges.",
    icon: ShieldCheck,
  },
  {
    title: "Fair Pricing",
    description: "Transparent fees with no surprises after the job.",
    icon: Tag,
  },
  {
    title: "Grow Your Business",
    description: "Tools to manage quotes, bookings, and repeat work.",
    icon: BarChart3,
  },
] as const;

const steps = [
  { title: "Create Account", icon: User },
  { title: "Complete Profile", icon: FileText },
  { title: "Get Verified", icon: ShieldCheck },
  { title: "Set Preferences", icon: Store },
  { title: "Start Getting Jobs", icon: BriefcaseBusiness },
] as const;

const whyJoin = [
  "Verified customer demand in your area",
  "Background-checked professional network",
  "Clear invoices and auditable manual records",
  "Built-in messaging and scheduling",
  "Warranty and dispute support",
] as const;

export function BecomeProfessionalPage() {
  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#68717b] hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to Home
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.75fr)]">
        <div className="space-y-6">
          <Surface className="overflow-hidden p-0 shadow-none">
            <div className="grid gap-6 p-6 sm:grid-cols-[1.1fr_0.9fr] sm:p-8">
              <div>
                <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
                  Become a Professional
                </h1>
                <p className="mt-4 text-sm leading-6 text-[#68717b]">
                  Connect with customers who need verified home service experts.
                  Join Veterans Bay and grow with a platform built for trusted
                  workmanship.
                </p>
              </div>
              <div className="relative min-h-[220px] overflow-hidden rounded-[18px]">
                <Image
                  src="/images/featured-professional.png"
                  alt="Veterans Bay professional"
                  fill
                  className="object-cover"
                  sizes="360px"
                />
              </div>
            </div>
          </Surface>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {valueProps.map(({ title, description, icon: Icon }) => (
              <Surface key={title} className="p-5 shadow-none">
                <span className="grid size-10 place-items-center rounded-full bg-[#eef8c8] text-[#5f8d11]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <h2 className="mt-4 text-sm font-bold">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-[#68717b]">
                  {description}
                </p>
              </Surface>
            ))}
          </div>

          <Surface className="p-6 shadow-none sm:p-8">
            <h2 className="text-xl font-bold">How It Works</h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-5">
              {steps.map(({ title, icon: Icon }, index) => (
                <li key={title} className="text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-sm font-bold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-3 grid place-items-center text-[#5f8d11]">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-2 text-xs font-semibold">{title}</p>
                </li>
              ))}
            </ol>
          </Surface>

          <Surface className="relative overflow-hidden p-0 shadow-none">
            <div className="relative min-h-[220px]">
              <Image
                src="/images/homepage-hero.png"
                alt=""
                fill
                className="object-cover"
                sizes="800px"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,21,34,0.88),rgba(7,21,34,0.45))]" />
              <div className="relative z-10 max-w-xl p-7 text-white sm:p-9">
                <h2 className="text-2xl font-bold tracking-[-0.03em]">
                  Ready to Grow Your Business?
                </h2>
                <p className="mt-3 text-sm text-white/80">
                  Join now and connect with customers looking for trusted
                  professionals.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/register"
                    className={cn(
                      buttonVariants(),
                      "h-12 justify-between rounded-full pr-1.5 pl-5",
                    )}
                  >
                    Create Your Professional Account
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-white">
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                  <Link
                    href="/how-it-works"
                    className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold text-white"
                  >
                    Learn More <ArrowRight className="size-4" />
                  </Link>
                </div>
                <p className="mt-4 text-xs text-white/70">
                  It only takes a few minutes. No hidden fees.
                </p>
              </div>
            </div>
          </Surface>
        </div>

        <aside className="space-y-4">
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">Why Join Veterans Bay?</h2>
            <ul className="mt-4 space-y-3">
              {whyJoin.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-[#68717b]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#5f8d11]" />
                  {item}
                </li>
              ))}
            </ul>
          </Surface>
          <Surface className="p-5 shadow-none">
            <h2 className="font-bold">You&apos;re in Good Company</h2>
            <dl className="mt-4 grid gap-4">
              {[
                ["3,200+", "Verified Professionals"],
                ["25,000+", "Happy Customers"],
                ["98%", "Satisfaction Rate"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="text-2xl font-bold">{value}</dt>
                  <dd className="text-xs text-[#68717b]">{label}</dd>
                </div>
              ))}
            </dl>
          </Surface>
          <Surface className="p-5 shadow-none">
            <p className="text-sm leading-6 text-[#68717b]">
              “Veterans Bay has been a game changer for my plumbing business.
              Reliable leads and clear bookings.”
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Image
                src="/images/header-avatar.png"
                alt=""
                width={40}
                height={40}
                className="size-10 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-semibold">Mark D. Plumbing</p>
                <p className="inline-flex items-center gap-1 text-xs font-semibold">
                  <Star className="size-3 fill-[#ffb81c] text-[#ffb81c]" /> 4.9
                </p>
              </div>
            </div>
          </Surface>
          <Surface className="bg-[#eef8c8] p-5 shadow-none">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              <Headphones className="size-4" /> Need help getting started?
            </p>
            <Link
              href="/contact"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "mt-4 h-11 w-full justify-between rounded-full border-transparent bg-white pr-1 pl-4 text-xs",
              )}
            >
              Contact Support
              <span className="grid size-8 place-items-center rounded-full bg-secondary text-white">
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
            <p className="mt-3 inline-flex items-center gap-1 text-[0.7rem] text-[#3d4a2a]">
              <Lock className="size-3" /> Secure onboarding and support
            </p>
          </Surface>
        </aside>
      </div>
    </div>
  );
}
