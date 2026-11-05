import { expect, test } from "./fixtures";

test.describe("Column", () => {
	test("should keep a created ticket after a reload", async ({ page }) => {
		await page.goto("/");

		const column = page.locator("section").filter({ has: page.getByRole("heading", { name: "To Do" }) });
		const dialog = page.locator("dialog");

		await expect(column.getByRole("article")).toHaveCount(0);

		await page.getByRole("button", { name: "Create" }).click();
		await dialog.getByRole("textbox", { name: "Title" }).fill("Persisted");
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect(column.getByRole("article")).toHaveCount(1);

		await page.reload();

		await expect(column.getByRole("article")).toHaveCount(1);
	});
});

test.describe("LanguageSelector", () => {
	test("should keep the selected language after a reload", async ({ page }) => {
		await page.goto("/");

		await page.getByRole("combobox").selectOption("cs");

		await expect(page.getByRole("link", { name: "Zásobník" })).toBeVisible();

		await page.reload();

		await expect(page.getByRole("combobox")).toHaveValue("cs");
	});
});
