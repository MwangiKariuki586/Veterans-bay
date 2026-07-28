"use client";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Surface } from "@/components/ui/surface";
import type { ReviewEligibility } from "@/modules/reviews/types";
import { getReviewEligibility, submitReview } from "./review-api";

export function ReviewJobPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<ReviewEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ratings, setRatings] = useState({
    overallRating: 5,
    serviceQualityRating: 5,
    communicationRating: 5,
    timelinessRating: 5,
    professionalismRating: 5,
    valueRating: 5,
  });
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    void getReviewEligibility(jobId)
      .then(setState)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Review unavailable."),
      );
  }, [jobId]);
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setState(await submitReview(jobId, { ...ratings, feedback }));
      toast.success("Your verified review is published.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Review could not be submitted.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (error && !state)
    return (
      <InlineAlert variant="error" title="Review unavailable">
        {error}
      </InlineAlert>
    );
  if (!state) return null;
  if (state.review)
    return (
      <Surface className="mt-5 p-5 shadow-none">
        <p className="text-sm font-semibold text-[#5f8d11]">
          Your verified review
        </p>
        <p className="mt-2 font-bold">{state.review.overallRating}/5</p>
        <p className="mt-2 text-sm text-[#68717b]">{state.review.feedback}</p>
        {state.review.response ? (
          <div className="mt-4 rounded-2xl bg-[#f3f5f6] p-4 text-sm">
            <strong>Professional response</strong>
            <p className="mt-2">{state.review.response.body}</p>
          </div>
        ) : null}
      </Surface>
    );
  if (!state.eligible) return null;
  return (
    <Surface className="mt-5 p-5 shadow-none">
      <p className="text-sm font-semibold text-[#5f8d11]">Verified review</p>
      <h2 className="mt-1 text-xl font-bold">Share your experience</h2>
      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(ratings).map(([key, value]) => (
            <label key={key} className="text-sm font-semibold capitalize">
              {key.replace("Rating", "").replace(/([A-Z])/g, " $1")}
              <select
                className="mt-1 min-h-11 w-full rounded-2xl border border-black/8 bg-white px-3"
                value={value}
                onChange={(e) =>
                  setRatings((current) => ({
                    ...current,
                    [key]: Number(e.target.value),
                  }))
                }
              >
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating}/5
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="block text-sm font-semibold">
          Written feedback
          <textarea
            className="mt-1 min-h-28 w-full rounded-2xl border border-black/8 p-3 font-normal"
            minLength={3}
            maxLength={4000}
            required
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </label>
        {error ? (
            <InlineAlert variant="error" title="Review not submitted">
            {error}
          </InlineAlert>
        ) : null}
        <Button type="submit" loading={busy}>
          Publish verified review
        </Button>
      </form>
    </Surface>
  );
}
