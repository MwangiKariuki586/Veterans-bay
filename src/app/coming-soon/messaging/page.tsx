import {
  ArrowLeft,
  Clock3,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { FeatureStatusPage } from "@/components/public/coming-soon-page";

function MessagingPreview() {
  return (
    <div className="relative mx-auto flex min-h-[330px] w-full max-w-[560px] flex-col justify-center gap-4 px-5 sm:px-20">
      <div className="w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/65 bg-white text-[#071733] shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <div className="flex items-center justify-between bg-[#071b48] px-4 py-3 text-white">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-full bg-white/15">
              <MessageCircle className="size-4" aria-hidden="true" />
            </span>
            Messages
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
            3 new
          </span>
        </div>
        <div className="space-y-3 px-4 py-4">
          {[
            {
              name: "Assemble Pro Kenya",
              preview:
                "Thanks for your request — we'll share a quotation shortly.",
              time: "2m ago",
              unread: true,
            },
            {
              name: "Sparkle Clean Services",
              preview: "Your booking for tomorrow 09:00 is confirmed.",
              time: "1h ago",
              unread: true,
            },
            {
              name: "Support",
              preview: "Your warranty claim is being reviewed.",
              time: "Yesterday",
              unread: false,
            },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-start gap-3 rounded-xl border border-[#e4e9f0] bg-[#f8fafc] px-3 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef8c8] text-xs font-semibold text-[#3d6b00]">
                {item.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[#071733]">
                    {item.name}
                  </span>
                  {item.unread ? (
                    <span
                      className="size-2 shrink-0 rounded-full bg-[#b9e000]"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 line-clamp-1 block text-xs leading-5 text-[#64738e]">
                  {item.preview}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-[#8a9aa8]">
                {item.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute top-[42%] right-0 hidden w-28 -translate-y-1/2 rounded-2xl border-2 border-[#b9e000] bg-[#fbffe9] px-3 py-5 text-center text-[#071733] shadow-[0_15px_35px_rgba(0,0,0,0.2)] sm:block">
        <ShieldCheck className="mx-auto size-8" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold leading-5">
          Secure &amp; trusted
        </p>
      </div>
    </div>
  );
}

export default function MessagingComingSoonPage() {
  return (
    <FeatureStatusPage
      status="coming-soon"
      shellType="public"
      title={
        <>
          Messaging
          <br />
          is coming to <span className="text-[#98c900]">Veterans Bay</span>
        </>
      }
      description={
        <>
          Direct in-app messaging with professionals is on the way. For now, use{" "}
          <span className="font-semibold text-[#071733]">Book Now</span> or send
          a request your conversation lives in the request thread and we&apos;ll
          notify you when they reply.
        </>
      }
      icon={<MessageCircle className="size-14" />}
      primaryAction={{
        href: "/marketplace",
        label: "Browse services",
        icon: <Search className="size-4" />,
      }}
      secondaryAction={{
        href: "/",
        label: "Back to home",
        icon: <ArrowLeft className="size-4" />,
      }}
      previewContent={<MessagingPreview />}
      assurance="Your conversations will stay private and secure."
      benefits={[
        {
          icon: <MessageCircle className="size-5" />,
          title: "Direct conversations",
        },
        { icon: <Clock3 className="size-5" />, title: "Timely notifications" },
        {
          icon: <Sparkles className="size-5" />,
          title: "Request-aware threads",
        },
      ]}
    />
  );
}
