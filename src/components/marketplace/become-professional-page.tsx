import {
  ArrowRight,
  Check,
  Play,
  Search,
  ShieldCheck,
  Star,
  Store,
  UsersRound,
  Mail,
  Quote,
  Award,
  CalendarDays,
  CalendarCheck2,
  Heart,
  Smile,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function BecomeProfessionalPage() {
  return (
    <div className="relative -mt-8 w-full">
      {/* HERO — perfect landing-style card: rounded, bg-[#f3f1ed], narrow content + absolute image + matching gradient fade */}
      <div className="mt-10 w-full sm:mt-10 lg:mt-12">
        <section
          className="relative min-h-[560px] overflow-hidden bg-transparent sm:min-h-[520px] lg:min-h-[520px]"
          aria-labelledby="become-hero-title"
        >
          {/* left copy — constrained to w-[74%]/[64%]/[54%] like landing HeroCard, so fade zone stays clean — no card border, silk edge */}
          <div className="relative z-10 flex h-full min-h-[560px] w-[74%] flex-col justify-center py-7 sm:min-h-[520px] sm:w-[64%] sm:py-8 lg:min-h-[520px] lg:w-[54%] lg:pr-8">
            <h1
              id="become-hero-title"
              className="max-w-[560px] text-[1.75rem] font-semibold  leading-[1.06] tracking-title text-[#0b1c33] min-[360px]:text-[2rem] sm:text-[2.45rem] lg:text-[2.95rem]"
            >
              Grow your
              <br />
              service business
              <br />
              with <span className="text-[#7cb518]">trusted demand.</span>
            </h1>
            <p className="mt-4 max-w-[480px] text-[0.78rem] leading-6 text-[#5a6672] sm:text-[0.84rem]">
              Veterans Bay helps skilled professionals get discovered, manage
              work, and build a reputation that grows.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/register"
                className="inline-flex h-11 items-center gap-3 rounded-full bg-[#c8f43d] py-1 pr-1 pl-5 text-[0.78rem] font-medium text-[#071522] shadow-[0_8px_22px_rgba(200,244,61,0.18)] transition hover:bg-[#b8e832] sm:h-[44px] sm:pl-5 sm:text-[0.8rem]"
              >
                Create Professional Account
                <span className="grid size-8 place-items-center rounded-full bg-[#071522] text-white sm:size-[34px]">
                  <ArrowRight className="size-4" aria-hidden="true" />
                </span>
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-5 text-[0.78rem] font-medium text-[#071522] shadow-[0_6px_18px_rgba(9,22,34,0.06)] transition hover:bg-[#f7f9fa] sm:h-[44px]"
              >
                See how it works
                <span className="grid size-7 place-items-center rounded-full border border-black/10 bg-white">
                  <Play
                    className="size-3 fill-[#071522] text-[#071522]"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.68rem] font-medium text-[#5a6672] sm:text-[0.72rem]">
              <span className="inline-flex items-center gap-1.5 text-[#0b1c33]">
                <span className="grid size-[14px] place-items-center rounded-full bg-[#c8f43d] text-[#071522]">
                  <Check className="size-2.5 stroke-[3]" aria-hidden="true" />
                </span>
                Verified demand
              </span>
              <span
                className="size-1 rounded-full bg-[#c8f43d]"
                aria-hidden="true"
              />
              <span>Protected work history</span>
              <span
                className="size-1 rounded-full bg-[#c8f43d]"
                aria-hidden="true"
              />
              <span>Reputation that follows you</span>
            </div>
          </div>

          {/* right image — transparency mask lets the page backdrop blend through without a hard edge */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[56%] sm:w-[58%] lg:w-[54%]">
            <Image
              src="/images/featured-professional.png"
              alt="Verified Veterans Bay professional"
              fill
              priority
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 58vw, 62vw"
              className="object-cover object-top"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 28%, #000 62%)",
                maskImage:
                  "linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.35) 28%, #000 62%)",
              }}
            />
          </div>
        </section>
      </div>

      {/* BUILT FOR PROFESSIONALS — full-bleed page backdrop, inner aligned to nav/footer */}
      <section className="relative ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] w-screen max-w-[100vw] bg-transparent">
        <div className="mx-auto w-full max-w-[1340px] px-4 pb-10 pt-5 sm:px-6 sm:pb-12 lg:px-[26px] lg:pb-9 lg:pt-4">
          <div className="text-center">
            <p className="text-[0.68rem] font-semibold tracking-[0.1em] text-[#9bc821] sm:text-[0.72rem]">
              BUILT TO HELP YOU GROW
            </p>
            <h2 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-title text-[#0b1c33] sm:text-[1.75rem] lg:text-[1.9rem]">
              Built for professionals who want to grow.
            </h2>
          </div>

          <div className="mt-5 grid gap-9 lg:grid-cols-3 lg:gap-8 xl:gap-12">
            {/* Card 1 */}
            <article className="relative">
              <div className="relative h-[216px] xl:mx-4">
                <div className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#eceff1]">
                  <Image
                    src="/images/professional-growth-plumber.png"
                    alt="Professional repairing plumbing beneath a kitchen sink"
                    fill
                    sizes="(min-width: 1280px) 340px, (min-width: 1024px) 30vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                {/* overlay leads card */}
                <div className="absolute left-3 top-1/2 w-[160px] -translate-y-1/2 rounded-[15px] border border-[#e4e7e9] bg-white p-3 shadow-[0_12px_30px_rgba(9,22,34,0.14)] min-[1360px]:-left-4">
                  <p className="text-[0.61rem] font-semibold text-[#0b1c33]">
                    New leads in your area
                  </p>
                  <div className="mt-2 grid gap-2.5">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/images/avatar-1.png"
                        alt=""
                        width={30}
                        height={30}
                        className="size-[30px] rounded-md object-cover"
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[0.58rem] font-semibold text-[#0b1c33]">
                          Kitchen Plumbing
                        </span>
                        <span className="mt-0.5 block text-[0.54rem] text-[#7a8188]">
                          Lagos, Nigeria
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Image
                        src="/images/avatar-2.png"
                        alt=""
                        width={30}
                        height={30}
                        className="size-[30px] rounded-md object-cover"
                      />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[0.58rem] font-semibold text-[#0b1c33]">
                          Pipe Installation
                        </span>
                        <span className="mt-0.5 block text-[0.54rem] text-[#7a8188]">
                          Abuja, Nigeria
                        </span>
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/professional/enquiries"
                    className="mt-2.5 flex h-7 items-center justify-center rounded-full border border-[#dfe3e6] bg-white text-[0.58rem] font-semibold text-[#0b1c33] transition hover:border-[#b7d856] hover:bg-[#f8fce9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cb518]"
                  >
                    View all leads
                  </Link>
                </div>
              </div>
              <div className="mt-3.5 flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#c8f43d] text-[#5d8509]">
                  <Search
                    className="size-5"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="text-[0.98rem] font-semibold leading-[1.15] text-[#0b1c33]">
                    Get discovered by real
                    <br />
                    customers in your area
                  </h3>
                  <p className="mt-2 max-w-[300px] text-[0.78rem] leading-[1.45] text-[#68717b]">
                    We connect you with people actively looking for services you
                    provide.
                  </p>
                </div>
              </div>
            </article>

            {/* Card 2 */}
            <article className="relative">
              <div className="relative h-[216px] xl:mx-4">
                <div className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#eceff1]">
                  <Image
                    src="/images/professional-growth-dashboard.png"
                    alt="Professional reviewing her work schedule"
                    fill
                    sizes="(min-width: 1280px) 340px, (min-width: 1024px) 30vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                {/* overlay jobs card */}
                <div className="absolute left-3 top-1/2 w-[160px] -translate-y-1/2 rounded-[15px] border border-[#e4e7e9] bg-white p-3 leading-4 shadow-[0_12px_30px_rgba(9,22,34,0.14)] min-[1360px]:-left-5">
                  <p className="text-[0.61rem] font-semibold text-[#0b1c33]">
                    Jobs
                  </p>
                  <div className="mt-2 grid divide-y divide-[#edf0f2]">
                    {[
                      ["New Enquiries", "8"],
                      ["Quotes Sent", "12"],
                      ["Bookings", "5"],
                      ["In progress", "3"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-[0.57rem] font-medium text-[#5a6672]">
                          {label}
                        </span>
                        <span className="text-[0.58rem] font-semibold text-[#8a949d]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Link
                    href="/professional"
                    className="mt-2 flex h-7 items-center justify-center rounded-full border border-[#dfe3e6] bg-white text-[0.58rem] font-semibold text-[#0b1c33] transition hover:border-[#b7d856] hover:bg-[#f8fce9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7cb518]"
                  >
                    View Dashboard
                  </Link>
                </div>
              </div>
              <div className="mt-3.5 flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#c8f43d] text-[#5d8509]">
                  <CalendarDays
                    className="size-5"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="text-[0.98rem] font-semibold leading-[1.15] text-[#0b1c33]">
                    Manage enquiries, quotes,
                    <br />
                    bookings, and jobs in one place
                  </h3>
                  <p className="mt-2 max-w-[300px] text-[0.78rem] leading-[1.45] text-[#68717b]">
                    Everything you need to run your business, from first message
                    to happy customer.
                  </p>
                </div>
              </div>
            </article>

            {/* Card 3 */}
            <article className="relative">
              <div className="relative h-[216px] xl:mx-4">
                <div className="absolute inset-0 overflow-hidden rounded-[18px] bg-[#eef0f2]">
                  <Image
                    src="/images/professional-growth-reputation.png"
                    alt="Customer viewing a professional profile and reviews"
                    fill
                    sizes="(min-width: 1280px) 340px, (min-width: 1024px) 30vw, 100vw"
                    className="object-cover object-center"
                  />
                </div>
                {/* overlay rating card - right */}
                <div className="absolute right-3 top-1/2 w-[160px] -translate-y-1/2 rounded-[15px] border border-[#e4e7e9] bg-white p-3 shadow-[0_12px_30px_rgba(9,22,34,0.14)] min-[1360px]:-right-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[0.88rem] font-semibold text-[#0b1c33]">
                      4.9
                    </span>
                    <span className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-3 fill-[#ffb81c] text-[#ffb81c]"
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.56rem] text-[#7a8188]">
                    Based on 66 reviews
                  </p>
                  <div className="mt-2.5 grid gap-2 border-t border-black/5 pt-2.5">
                    {[
                      "ID Verified",
                      "Background Checked",
                      "Phone Verified",
                      "Email Verified",
                    ].map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 text-[0.57rem] font-medium text-[#2b3a4a]"
                      >
                        <span className="grid size-3 place-items-center rounded-full bg-[#e8f5b8] text-[#6a9a0a]">
                          <Check
                            className="size-2 stroke-[3]"
                            aria-hidden="true"
                          />
                        </span>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3.5 flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#c8f43d] text-[#5d8509]">
                  <ShieldCheck
                    className="size-5"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </span>
                <div>
                  <h3 className="text-[0.98rem] font-semibold leading-[1.15] text-[#0b1c33]">
                    Build trust with reviews,
                    <br />
                    verification, and job history
                  </h3>
                  <p className="mt-2 max-w-[300px] text-[0.78rem] leading-[1.45] text-[#68717b]">
                    Showcase your work, earn great reviews, and grow a
                    reputation that brings more work.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — full-bleed white */}
      <section className="relative w-screen max-w-[100vw] ml-[calc(50%-50vw)] mr-[calc(50%-50vw)]">
        <div className="mx-auto w-full max-w-[1340px] px-4 py-10 sm:px-6 sm:py-10 lg:px-[26px] lg:py-10">
          <div className="text-center">
            <p className="text-[0.62rem] font-semibold tracking-[0.12em] text-[#8ab50a]">
              SIMPLE. FAST. EFFECTIVE.
            </p>
            <h2 className="mt-1 text-[1.35rem] font-semibold tracking-title text-[#0b1c33] sm:text-[1.45rem]">
              How it works
            </h2>
          </div>

          <div className="relative mt-8 grid gap-8 sm:grid-cols-3 sm:gap-4 lg:gap-8">
            {/* dashed line */}
            <div
              className="pointer-events-none absolute left-[16%] right-[16%] top-[18px] hidden h-px border-t border-dashed border-[#c2cdd5] sm:block"
              aria-hidden="true"
            />
            {[
              {
                n: "01",
                title: "Join & Verify",
                desc: "Create your account and complete verification to build trust instantly.",
                icon: UsersRound,
              },
              {
                n: "02",
                title: "Set Up Your Business",
                desc: "Add your services, set your preferences, and tell customers what you do best.",
                icon: Store,
              },
              {
                n: "03",
                title: "Start Receiving Work",
                desc: "Get matched with real customers and grow your business on your terms.",
                icon: Mail,
              },
            ].map(({ n, title, desc, icon: Icon }) => (
              <div key={n} className="relative text-center">
                <span className="mx-auto grid size-8 place-items-center rounded-full bg-[#c8f43d] text-[0.68rem] font-semibold text-[#0b1c33] sm:size-9 sm:text-[0.72rem]">
                  {n}
                </span>
                <span className="mx-auto mt-3 grid place-items-center text-[#0b1c33]/70">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-[0.82rem] font-semibold text-[#0b1c33]">
                  {title}
                </h3>
                <p className="mx-auto mt-1.5 max-w-[230px] text-[0.7rem] leading-5 text-[#68717b]">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMUNITY PROOF — testimonial evidence integrated beneath the profile */}
      <section className="relative w-full overflow-hidden rounded-[22px] bg-[#071a2c]">
        <div className="relative mx-auto grid w-full max-w-[1340px] px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:px-12 lg:py-14">
          <div className="lg:flex lg:h-full lg:flex-col">
            <p className="text-[0.68rem] font-semibold tracking-[0.08em] text-[#c8f43d]">
              A GROWING COMMUNITY OF
            </p>
            <h2 className="mt-4 text-[1.8rem] font-semibold leading-[1.12] tracking-title text-white sm:text-[2.1rem] lg:text-[2.35rem]">
              Trusted Professionals
              <br />
              &amp; Happy Customers
            </h2>

            <div className="mt-9 grid grid-cols-3">
              {[
                {
                  value: "3,200+",
                  label: "Verified Professionals",
                  icon: UsersRound,
                  proofIcon: ShieldCheck,
                },
                {
                  value: "25,000+",
                  label: "Happy Customers",
                  icon: Heart,
                  proofIcon: Smile,
                },
                {
                  value: "98%",
                  label: "Satisfaction Rate",
                  icon: ShieldCheck,
                  proofIcon: Star,
                },
              ].map(
                ({ value, label, icon: Icon, proofIcon: ProofIcon }, index) => (
                  <div
                    key={value}
                    className={`px-2 text-center sm:px-5 ${index > 0 ? "border-l border-white/25" : ""}`}
                  >
                    <Icon
                      className="mx-auto size-7 text-[#c8f43d]"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-[1.55rem] font-semibold leading-none tracking-title text-[#c8f43d] sm:text-[1.85rem]">
                      {value}
                    </p>
                    <p className="mx-auto mt-2 max-w-[110px] text-[0.68rem] font-medium leading-5 text-white/90">
                      {label}
                    </p>
                    <ProofIcon
                      className="mx-auto mt-3 size-5 text-white/90"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                ),
              )}
            </div>

            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:mt-auto lg:pt-9">
              <div className="flex -space-x-2.5">
                {[
                  "avatar-1.png",
                  "avatar-2.png",
                  "avatar-3.png",
                  "stats-avatar-1.png",
                  "stats-avatar-2.png",
                ].map((src) => (
                  <Image
                    key={src}
                    src={`/images/${src}`}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 rounded-full border-2 border-white object-cover"
                  />
                ))}
              </div>
              <span
                className="hidden h-9 w-px bg-white/25 sm:block"
                aria-hidden="true"
              />
              <p className="max-w-[220px] text-center text-[0.76rem] leading-5 text-white/85 sm:text-left">
                Join thousands of pros delivering excellent work every day.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col border-t border-white/20 pt-9 lg:mt-0 lg:h-full lg:border-t-0 lg:pt-0">
            <Quote
              className="size-10 fill-[#c8f43d] text-[#c8f43d]"
              aria-hidden="true"
            />
            <h3 className="mt-4 max-w-[380px] text-[1.35rem] font-semibold leading-[1.3] text-white sm:text-[1.55rem]">
              Reliable leads and easier scheduling helped me grow faster.
            </h3>
            <p className="mt-5 max-w-[390px] text-[0.78rem] leading-6 text-white/75">
              Veterans Bay connects me with quality customers. I spend less time
              searching and more time doing what I do best.
            </p>
            <div className="mt-6  pt-6 lg:mt-auto">
              <div className="flex items-center gap-3">
                <Image
                  src="/images/avatar-1.png"
                  alt="Mark D. Plumbing"
                  width={52}
                  height={52}
                  className="size-[52px] rounded-full border-2 border-white object-cover"
                />
                <div>
                  <p className="text-[0.84rem] font-semibold text-white">
                    Mark D. Plumbing
                  </p>
                  <p className="mt-0.5 text-[0.7rem] text-white/70">
                    Plumber &nbsp;•&nbsp; Lagos, Nigeria
                  </p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-3 fill-[#c8f43d] text-[#c8f43d]"
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                    <span className="text-[0.7rem] font-medium text-white/85">
                      4.9
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 divide-x divide-white/2 pt-5">
                <div className="flex items-center gap-3 pr-4 sm:pr-6">
                  <CalendarCheck2
                    className="size-7 shrink-0 text-[#c8f43d]"
                    strokeWidth={1.6}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-[1.55rem] font-semibold leading-none tracking-title text-[#c8f43d]">
                      42
                    </p>
                    <p className="mt-1 text-[0.68rem] font-medium leading-4 text-white/85">
                      Completed jobs
                      <span className="block text-white/60">in 6 months</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-4 sm:pl-6">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/45 text-white">
                    <Award className="size-[18px]" aria-hidden="true" />
                  </span>
                  <p className="text-[0.7rem] font-medium leading-5 text-white/85">
                    Top Rated
                    <span className="block">Professional</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
