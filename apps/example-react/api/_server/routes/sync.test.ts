import { describe, expect, it } from "vitest";

import { createServer } from "../server.js";
import { createMemoryDatabase } from "../services/database/memory-database.js";
import { createMemoryEventBus } from "../services/database/memory-event-bus.js";

const createApp = (streamDuration?: number) =>
	createServer(createMemoryDatabase(), createMemoryEventBus(), { streamDuration });

const subscribe = async (app: ReturnType<typeof createApp>) => (await app.request("/sync/subscribe")).text();

const push = (app: ReturnType<typeof createApp>, data: unknown) =>
	app.request("/sync/push", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});

describe("sync subscribe", () => {
	it("ends the stream after the configured duration", async () => {
		expect(await subscribe(createApp(50))).toBe("data: {}\n\n");
	});

	it("accepts pushes after a stream has ended", async () => {
		const app = createApp(50);

		await subscribe(app);

		expect((await push(app, { language: "en" })).status).toBe(200);
	});

	it("delivers pushed updates to open streams", async () => {
		const app = createApp(200);
		const body = subscribe(app);

		await new Promise((resolve) => setTimeout(resolve, 50));
		await push(app, { language: "en" });

		expect(await body).toBe('data: {}\n\ndata: {"language":"en"}\n\n');
	});
});

describe("sync push", () => {
	it("rejects payloads that are not objects", async () => {
		expect((await push(createApp(), [1])).status).toBe(400);
	});
});
