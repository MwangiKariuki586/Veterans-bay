// The OpenNext build generates this module before Wrangler bundles the Worker.
// @ts-expect-error Generated JavaScript is intentionally outside TypeScript's source tree.
import openNextWorker from "./.open-next/worker.js";

interface WebWorkerEnvironment {
  API: Fetcher;
}

export default {
  async fetch(
    request: Request,
    environment: WebWorkerEnvironment,
    context: ExecutionContext,
  ): Promise<Response> {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      try {
        return await environment.API.fetch(request);
      } catch (error) {
        // Prevent 1101/1102 HTML when API exceeds resource limits while
        // sharing the dev DB. Return JSON so the UI can handle it.
        // Never forward raw Worker internals (CPU limits, binding errors)
        // to the browser — log them server-side and return safe copy.
        const requestId = crypto.randomUUID();
        const raw = error instanceof Error ? error.message : String(error);
        console.error(
          `[web-api-proxy] requestId=${requestId} api unavailable: ${raw.slice(0, 500)}`,
        );
        return new Response(
          JSON.stringify({
            error: {
              code: "API_UNAVAILABLE",
              message:
                "Service data is temporarily unavailable. Please try again in a moment.",
            },
            requestId,
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          },
        );
      }
    }

    return openNextWorker.fetch(request, environment, context);
  },
} satisfies ExportedHandler<WebWorkerEnvironment>;
