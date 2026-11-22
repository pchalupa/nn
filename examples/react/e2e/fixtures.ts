import { once } from "node:events";

import { serve } from "@hono/node-server";
import { test as base, type Locator, type Page } from "@playwright/test";
import { createMemoryDatabase } from "example-server/memory-database";
import { createMemoryEventBus } from "example-server/memory-event-bus";
import { createServer } from "example-server/server";

export { expect, type Locator, type Page } from "@playwright/test";

export const test = base.extend<{ signedIn: boolean }>({
	signedIn: [true, { option: true }],
	context: async ({ context }, use) => {
		const server = serve({
			fetch: createServer(createMemoryDatabase(), createMemoryEventBus()).fetch,
			port: 0,
			hostname: "127.0.0.1",
		});

		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") throw new Error("Remote server has no port");

		await context.route("http://localhost:3002/**", (route) => {
			const url = new URL(route.request().url());

			url.port = String(address.port);
			url.hostname = "127.0.0.1";

			return route.continue({ url: url.href });
		});

		await use(context);

		if ("closeAllConnections" in server) server.closeAllConnections();

		await new Promise((resolve) => server.close(resolve));
	},
	page: async ({ page, signedIn }, use) => {
		const client = await page.context().newCDPSession(page);

		await client.send("WebAuthn.enable");
		await client.send("WebAuthn.addVirtualAuthenticator", {
			options: {
				protocol: "ctap2",
				transport: "internal",
				hasResidentKey: true,
				hasUserVerification: true,
				isUserVerified: true,
				automaticPresenceSimulation: true,
			},
		});

		if (signedIn) await signUp(page);

		await use(page);
	},
});

export async function signUp(page: Page) {
	await page.goto("/sign-up");
	await page.getByLabel("Name").fill("Jan Novak");
	await page.getByRole("button", { name: "Continue with passkey" }).click();
	await page.waitForURL("/");
}

export async function choose(combobox: Locator, option: string) {
	await combobox.click();
	await combobox.page().getByRole("option", { name: option, exact: true }).click();
}
