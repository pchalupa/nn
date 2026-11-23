import { once } from "node:events";
import { createConnection, createServer as createTcpServer, type Socket } from "node:net";

import { serve } from "@hono/node-server";
import { test as base, type BrowserContext, type CDPSession, expect, type Locator, type Page } from "@playwright/test";
import { createMemoryDatabase } from "example-server/memory-database";
import { createMemoryEventBus } from "example-server/memory-event-bus";
import { createServer } from "example-server/server";

export { expect, type Locator, type Page } from "@playwright/test";

/** Options for opening another device in the same test. */
export interface OpenDeviceOptions {
	passkeysFrom?: Page;
	signedIn?: boolean;
}

/** Opens a new browser context as another device that shares the test's sync server. */
export type OpenDevice = (options?: OpenDeviceOptions) => Promise<Page>;

/** Virtual authenticator of each device page. */
const authenticators = new WeakMap<Page, { client: CDPSession; authenticatorId: string }>();

/** Open sync connections of each device, cut when the device goes offline. */
const connections = new WeakMap<BrowserContext, Set<Socket>>();

export const test = base.extend<{ signedIn: boolean; remote: { port: number }; openDevice: OpenDevice }>({
	signedIn: [true, { option: true }],
	remote: async (_, use) => {
		const server = serve({
			fetch: createServer(createMemoryDatabase(), createMemoryEventBus()).fetch,
			port: 0,
			hostname: "127.0.0.1",
		});

		await once(server, "listening");

		const address = server.address();

		if (!address || typeof address === "string") throw new Error("Remote server has no port");

		await use({ port: address.port });

		if ("closeAllConnections" in server) server.closeAllConnections();

		await new Promise((resolve) => server.close(resolve));
	},
	context: async ({ context, remote }, use) => {
		const disconnect = await connectToRemote(context, remote.port);

		await use(context);
		await disconnect();
	},
	page: async ({ page, signedIn }, use) => {
		await enableAuthenticator(page);

		if (signedIn) await signUp(page);

		await use(page);
	},
	openDevice: async ({ browser, remote }, use, testInfo) => {
		const contexts: BrowserContext[] = [];
		const disconnects: Array<() => Promise<void>> = [];

		await use(async ({ passkeysFrom, signedIn = false } = {}) => {
			const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });

			contexts.push(context);
			disconnects.push(await connectToRemote(context, remote.port));

			const page = await context.newPage();

			await enableAuthenticator(page);

			if (passkeysFrom) await copyPasskeys(passkeysFrom, page);

			if (signedIn) await signIn(page);

			return page;
		});

		await Promise.all(contexts.map((context) => context.close()));
		await Promise.all(disconnects.map((disconnect) => disconnect()));
	},
});

/** Sends a context's sync requests through its own proxy to the test's sync server and returns a function that stops the proxy. */
async function connectToRemote(context: BrowserContext, port: number) {
	const sockets = new Set<Socket>();
	const proxy = createTcpServer((client) => {
		const upstream = createConnection({ port, host: "127.0.0.1" });

		sockets.add(client);
		client.on("close", () => {
			sockets.delete(client);
			upstream.destroy();
		});
		client.on("error", () => upstream.destroy());
		upstream.on("close", () => client.destroy());
		upstream.on("error", () => client.destroy());
		client.pipe(upstream).pipe(client);
	});

	proxy.listen(0, "127.0.0.1");
	await once(proxy, "listening");

	const address = proxy.address();

	if (!address || typeof address === "string") throw new Error("Device proxy has no port");

	connections.set(context, sockets);
	await context.route("http://localhost:3002/**", (route) => {
		const url = new URL(route.request().url());

		url.port = String(address.port);
		url.hostname = "127.0.0.1";

		return route.continue({ url: url.href });
	});

	return async () => {
		for (const socket of sockets) socket.destroy();

		await new Promise((resolve) => proxy.close(resolve));
	};
}

/** Gives a page its own virtual passkey authenticator. */
async function enableAuthenticator(page: Page) {
	const client = await page.context().newCDPSession(page);

	await client.send("WebAuthn.enable");

	const { authenticatorId } = await client.send("WebAuthn.addVirtualAuthenticator", {
		options: {
			protocol: "ctap2",
			transport: "internal",
			hasResidentKey: true,
			hasUserVerification: true,
			isUserVerified: true,
			automaticPresenceSimulation: true,
		},
	});

	authenticators.set(page, { client, authenticatorId });
}

/** Returns the virtual authenticator of a page opened by the fixtures. */
function authenticatorOf(page: Page) {
	const authenticator = authenticators.get(page);

	if (!authenticator) throw new Error("Page has no virtual authenticator");

	return authenticator;
}

/** Copies passkeys from one device to another, like a passkey synced through iCloud or Google. */
export async function copyPasskeys(from: Page, to: Page) {
	const source = authenticatorOf(from);
	const target = authenticatorOf(to);
	const { credentials } = await source.client.send("WebAuthn.getCredentials", {
		authenticatorId: source.authenticatorId,
	});

	for (const credential of credentials) {
		await target.client.send("WebAuthn.addCredential", { authenticatorId: target.authenticatorId, credential });
	}
}

/** Takes a device offline, cutting its open sync connections, or brings it back online. */
export async function setOnline(page: Page, online: boolean) {
	await page.context().setOffline(!online);

	if (online) return;

	for (const socket of connections.get(page.context()) ?? []) socket.end();
}

/** Creates an account with a new passkey. */
export async function signUp(page: Page) {
	await page.goto("/sign-up");
	await page.getByLabel("Name").fill("Jan Novak");
	await page.getByRole("button", { name: "Continue with passkey" }).click();
	await page.waitForURL("/");
}

/** Signs in with a passkey already on the device, retrying until the account has synced. */
export async function signIn(page: Page) {
	await page.goto("/sign-in");

	const button = page.getByRole("button", { name: "Continue with passkey" });

	await button.waitFor();

	await expect(async () => {
		if (new URL(page.url()).pathname !== "/") await button.click({ timeout: 1_000 });

		await page.waitForURL("/", { timeout: 1_000 });
	}).toPass({ timeout: 10_000 });
}

/** Picks an option from a Radix select. */
export async function choose(combobox: Locator, option: string) {
	await combobox.click();
	await combobox.page().getByRole("option", { name: option, exact: true }).click();
}
