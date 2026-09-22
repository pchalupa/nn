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
});
