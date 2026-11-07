import { SseSync } from "@nn/sse-sync";
import { Store } from "@nn/store";
import { schema } from "example-schema";

import logger from "./modules/logger";
import { watchTodos } from "./todo-watcher";

const store = new Store(schema);
const sseSync = SseSync.attach(store, new URL(process.env.REMOTE_URL ?? ""));

sseSync.delegate = { syncEngineDidFail: (_engine, error) => logger.error({ err: error }, "Sync failed") };

sseSync.session.changes.subscribe((state) => {
	logger.info(`Sync ${state}`);

	if (sseSync.session.disconnected) setTimeout(() => sseSync.session.retry(), 5000);
});

try {
	watchTodos(store, sseSync);
} catch (error) {
	logger.fatal({ err: error }, "Watch failed");
	process.exit(1);
}
