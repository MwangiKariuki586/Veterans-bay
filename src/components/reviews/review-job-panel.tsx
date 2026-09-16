"use client";

import {
  CheckCircle2,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Surface } from "@/components/ui/surface";
import type { ReviewEligibility } from "@/modules/reviews/types";
import { getReviewEligibility, submitReview } from "./review-api";

const ratingFields = [
  ["serviceQualityRating", "Service quality"],
  ["communicationRating", "Communication"],
  ["timelinessRating", "Timeliness"],
  ["professionalismRating", "Professionalism"],
  ["valueRating", "Value for money"],
] as const;

type RatingKey = (typeof ratingFields)[number][0];

export function ReviewJobPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<ReviewEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    serviceQualityRating: 5,
    communicationRating: 5,
    timelinessRating: 5,
    professionalismRating: 5,
    valueRating: 5,
  });
  const [feedback, setFeedback] = useState("");
  const overallRating = averageRating(ratings);

  useEffect(() => {
    void getReviewEligibility(jobId)
      .then(setState)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Review unavailable.",
        ),
      );
  }, [jobId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setState(await submitReview(jobId, { ...ratings, feedback }));
      toast.success("Your verified review is published.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Review could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !state) {
    return (
      <InlineAlert variant="error" title="Review unavailable">
        {error}
      </InlineAlert>
    );
  }
  if (!state) return null;

  if (state.review) {
    return (
      <div className="grid gap-5">
        <Surface className="overflow-hidden border-[#dce7cf] bg-white p-0 shadow-[0_12px_36px_rgba(19,42,24,0.07)]">
        <div className="border-b border-black/6 bg-[linear-gradient(120deg,#f7fbea_0%,#ffffff_72%)] px-5 py-5 sm:px-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#eaf5d7] text-[#5f8d11]">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#5f8d11]">
                  Verified review
                </p>
                <h2 className="mt-1 text-[0.84rem] font-semibold text-[#0b1e2e]">
                  Thanks for sharing your experience
                </h2>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#d8e7c6] bg-white px-3 py-2">
              <Star className="size-4 fill-[#f3b61f] text-[#f3b61f]" aria-hidden="true" />
              <span className="text-[0.76rem] font-semibold">
                {formatRating(state.review.overallRating)}
              </span>
            </div>
          </div>
        </div>
        <div className="px-5 py-6 sm:px-7">
          <div className="flex gap-1" aria-label={`${state.review.overallRating} out of 5 stars`}>
            {Array.from({ length: 5 }, (_, index) => (
              <Star
                key={index}
                className={`size-5 ${
                  index < state.review!.overallRating
                    ? "fill-[#f3b61f] text-[#f3b61f]"
                    : "text-[#cbd2d6]"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
          {state.review.feedback ? (
            <blockquote className="mt-4 max-w-3xl text-[0.76rem] leading-6 text-[#39454f]">
              “{state.review.feedback}”
            </blockquote>
          ) : (
            <p className="mt-4 text-[0.76rem] text-[#7a858e]">Rating-only review</p>
          )}
          {state.review.response ? (
            <div className="mt-6 rounded-2xl border border-black/6 bg-[#f7f9f8] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-[0.76rem] font-semibold">
                <MessageSquareText className="size-4 text-[#5f8d11]" aria-hidden="true" />
                Professional response
              </div>
              <p className="mt-2 text-[0.76rem] leading-6 text-[#5d6872]">
                {state.review.response.body}
              </p>
            </div>
          ) : null}
        </div>
        </Surface>

        {state.otherReviews.length ? (
          <Surface className="border-black/7 bg-white p-5 shadow-none sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#5f8d11]">
                  More verified reviews
                </p>
                <h2 className="mt-1 text-[0.84rem] font-semibold text-[#0b1e2e]">
                  What other clients say
                </h2>
                <p className="mt-1 text-[0.76rem] leading-5 text-[#75808a]">
                  Recent completed-service reviews for {state.review.providerName}.
                </p>
              </div>
              <span className="text-xs text-[#8a949c]">
                {state.otherReviews.length} recent review{state.otherReviews.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {state.otherReviews.map((review) => (
                <article
                  key={review.id}
                  className="flex min-h-48 flex-col rounded-2xl border border-black/7 bg-[#fafbfa] p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.76rem] font-semibold">{review.clientName}</p>
                      <time className="mt-1 block text-xs text-[#87919a]">
                        {new Date(review.submittedAt).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </time>
                    </div>
                    <span className="flex items-center gap-1 rounded-full bg-[#fff7dc] px-2.5 py-1 text-xs font-semibold text-[#755611]">
                      <Star className="size-3.5 fill-[#f3b61f] text-[#f3b61f]" aria-hidden="true" />
                      {formatRating(review.overallRating)}
                    </span>
                  </div>
                  <p className="mt-4 line-clamp-4 text-[0.76rem] leading-6 text-[#4f5b65]">
                    {review.feedback || "Rating-only review"}
                  </p>
                  {review.response ? (
                    <div className="mt-auto border-t border-black/6 pt-4 text-xs leading-5 text-[#68747e]">
                      <span className="font-semibold text-[#4f5b65]">Professional response:</span>{" "}
                      {review.response.body}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </Surface>
        ) : null}
      </div>
    );
  }

  if (!state.eligible) return null;

  const deadline = state.deadline
    ? new Date(state.deadline).toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <Surface className="overflow-hidden border-[#dce7cf] bg-white p-0 shadow-[0_12px_36px_rgba(19,42,24,0.07)]">
      <div className="border-b border-black/6 bg-[linear-gradient(120deg,#f4fae7_0%,#ffffff_72%)] px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e5f3cd] text-[#5f8d11]">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#5f8d11]">
                <ShieldCheck className="size-3.5" aria-hidden="true" />
                Verified review
              </div>
              <h2 className="mt-1.5 text-[0.84rem] font-semibold text-[#0b1e2e]">
                How did everything go?
              </h2>
              <p className="mt-1.5 max-w-2xl text-[0.76rem] leading-5 text-[#68747e]">
                Your feedback helps future clients choose confidently and helps
                professionals keep improving.
              </p>
            </div>
          </div>
          {deadline ? (
            <p className="rounded-full border border-[#d8e7c6] bg-white px-3 py-2 text-xs font-medium text-[#68747e]">
              Review by {deadline}
            </p>
          ) : null}
        </div>
      </div>

      <form className="grid gap-7 px-5 py-6 sm:px-7 sm:py-7" onSubmit={onSubmit}>
        <section aria-labelledby="overall-rating-label">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="overall-rating-label" className="text-[0.76rem] font-semibold text-[#0b1e2e]">
                Overall experience
              </p>
              <p className="mt-1 text-xs text-[#7a858e]">
                {ratingDescription(overallRating)}
              </p>
            </div>
            <span className="text-lg font-semibold text-[#17212a]">
              {formatRating(overallRating)}
              <span className="text-xs text-[#8a949c]">/5</span>
            </span>
          </div>
          <div
            className="mt-3 flex items-center gap-1"
            aria-label={`${formatRating(overallRating)} out of 5 stars, calculated from category ratings`}
          >
            {[1, 2, 3, 4, 5].map((rating) => (
              <span
                key={rating}
                className="grid size-11 place-items-center rounded-xl text-[#efb31d]"
              >
                <Star
                  className={`size-7 ${rating <= Math.round(overallRating) ? "fill-current" : "text-[#c7ced2]"}`}
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#8a949c]">
            Calculated automatically from the five category ratings below.
          </p>
        </section>

        <section aria-labelledby="detail-ratings-label">
          <div className="flex items-center justify-between gap-3">
            <p id="detail-ratings-label" className="text-[0.76rem] font-semibold text-[#0b1e2e]">
              Tell us what stood out
            </p>
            <span className="text-xs text-[#8a949c]">Sets your overall score</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ratingFields.map(([key, label]) => (
              <div
                key={key}
                className="rounded-2xl border border-black/7 bg-[#fafbfa] p-4"
              >
                <p className="text-[0.72rem] font-medium text-[#4d5963]">{label}</p>
                <StarRating
                  className="mt-2.5"
                  label={label}
                  value={ratings[key]}
                  disabled={busy}
                  onChange={(value) =>
                    setRatings((current) => ({ ...current, [key]: value }))
                  }
                />
              </div>
            ))}
          </div>
        </section>

        <label className="block text-[0.76rem] font-medium text-[#0b1e2e]">
          Share a few details{" "}
          <span className="font-normal text-[#7a858e]">(optional)</span>
          <span className="mt-1 block text-[0.72rem] font-normal text-[#7a858e]">
            What went well? Was there anything the professional could improve?
          </span>
          <textarea
            className="mt-3 min-h-32 w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-[0.76rem] font-normal leading-6 outline-none transition focus:border-[#7da82a] focus:ring-4 focus:ring-[#9bc53d]/12"
            maxLength={4000}
            value={feedback}
            placeholder="Describe your experience with the service…"
            onChange={(event) => setFeedback(event.target.value)}
          />
          <span className="mt-1.5 block text-right text-xs font-normal text-[#8a949c]">
            {feedback.length}/4000
          </span>
        </label>

        {error ? (
          <InlineAlert variant="error" title="Review not submitted">
            {error}
          </InlineAlert>
        ) : null}

        <div className="flex flex-col-reverse gap-3 border-t border-black/6 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs leading-5 text-[#73808a]">
            <ShieldCheck className="size-4 shrink-0 text-[#6f9e1c]" aria-hidden="true" />
            Published as a verified review for this completed service.
          </p>
          <Button
            type="submit"
            className="min-h-11 px-5 text-[0.76rem] font-medium"
            loading={busy}
          >
            Publish review <Send className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </Surface>
  );
}

function StarRating({
  label,
  value,
  onChange,
  disabled,
  large = false,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  large?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-1 ${className ?? ""}`}
      role="group"
      aria-label={`${label} rating`}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          className={`grid place-items-center rounded-xl text-[#c7ced2] transition hover:bg-[#f4f8ec] hover:text-[#efb31d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7da82a] disabled:cursor-not-allowed disabled:opacity-60 ${
            large ? "size-11" : "size-8"
          } ${rating <= value ? "text-[#efb31d]" : ""}`}
          aria-label={`${label}: ${rating} out of 5`}
          aria-pressed={rating === value}
          disabled={disabled}
          onClick={() => onChange(rating)}
        >
          <Star
            className={`${large ? "size-7" : "size-5"} ${
              rating <= value ? "fill-current" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

function ratingDescription(value: number) {
  if (value < 1.5) return "Needs improvement";
  if (value < 2.5) return "Fair";
  if (value < 3.5) return "Good";
  if (value < 4.5) return "Great";
  return "Excellent";
}

function averageRating(ratings: Record<RatingKey, number>) {
  const values = Object.values(ratings);
  return (
    Math.round(
      (values.reduce((total, value) => total + value, 0) / values.length) * 10,
    ) / 10
  );
}

function formatRating(value: number) {
  return value.toFixed(1);
}
