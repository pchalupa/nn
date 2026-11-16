import { expect, signUp, test } from "./fixtures";

test.use({ signedIn: false });

test.describe("Authentication", () => {
	test("signing up lands on the board", async ({ page }) => {
		await signUp(page);

		await expect(page).toHaveURL("/");
		await expect(page.getByRole("link", { name: "Jan Novak" })).toBeVisible();
	});

	test("switching between sign-in and sign-up", async ({ page }) => {
		await page.goto("/sign-in");
		await page.getByRole("link", { name: "Create account" }).click();

		await expect(page).toHaveURL("/sign-up");
		await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();

		await page.getByRole("link", { name: "Sign in" }).click();

		await expect(page).toHaveURL("/sign-in");
		await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
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
			await expect(page.getByRole("link", { name: "Jan Novak" })).toBeVisible();
		});

		test("reloading keeps the user signed in", async ({ page }) => {
			await page.reload();

			await expect(page.getByRole("link", { name: "Jan Novak" })).toBeVisible();
		});

		test("signing out returns to sign-in", async ({ page }) => {
			await page.getByRole("link", { name: "Jan Novak" }).click();
			await page.getByRole("button", { name: "Sign out" }).click();

			await expect(page).toHaveURL("/sign-in");
		});

		test("signing back in with the same passkey after a reload", async ({ page }) => {
			await page.getByRole("link", { name: "Jan Novak" }).click();
			await page.getByRole("button", { name: "Sign out" }).click();
			await expect(page).toHaveURL("/sign-in");
			await page.reload();

			await page.getByRole("button", { name: "Continue with passkey" }).click();

			await expect(page).toHaveURL("/");
			await expect(page.getByRole("link", { name: "Jan Novak" })).toBeVisible();
		});
	});
});
