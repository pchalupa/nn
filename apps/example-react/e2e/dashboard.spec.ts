import { expect, test } from "@playwright/test";

test.describe("Column", () => {
	test("should add a ticket", async ({ page }) => {
		await page.goto("/");

		const column = page.locator("section").filter({ has: page.getByRole("heading", { name: "To Do" }) });
		const tickets = column.getByRole("article");

		await expect(tickets).toHaveCount(0);

		await column.getByRole("button", { name: "+" }).click();

		await expect(tickets).toHaveCount(1);
	});

	test("should keep a ticket after a reload", async ({ page }) => {
		await page.goto("/");

		const column = page.locator("section").filter({ has: page.getByRole("heading", { name: "To Do" }) });

		await column.getByRole("button", { name: "+" }).click();
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
