import { expect, test } from "./fixtures";

test.describe("Language", () => {
	test("keeps the selected language after a reload", async ({ page }) => {
		await page.goto("/profile");

		await page.getByRole("combobox", { name: "Language" }).selectOption("cs");

		await expect(page.getByRole("button", { name: /Nástěnka/ })).toBeVisible();

		await page.reload();

		await expect(page.getByRole("combobox", { name: "Jazyk" })).toHaveValue("cs");
		await expect(page.getByRole("button", { name: /Nástěnka/ })).toBeVisible();
	});
});
