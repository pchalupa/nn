import { once } from "node:events";

import { test as base } from "@playwright/test";
import { createMemoryDatabase } from "example-server/db";
import { createServer } from "example-server/server";

export { expect, type Page } from "@playwright/test";

const remoteOrigin = "http://localhost:3002";

export const test = base.extend({
	context: async ({ context }, use) => {
		const server = createServer(createMemoryDatabase()).listen(0, "127.0.0.1");

		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") throw new Error("Remote server has no port");

		await context.route(`${remoteOrigin}/**`, (route) => {
			const url = new URL(route.request().url());

			url.port = String(address.port);
			url.hostname = "127.0.0.1";

			return route.continue({ url: url.href });
		});

		await use(context);

		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
	},
});
