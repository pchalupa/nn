import { expect, type Page, test } from "@playwright/test";

test.beforeEach(async ({ request }) => {
	const response = await request.post("http://localhost:3002/reset");

	expect(response.status()).toBe(204);
});

const signUp = async (page: Page) => {
	await page.goto("/sign-up");
	await page.getByLabel("Name").fill("Jan Novak");
	await page.getByRole("button", { name: "Sign up" }).click();
	await page.waitForURL("/");
};

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
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
});

test.describe("Authentication", () => {
	test("signing up lands on the board", async ({ page }) => {
		await signUp(page);

		await expect(page).toHaveURL("/");
		await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
	});

	test("opening the board while signed out redirects to sign-in", async ({ page }) => {
		await page.goto("/");

		await expect(page).toHaveURL("/sign-in");
	});

	test.describe("signed in", () => {
		test.beforeEach(async ({ page }) => {
			await signUp(page);
		});

		test("opening sign-in redirects to the board", async ({ page }) => {
			await page.goto("/sign-in");

			await expect(page).toHaveURL("/");
			await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
		});

		test("reloading keeps the user signed in", async ({ page }) => {
			await page.reload();

			await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
		});

		test("signing out returns to sign-in", async ({ page }) => {
			await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

			await page.getByRole("button", { name: "Sign out" }).click();

			await expect(page).toHaveURL("/sign-in");
		});

		test("signing back in with the same passkey after a reload", async ({ page }) => {
			await page.getByRole("button", { name: "Sign out" }).click();
			await expect(page).toHaveURL("/sign-in");
			await page.reload();

			await page.getByRole("button", { name: "Sign in with a passkey" }).click();

			await expect(page).toHaveURL("/");
			await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
		});
	});
});
