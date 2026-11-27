import { choose, expect, test } from "./fixtures";

test.describe("LanguageSelector", () => {
	test("should keep the selected language after a reload", async ({ page }) => {
		await page.goto("/profile");

		await choose(page.getByRole("combobox", { name: "Language" }), "Čeština");
		await expect(page.getByRole("link", { name: /^Nástěnky/ })).toBeVisible();

		await page.reload();
		await page.goto("/");

		await expect(page.getByRole("heading", { level: 1, name: "Nástěnky" })).toBeVisible();
	});
});
