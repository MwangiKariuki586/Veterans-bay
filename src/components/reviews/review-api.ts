import type { ReviewEligibility, ReviewItem } from "@/modules/reviews/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { message?: string } } | null;
  if (!response.ok || body?.data == null) throw new Error(body?.error?.message ?? "Reviews are unavailable.");
  return body.data;
}
export const getReviewEligibility = (jobId: string) => request<ReviewEligibility>(`/api/v1/client/jobs/${jobId}/review`);
export const submitReview = (jobId: string, values: Record<string, unknown>) => request<ReviewEligibility>(`/api/v1/client/jobs/${jobId}/review`, { method: "POST", body: JSON.stringify(values) });
export const listProfessionalReviews = () => request<ReviewItem[]>("/api/v1/professional/reviews");
export const respondToReview = (reviewId: string, body: string) => request<ReviewItem[]>(`/api/v1/professional/reviews/${reviewId}/respond`, { method: "POST", body: JSON.stringify({ body }) });
export const reportProfessionalReview = (reviewId: string) =>
  request<ReviewItem[]>(`/api/v1/professional/reviews/${reviewId}/report`, {
    method: "POST",
    body: JSON.stringify({
      reason: "OTHER",
      details: "Professional requested moderation review.",
    }),
  });
