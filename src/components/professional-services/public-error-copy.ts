/**
 * Maps public-catalogue API failures to user-safe copy.
 *
 * The web Worker fronts the API through a service binding, so infrastructure
 * failures (CPU limits, 1101/1102s, binding errors) can arrive as
 * `API_UNAVAILABLE` JSON. Those raw messages must never reach the UI —
 * architecture requires stable safe codes without internal details.
 */

export interface PublicApiErrorShape {
  code?: unknown;
  message?: unknown;
  status?: unknown;
}

/** Matches infrastructure internals that must never be user-visible. */
const INFRASTRUCTURE_ERROR_PATTERN =
  /worker exceeded|CPU time|preview API|service binding|temporarily unavailable|fetch failed|failed to fetch|network error|timeout|timed out|internal error|unexpected error|drizzle|neon|SQL|database|1101|1102|cloudflare/i;

function isInfrastructureFailure(error: PublicApiErrorShape): boolean {
  if (error.code === "API_UNAVAILABLE") return true;
  if (typeof error.status === "number" && error.status >= 500) return true;
  return INFRASTRUCTURE_ERROR_PATTERN.test(
    `${String(error.code ?? "")} ${String(error.message ?? "")}`,
  );
}

/**
 * Returns the server message when it is user-safe, otherwise the fallback.
 * Safe messages are the curated `AppError` strings (404s, validation);
 * infrastructure failures always resolve to the caller-supplied fallback.
 */
export function toSafePublicErrorMessage(
  error: PublicApiErrorShape | null | undefined,
  fallback: string,
): string {
  if (!error || isInfrastructureFailure(error)) return fallback;
  const message = typeof error.message === "string" ? error.message.trim() : "";
  return message || fallback;
}
