import { expect, signUp, test } from "./fixtures";

test.use({ signedIn: false });

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
