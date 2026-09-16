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
      return environment.API.fetch(request);
    }

    return openNextWorker.fetch(request, environment, context);
  },
} satisfies ExportedHandler<WebWorkerEnvironment>;
