import { test as setup } from "@playwright/test";

setup("sign up", async ({ page }) => {
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

	await page.goto("/sign-up");
	await page.getByLabel("Name").fill("Jan Novak");
	await page.getByRole("button", { name: "Sign up" }).click();
	await page.waitForURL("/");

	await page.context().storageState({ path: "e2e/.auth/user.json", indexedDB: true });
});
