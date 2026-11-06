import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { Database } from "../services/database/database.js";
import type { EventBus } from "../services/database/memory-event-bus.js";
import logger from "../services/logger.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export default function createSync(db: Database, bus: EventBus, streamDuration?: number): Hono {
	const sync = new Hono();

	sync.post("/push", async (c) => {
		const data: unknown = await c.req.json().catch(() => undefined);

		if (!isRecord(data)) return c.json({ error: "No data provided" }, 400);

		try {
			await db.update(data);
			logger.info({ data }, "Data updated");

			await bus.publish(data);

			return c.json(data);
		} catch (error) {
			logger.error({ err: error }, "Error pushing data");

			return c.json({ error: "Failed to update data" }, 500);
		}
	});

	sync.get("/subscribe", (c) =>
		streamSSE(c, async (stream) => {
			logger.info("Client connected");

			const send = (fields: Record<string, unknown>) => void stream.writeSSE({ data: JSON.stringify(fields) });

			let expiry: ReturnType<typeof setTimeout> | undefined;
			let end = () => {};
			const ended = new Promise<void>((resolve) => {
				end = resolve;
				stream.onAbort(resolve);
				if (streamDuration !== undefined) expiry = setTimeout(resolve, streamDuration);
			});

			try {
				const unsubscribe = await bus.subscribe(send, (error) => {
					logger.error({ err: error }, "Subscription failed");
					end();
				});

				try {
					if (!stream.aborted) send(await db.get());
					await ended;
				} finally {
					unsubscribe();
				}
			} catch (error) {
				logger.error({ err: error }, "Error sending snapshot");
			} finally {
				clearTimeout(expiry);
				logger.info("Client disconnected");
			}
		}),
	);

	return sync;
}
