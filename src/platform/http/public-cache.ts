import type { Context } from "hono";

/** Short-lived caching is limited to public, non-live marketplace projections. */
export function applyPublicProjectionCache(context: Context) {
  context.header(
    "cache-control",
    "public, max-age=30, stale-while-revalidate=60",
  );
  context.header("vary", "Origin, Accept-Encoding");
}
