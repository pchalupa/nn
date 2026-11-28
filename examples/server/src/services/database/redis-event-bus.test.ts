import { describe, expect, it, vi } from "vitest";

import { createRedisEventBus } from "./redis-event-bus.js";

describe("createRedisEventBus", () => {
	it("publishes on the goodstate-example channel when no channel is given", async () => {
		const client = {
			publish: vi.fn(async () => 1),
			subscribe: vi.fn(() => ({ on: vi.fn(), unsubscribe: vi.fn(async () => undefined) })),
		};

		await createRedisEventBus(client).publish({ language: "en" });

		expect(client.publish).toHaveBeenCalledExactlyOnceWith("goodstate-example", '{"language":"en"}');
	});
});
