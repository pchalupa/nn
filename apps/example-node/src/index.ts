import { readFileSync, watch } from "node:fs";
import { join, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { SseSync } from "@nn/sse-sync";
import { Store } from "@nn/store";
import { schema } from "example-schema";

import { logger } from "./modules/logger";

const store = new Store(schema);
const sseSync = new SseSync(store, new URL(process.env.REMOTE_URL ?? ""));

const root = fileURLToPath(new URL("../../../packages", import.meta.url));

sseSync.onError((error) => logger.error({ err: error }, "Sync failed"));
sseSync.onStateChange((state) => logger.info(`Sync ${state}`));

sseSync.connect();

try {
	watch(root, { recursive: true }, (_event, file) => {
		if (sseSync.connected && file && file.split(sep).some((name) => name === "node_modules" || name.startsWith("."))) {
			try {
				const lines = readFileSync(join(root, file), "utf8").split("\n");

				store.update((draft) => {
					const ids = new Set(draft.tickets.map((ticket) => ticket.id));

					for (const [index, line] of lines.entries()) {
						const title = /\/\/ TODO: (.+)/.exec(line)?.[1]?.trim();

						if (title) {
							const id = `todo:${file}:${title}`;

							if (!ids.has(id)) {
								draft.tickets.push({ id, title, description: `${file}:${index + 1}`, status: "todo", assignee: "" });
							}
						}
					}
				});
			} catch (error) {
				logger.error({ err: error }, "Scan failed");
			}
		}
	});

	logger.info(`Watching ${root} for TODO comments`);
} catch (error) {
	logger.fatal({ err: error }, "Watch failed");
	process.exit(1);
}
