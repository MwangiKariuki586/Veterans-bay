import { app } from "./app";
import {
  handleDomainEventsQueue,
  handleOutboxScheduled,
} from "../../modules/outbox/handlers";
import type { ApiBindings } from "./types";

const worker = {
  fetch: app.fetch,
  async queue(batch: MessageBatch<unknown>, env: ApiBindings) {
    await handleDomainEventsQueue(batch, env);
  },
  async scheduled(_controller: ScheduledController, env: ApiBindings) {
    await handleOutboxScheduled(env);
  },
};

export default worker;
