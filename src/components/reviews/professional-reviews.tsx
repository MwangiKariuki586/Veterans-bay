"use client";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { StatePanel } from "@/components/ui/state-panel";
import { Surface } from "@/components/ui/surface";
import type { ReviewItem } from "@/modules/reviews/types";
import {
  listProfessionalReviews,
  reportProfessionalReview,
  respondToReview,
} from "./review-api";

export function ProfessionalReviews() {
  const [reviews, setReviews] = useState<ReviewItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void listProfessionalReviews()
      .then(setReviews)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Reviews unavailable."),
      );
  }, []);
  async function respond(event: FormEvent, id: string) {
    event.preventDefault();
    try {
      setReviews(await respondToReview(id, drafts[id] ?? ""));
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Response could not be published.",
      );
    }
  }
  let content;
  if (error && !reviews) {
    content = (
      <StatePanel
        variant="error"
        title="Reviews unavailable"
        description={error}
      />
    );
  } else if (!reviews) {
    content = (
      <StatePanel
        variant="loading"
        title="Loading reviews"
        description="Retrieving verified client feedback."
      />
    );
  } else if (!reviews.length) {
    content = (
      <StatePanel
        title="No verified reviews yet"
        description="Completed-job reviews will appear here."
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        {error ? (
          <InlineAlert variant="error" title="Action failed">
            {error}
          </InlineAlert>
        ) : null}
        {reviews.map((review) => (
          <Surface key={review.id} className="p-5 shadow-none">
            <div className="flex justify-between gap-4">
              <div>
                <p className="font-semibold">{review.clientName}</p>
                <p className="mt-1 text-xs text-[#68717b]">
                  {review.serviceName}
                </p>
              </div>
              <span className="rounded-full bg-[#eef8c8] px-3 py-1 text-sm font-semibold text-[#5f8d11]">
                {review.overallRating}/5
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-[#68717b]">
              {review.feedback}
            </p>
            {review.status !== "PUBLISHED" ? (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                Moderation status: {review.status.toLowerCase()}
              </p>
            ) : null}
            {review.response ? (
              <div className="mt-4 rounded-2xl bg-[#f3f5f6] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#68717b]">
                  Your public response
                </p>
                <p className="mt-2 text-sm">{review.response.body}</p>
              </div>
            ) : (
              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row"
                onSubmit={(e) => void respond(e, review.id)}
              >
                <input
                  className="min-h-11 flex-1 rounded-2xl border border-black/8 px-4 text-sm"
                  required
                  minLength={2}
                  maxLength={2000}
                  placeholder="Write one public response"
                  value={drafts[review.id] ?? ""}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [review.id]: e.target.value }))
                  }
                />
                <Button type="submit">Publish response</Button>
              </form>
            )}
            {review.status === "PUBLISHED" ? (
              <Button
                className="mt-3"
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  void reportProfessionalReview(review.id)
                    .then(setReviews)
                    .catch((cause) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Review could not be reported.",
                      ),
                    )
                }
              >
                Report for moderation
              </Button>
            ) : null}
          </Surface>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[#5f8d11]">Reputation</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-title">Reviews</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68717b]">
        Read verified client feedback, publish professional responses, and flag
        reviews that need moderation.
      </p>
      <div className="mt-6">{content}</div>
    </div>
  );
}
