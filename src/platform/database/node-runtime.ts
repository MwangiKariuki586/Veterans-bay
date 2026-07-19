import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

/**
 * Node.js scripts and database tests need an explicit WebSocket constructor.
 * Cloudflare Workers provide a global WebSocket and must not import this module.
 */
export function configureNodeDatabaseRuntime(): void {
  neonConfig.webSocketConstructor = ws;
}
