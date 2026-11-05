import { expect, test } from "./fixtures";

test.describe("LanguageSelector", () => {
	test("should translate the interface", async ({ page }) => {
		await page.goto("/");

		await expect(page.getByRole("heading", { name: "To Do" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Board" })).toBeVisible();

		await page.getByRole("combobox", { name: "Language" }).selectOption("cs");

		await expect(page.getByRole("heading", { name: "K udělání" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Nástěnka" })).toBeVisible();
	});
});
